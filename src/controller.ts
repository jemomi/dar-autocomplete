import type { DarClient } from './client.js'
import type { DarAddressValue, DarSuggestion } from './types.js'

export const darAutocompleteLabels = {
  error: 'Vælg en adresse fra listen',
  noResults: 'Ingen adresser fundet',
  searchUnavailable: 'Adressesøgningen er midlertidigt utilgængelig. Prøv igen.',
  initialLookupFailed: 'Adressen kunne ikke indlæses.',
  refinementHint: ', vælg for at indsnævre søgningen'
} as const

export interface DarAutocompleteOptions {
  required?: boolean
  disabled?: boolean
  error?: string
  minSearchLength?: number
  debounceMs?: number
  maxSuggestions?: number
}

export interface DarAutocompleteState {
  value: DarAddressValue | null
  query: string
  suggestions: DarSuggestion[]
  activeIndex: number
  isFocused: boolean
  isOpen: boolean
  isBusy: boolean
  showNoResults: boolean
  isValid: boolean | undefined
  validationMessage: string
  requestError: string
  statusMessage: string
}

export interface DarAutocompleteControllerOptions {
  client: DarClient
  value?: DarAddressValue | null
  query?: string
  getOptions: () => DarAutocompleteOptions
  onStateChange: (state: DarAutocompleteState) => void
  onChange: (value: DarAddressValue | null) => void
  onRefinement?: (suggestion: DarSuggestion) => void
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function createDarAutocompleteController(options: DarAutocompleteControllerOptions) {
  const state: DarAutocompleteState = {
    value: options.value ?? null,
    query: options.value?.title ?? options.query ?? '',
    suggestions: [],
    activeIndex: -1,
    isFocused: false,
    isOpen: false,
    isBusy: false,
    showNoResults: false,
    isValid: undefined,
    validationMessage: '',
    requestError: '',
    statusMessage: ''
  }

  let searchTimer: ReturnType<typeof setTimeout> | undefined
  let searchController: AbortController | undefined
  let initialController: AbortController | undefined
  let searching = false
  let initialising = false
  let hasSearched = false
  let touched = false
  let destroyed = false

  const settings = () => ({
    required: false,
    disabled: false,
    error: darAutocompleteLabels.error,
    minSearchLength: 2,
    debounceMs: 250,
    maxSuggestions: 10,
    ...options.getOptions()
  })

  function isFieldValid() {
    return settings().disabled || !settings().required ||
      (state.value !== null && state.query === state.value.title)
  }

  function publish() {
    if (destroyed) return
    state.isBusy = searching || initialising
    state.showNoResults = state.isFocused && !state.value && hasSearched && !searching &&
      !state.requestError && !settings().disabled &&
      state.query.trim().length >= settings().minSearchLength && state.suggestions.length === 0
    options.onStateChange({ ...state })
  }

  function cancelSearch() {
    clearTimeout(searchTimer)
    searchTimer = undefined
    searchController?.abort()
    searchController = undefined
    searching = false
  }

  function cancelInitialLookup() {
    initialController?.abort()
    initialController = undefined
    initialising = false
  }

  function clearSuggestions() {
    state.suggestions = []
    state.activeIndex = -1
    state.isOpen = false
  }

  function resetValidation() {
    state.isValid = undefined
    state.validationMessage = ''
  }

  function changeValue(value: DarAddressValue | null) {
    if (state.value?.id === value?.id && state.value?.title === value?.title) return
    state.value = value
    options.onChange(value)
  }

  function scheduleSearch(delay = settings().debounceMs) {
    cancelSearch()
    const text = state.query.trim()
    if (destroyed || settings().disabled || text.length < settings().minSearchLength) return
    const controller = new AbortController()
    searchController = controller
    searchTimer = setTimeout(() => {
      if (state.isFocused && !controller.signal.aborted) void performSearch(text, controller)
    }, delay)
  }

  async function performSearch(text: string, controller: AbortController) {
    searching = true
    state.requestError = ''
    publish()
    try {
      const result = await options.client.search(text, {
        limit: settings().maxSuggestions,
        signal: controller.signal
      })
      if (controller !== searchController || controller.signal.aborted || state.query.trim() !== text) return
      state.suggestions = result
      state.activeIndex = result.length ? 0 : -1
      hasSearched = true
      state.isOpen = state.isFocused && result.length > 0
      state.statusMessage = result.length === 0 ? darAutocompleteLabels.noResults : `${result.length} adresseforslag fundet`
    } catch (error) {
      if (controller !== searchController || controller.signal.aborted || isAbortError(error)) return
      clearSuggestions()
      hasSearched = true
      state.requestError = darAutocompleteLabels.searchUnavailable
      state.statusMessage = state.requestError
    } finally {
      if (controller === searchController) {
        searching = false
        publish()
      }
    }
  }

  function input(value: string) {
    if (destroyed || settings().disabled) return
    state.query = value
    touched = true
    if (state.value && value !== state.value.title) changeValue(null)
    cancelInitialLookup()
    resetValidation()
    state.requestError = ''
    state.statusMessage = ''
    hasSearched = false
    clearSuggestions()
    scheduleSearch()
    publish()
  }

  function select(suggestion: DarSuggestion) {
    if (destroyed || settings().disabled) return
    cancelSearch()
    cancelInitialLookup()
    clearSuggestions()
    resetValidation()
    state.requestError = ''
    hasSearched = false

    if (suggestion.type !== 'adresse') {
      state.query = `${suggestion.title.trim()} `
      touched = true
      changeValue(null)
      state.statusMessage = ''
      publish()
      options.onRefinement?.(suggestion)
      scheduleSearch(0)
      return
    }

    state.query = suggestion.title
    touched = false
    changeValue({ id: suggestion.id, title: suggestion.title })
    state.statusMessage = `${suggestion.title} valgt`
    publish()
  }

  function focus() {
    if (destroyed || settings().disabled) return
    state.isFocused = true
    if (state.suggestions.length) {
      state.isOpen = true
      state.activeIndex = 0
    } else if (!state.value && (!hasSearched || state.requestError)) {
      scheduleSearch(0)
    }
    publish()
  }

  function blur() {
    state.isFocused = false
    cancelSearch()
    state.isOpen = false
    state.activeIndex = -1
    if (touched || state.query.trim()) validate()
    else publish()
  }

  function activate(index: number) {
    if (index < 0 || index >= state.suggestions.length) return
    state.activeIndex = index
    publish()
  }

  function keydown(event: Pick<KeyboardEvent, 'key' | 'isComposing' | 'preventDefault'>) {
    if (destroyed || settings().disabled || event.isComposing) return
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && state.suggestions.length) {
      event.preventDefault()
      state.isOpen = true
      const count = state.suggestions.length
      state.activeIndex = event.key === 'ArrowDown'
        ? (state.activeIndex + 1) % count
        : (state.activeIndex <= 0 ? count - 1 : state.activeIndex - 1)
      publish()
    } else if ((event.key === 'Enter' || event.key === 'Tab') && state.isOpen && !state.value) {
      const suggestion = state.suggestions[state.activeIndex]
      if (suggestion) {
        event.preventDefault()
        select(suggestion)
      }
    } else if (event.key === 'Escape' && (state.isOpen || state.showNoResults || searchController)) {
      event.preventDefault()
      cancelSearch()
      state.isOpen = false
      state.activeIndex = -1
      hasSearched = false
      publish()
    }
  }

  async function loadInitialAddress(id: string) {
    if (destroyed || state.value) return
    cancelSearch()
    cancelInitialLookup()
    const controller = new AbortController()
    initialController = controller
    initialising = true
    state.requestError = ''
    publish()
    try {
      const address = await options.client.getAddress(id, controller.signal)
      if (controller !== initialController || controller.signal.aborted) return
      clearSuggestions()
      state.query = address.title
      changeValue({ id: address.id, title: address.title })
      resetValidation()
      state.statusMessage = `${address.title} indlæst`
    } catch (error) {
      if (controller !== initialController || controller.signal.aborted || isAbortError(error)) return
      state.requestError = darAutocompleteLabels.initialLookupFailed
      state.statusMessage = state.requestError
    } finally {
      if (controller === initialController) {
        initialising = false
        publish()
      }
    }
  }

  function validate() {
    const valid = isFieldValid()
    state.isValid = valid
    state.validationMessage = valid ? '' : settings().error
    publish()
    return valid
  }

  function refresh() {
    if (settings().disabled) {
      cancelSearch()
      clearSuggestions()
    }
    if (state.isValid !== undefined) validate()
    else publish()
  }

  function setValue(value: DarAddressValue | null) {
    if (destroyed) return
    cancelSearch()
    cancelInitialLookup()
    state.value = value
    state.query = value?.title ?? ''
    touched = false
    hasSearched = false
    clearSuggestions()
    resetValidation()
    publish()
  }

  function clear() {
    setValue(null)
  }

  function destroy() {
    destroyed = true
    cancelSearch()
    cancelInitialLookup()
  }

  return {
    state,
    input,
    select,
    focus,
    blur,
    activate,
    keydown,
    loadInitialAddress,
    validate,
    refresh,
    setValue,
    clear,
    destroy,
    isFieldValid
  }
}
