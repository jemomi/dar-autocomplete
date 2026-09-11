import { createAdressevaelgerClient } from './client.js'
import type { AdressevaelgerClientOptions, DarClient } from './client.js'
import { createDarAutocompleteController, darAutocompleteLabels } from './controller.js'
import type { DarAutocompleteOptions, DarAutocompleteState } from './controller.js'
import type { DarAddressValue, DarSuggestion } from './types.js'

export interface BrowserDarAutocompleteOptions extends DarAutocompleteOptions {
  /** Use an already configured client. Takes precedence over token/baseUrl. */
  client?: DarClient
  /** Adressevaelger token for direct browser requests. Visible to browser users. */
  token?: string
  /** Adressevaelger base URL when using direct browser requests. */
  baseUrl?: string
  /** Optional custom fetch implementation. */
  fetch?: typeof globalThis.fetch
  label?: string
  value?: DarAddressValue | null
  initialAddressId?: string
  onChange?: (value: DarAddressValue | null) => void
  onSelect?: (value: DarAddressValue) => void
}

export interface BrowserDarAutocomplete {
  readonly value: DarAddressValue | null
  validate(): boolean
  clear(): void
  focus(): void
  destroy(): void
}

const attachedInputs = new WeakSet<HTMLInputElement>()
let nextId = 0

function resolveClient(options: BrowserDarAutocompleteOptions): DarClient {
  if (options.client) return options.client
  if (!options.token) {
    throw new Error('Provide either options.client or options.token')
  }
  const clientOptions: AdressevaelgerClientOptions = { token: options.token }
  if (options.baseUrl !== undefined) clientOptions.baseUrl = options.baseUrl
  if (options.fetch !== undefined) clientOptions.fetch = options.fetch
  return createAdressevaelgerClient(clientOptions)
}

export function attachDarAutocomplete(
  input: HTMLInputElement,
  options: BrowserDarAutocompleteOptions
): BrowserDarAutocomplete {
  if (attachedInputs.has(input)) throw new Error('DAR autocomplete is already attached to this input')
  if (!input.parentNode || !['text', 'search'].includes(input.type)) {
    throw new Error('DAR autocomplete requires a mounted text or search input')
  }

  attachedInputs.add(input)
  const doc = input.ownerDocument
  const originalParent = input.parentNode
  const originalNextSibling = input.nextSibling
  const originalAttributes = new Map([
    'id', 'class', 'role', 'autocomplete', 'spellcheck', 'required', 'disabled',
    'aria-autocomplete', 'aria-haspopup', 'aria-expanded', 'aria-controls',
    'aria-activedescendant', 'aria-busy', 'aria-invalid', 'aria-required',
    'aria-describedby', 'aria-label'
  ].map(name => [name, input.getAttribute(name)]))
  const originalValidity = input.validity.customError ? input.validationMessage : ''
  const wasFocused = doc.activeElement === input
  const form = input.form
  let destroyed = false
  let renderedSuggestions: DarSuggestion[] | undefined

  if (!input.id) {
    let id: string
    do id = `dar-autocomplete-${++nextId}`
    while (doc.getElementById(id) || doc.getElementById(`${id}-listbox`))
    input.id = id
  }

  if (options.required !== undefined) input.required = options.required
  if (options.disabled !== undefined) input.disabled = options.disabled
  input.classList.add('dar-autocomplete__input')
  input.setAttribute('role', 'combobox')
  input.setAttribute('autocomplete', 'off')
  input.setAttribute('spellcheck', 'false')
  input.setAttribute('aria-autocomplete', 'list')
  input.setAttribute('aria-haspopup', 'listbox')
  if (options.label && !input.labels?.length && !input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby')) {
    input.setAttribute('aria-label', options.label)
  }

  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string) {
    const node = doc.createElement(tag)
    node.className = className
    return node
  }

  const root = element('div', 'dar-autocomplete')
  const field = element('div', 'dar-autocomplete__field')
  const panel = element('div', 'dar-autocomplete__panel')
  const listbox = element('ul', 'dar-autocomplete__listbox')
  const noResults = element('div', 'dar-autocomplete__message')
  const error = element('p', 'dar-autocomplete__error')
  const requestError = element('p', 'dar-autocomplete__error')
  const status = element('div', 'dar-autocomplete__sr-only')

  listbox.id = `${input.id}-listbox`
  listbox.setAttribute('role', 'listbox')
  const label = options.label ?? input.labels?.[0]?.textContent?.trim() ?? input.getAttribute('aria-label') ?? 'Adresse'
  listbox.setAttribute('aria-label', `${label}: forslag`)
  noResults.textContent = darAutocompleteLabels.noResults
  error.id = `${input.id}-error`
  requestError.id = `${input.id}-request-error`
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  status.setAttribute('aria-atomic', 'true')

  input.before(root)
  field.append(input, panel)
  panel.append(listbox, noResults)
  root.append(field, error, requestError, status)

  const controller = createDarAutocompleteController({
    client: resolveClient(options),
    ...(options.value !== undefined ? { value: options.value } : {}),
    query: input.value,
    getOptions: () => ({
      required: input.required,
      disabled: input.disabled || input.readOnly,
      ...(options.error !== undefined ? { error: options.error } : {}),
      ...(options.minSearchLength !== undefined ? { minSearchLength: options.minSearchLength } : {}),
      ...(options.debounceMs !== undefined ? { debounceMs: options.debounceMs } : {}),
      ...(options.maxSuggestions !== undefined ? { maxSuggestions: options.maxSuggestions } : {})
    }),
    onChange: value => {
      options.onChange?.(value)
      if (value) options.onSelect?.(value)
    },
    onStateChange: render,
    onRefinement: () => {
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    }
  })

  function setAttribute(name: string, value: string | undefined) {
    if (value === undefined) input.removeAttribute(name)
    else input.setAttribute(name, value)
  }

  function render(state: DarAutocompleteState) {
    if (destroyed) return
    if (input.value !== state.query) input.value = state.query
    input.setCustomValidity(controller.isFieldValid() ? '' : (options.error ?? darAutocompleteLabels.error))
    input.classList.toggle('dar-autocomplete__input--attached', state.isOpen || state.showNoResults)
    setAttribute('aria-expanded', String(state.isOpen))
    setAttribute('aria-busy', String(state.isBusy))
    setAttribute('aria-required', String(input.required))
    setAttribute('aria-invalid', state.isValid === false ? 'true' : undefined)
    setAttribute('aria-controls', state.isOpen ? listbox.id : undefined)
    setAttribute('aria-activedescendant', state.isOpen && state.activeIndex >= 0 ? `${listbox.id}-option-${state.activeIndex}` : undefined)
    setAttribute('aria-describedby', [
      originalAttributes.get('aria-describedby'),
      state.validationMessage ? error.id : '',
      state.requestError ? requestError.id : ''
    ].filter(Boolean).join(' ') || undefined)

    panel.hidden = !state.isOpen && !state.showNoResults
    listbox.hidden = !state.isOpen
    noResults.hidden = !state.showNoResults
    error.hidden = !state.validationMessage
    error.textContent = state.validationMessage
    requestError.hidden = !state.requestError
    requestError.textContent = state.requestError
    if (status.textContent !== state.statusMessage) status.textContent = state.statusMessage

    if (renderedSuggestions !== state.suggestions) {
      renderedSuggestions = state.suggestions
      listbox.replaceChildren(...state.suggestions.map((suggestion, index) => {
        const option = element('li', 'dar-autocomplete__option')
        option.id = `${listbox.id}-option-${index}`
        option.dataset.index = String(index)
        option.setAttribute('role', 'option')
        option.textContent = suggestion.title
        if (suggestion.type !== 'adresse') {
          const hint = element('span', 'dar-autocomplete__sr-only')
          hint.textContent = darAutocompleteLabels.refinementHint
          option.append(hint)
        }
        return option
      }))
    }

    Array.from(listbox.children).forEach((option, index) => {
      option.setAttribute('aria-selected', String(index === state.activeIndex))
      option.classList.toggle('dar-autocomplete__option--active', index === state.activeIndex)
    })
  }

  const listeners = new AbortController()
  function listen(target: EventTarget, type: string, listener: EventListener) {
    target.addEventListener(type, listener, { signal: listeners.signal })
  }

  listen(input, 'input', () => controller.input(input.value))
  listen(input, 'focus', controller.focus)
  listen(input, 'blur', controller.blur)
  listen(input, 'keydown', (event) => {
    const keyboard = event as KeyboardEvent
    controller.keydown(keyboard)
    if (keyboard.key === 'ArrowDown' || keyboard.key === 'ArrowUp') {
      listbox.children[controller.state.activeIndex]?.scrollIntoView?.({ block: 'nearest' })
    }
  })
  listen(input, 'invalid', (event) => {
    event.preventDefault()
    controller.validate()
    input.focus()
  })
  listen(listbox, 'mousedown', event => event.preventDefault())

  function optionIndex(event: Event) {
    const option = (event.target as Element).closest<HTMLElement>('[role="option"]')
    return option?.parentNode === listbox ? Number(option.dataset.index) : -1
  }

  listen(listbox, 'mouseover', (event) => {
    const index = optionIndex(event)
    if (index >= 0) controller.activate(index)
  })
  listen(listbox, 'click', (event) => {
    const suggestion = controller.state.suggestions[optionIndex(event)]
    if (suggestion) controller.select(suggestion)
  })

  if (form) {
    listen(form, 'reset', (event) => {
      queueMicrotask(() => {
        if (destroyed || event.defaultPrevented) return
        controller.setValue(null)
        controller.input(input.defaultValue)
      })
    })
  }

  const observer = new MutationObserver(() => controller.refresh())
  observer.observe(input, { attributes: true, attributeFilter: ['required', 'disabled', 'readonly'] })

  render(controller.state)
  if (wasFocused) {
    input.focus()
    controller.focus()
  }
  if (options.initialAddressId && !options.value) void controller.loadInitialAddress(options.initialAddressId)

  return {
    get value() { return controller.state.value },
    validate: controller.validate,
    clear: controller.clear,
    focus: () => input.focus(),
    destroy() {
      if (destroyed) return
      destroyed = true
      controller.destroy()
      observer.disconnect()
      listeners.abort()

      if (input.parentNode === field) {
        if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
          originalParent.insertBefore(input, originalNextSibling)
        } else {
          originalParent.appendChild(input)
        }
      }
      root.remove()

      for (const [name, value] of originalAttributes) setAttribute(name, value ?? undefined)
      input.setCustomValidity(originalValidity)
      attachedInputs.delete(input)
    }
  }
}
