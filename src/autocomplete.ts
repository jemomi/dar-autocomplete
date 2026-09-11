// Field interface and functionality.

import type {
    DarClient,
} from "./client.js"

import type {
    DarAddress,
    DarSearchResult,
} from "./types.js"

export type DarAutocompleteStatus =
    | "idle"
    | "searching"
    | "resolving"
    | "error"

export interface DarAutocompleteState {
    query: string
    suggestions: DarSearchResult[]
    activeIndex: number
    status: DarAutocompleteStatus
    error: Error | null
    selected: DarAddress | null
}

export interface DarAutocompleteOptions {
    minLength?: number
    debounceMs?: number
    maxResults?: number
    municipalityCode?: string
    includeProvisional?: boolean

    onSelect?: (
        address: DarAddress,
    ) => void

    onError?: (
        error: Error,
    ) => void
}

export interface DarAutocompleteController {
    getState(): Readonly<DarAutocompleteState>

    setQuery(
        query: string,
    ): void

    moveActive(
        direction: 1 | -1,
    ): void

    select(
        selection?: number | DarSearchResult,
    ): Promise<DarAddress | null>

    close(): void

    clear(): void

    subscribe(
        listener: (
            state: Readonly<DarAutocompleteState>,
        ) => void,
    ): () => void

    destroy(): void
}

export function createAutocomplete(
    client: DarClient,
    options: DarAutocompleteOptions = {},
): DarAutocompleteController {
    const minLength =
        options.minLength ?? 2

    const debounceMs =
        options.debounceMs ?? 200

    if (
        !Number.isInteger(minLength) ||
        minLength < 0
    ) {
        throw new RangeError(
            "dar-autocomplete: minLength must be a non-negative integer",
        )
    }

    if (
        !Number.isFinite(debounceMs) ||
        debounceMs < 0
    ) {
        throw new RangeError(
            "dar-autocomplete: debounceMs must be zero or greater",
        )
    }

    let state: DarAutocompleteState = {
        query: "",
        suggestions: [],
        activeIndex: -1,
        status: "idle",
        error: null,
        selected: null,
    }

    const listeners = new Set<
        (
            state: Readonly<DarAutocompleteState>,
        ) => void
    >()

    let debounceTimer:
        | ReturnType<typeof setTimeout>
        | undefined

    let requestController:
        | AbortController
        | undefined

    /*
     * Every new operation gets a new number.
     *
     * This protects against stale responses
     * updating the state after a newer search.
     */
    let operation = 0

    let destroyed = false

    function getState():
        Readonly<DarAutocompleteState> {
        return state
    }

    function update(
        patch: Partial<DarAutocompleteState>,
    ): void {
        if (destroyed) {
            return
        }

        state = {
            ...state,
            ...patch,
        }

        for (const listener of listeners) {
            listener(state)
        }
    }

    function cancelPending(): void {
        if (debounceTimer !== undefined) {
            clearTimeout(debounceTimer)
            debounceTimer = undefined
        }

        requestController?.abort()
        requestController = undefined
    }

    function setQuery(
        query: string,
    ): void {
        if (destroyed) {
            return
        }

        cancelPending()

        operation += 1

        update({
            query,
            suggestions: [],
            activeIndex: -1,
            selected: null,
            error: null,
            status: "idle",
        })

        const text = query.trim()

        if (text.length < minLength) {
            return
        }

        const currentOperation =
            operation

        debounceTimer = setTimeout(() => {
            debounceTimer = undefined

            void performSearch(
                text,
                currentOperation,
            )
        }, debounceMs)
    }

    async function performSearch(
        query: string,
        currentOperation: number,
    ): Promise<void> {
        if (
            destroyed ||
            currentOperation !== operation
        ) {
            return
        }

        const controller =
            new AbortController()

        requestController =
            controller

        update({
            status: "searching",
            error: null,
        })

        try {
            const searchOptions: {
                signal: AbortSignal
                maxResults?: number
                municipalityCode?: string
                includeProvisional?: boolean
            } = {
                signal: controller.signal,
            }

            if (
                options.maxResults !== undefined
            ) {
                searchOptions.maxResults =
                    options.maxResults
            }

            if (
                options.municipalityCode !==
                undefined
            ) {
                searchOptions.municipalityCode =
                    options.municipalityCode
            }

            if (
                options.includeProvisional !==
                undefined
            ) {
                searchOptions.includeProvisional =
                    options.includeProvisional
            }

            const suggestions =
                await client.search(
                    query,
                    searchOptions,
                )

            if (
                destroyed ||
                controller.signal.aborted ||
                currentOperation !== operation
            ) {
                return
            }

            update({
                suggestions,
                activeIndex: -1,
                status: "idle",
            })
        } catch (error) {
            if (
                isAbortError(error) ||
                currentOperation !== operation ||
                destroyed
            ) {
                return
            }

            handleError(error)
        } finally {
            if (
                requestController === controller
            ) {
                requestController = undefined
            }
        }
    }

    /*
     * Used when selecting an intermediate
     * result such as:
     *
     * - vejnavn
     * - navngivenvejpostnummer
     * - husnummer
     *
     * No debounce here, because the user
     * explicitly selected a suggestion.
     */
    async function searchImmediately(
        query: string,
    ): Promise<void> {
        cancelPending()

        operation += 1

        const text = query.trim()

        const currentOperation =
            operation

        update({
            query,
            selected: null,
            suggestions: [],
            activeIndex: -1,
            error: null,
            status: "idle",
        })

        if (text.length < minLength) {
            return
        }

        await performSearch(
            text,
            currentOperation,
        )
    }

    function moveActive(
        direction: 1 | -1,
    ): void {
        if (!state.suggestions.length) {
            return
        }

        const nextIndex =
            Math.max(
                -1,
                Math.min(
                    state.suggestions.length - 1,
                    state.activeIndex + direction,
                ),
            )

        update({
            activeIndex: nextIndex,
        })
    }

    async function select(
        selection:
            | number
            | DarSearchResult =
        state.activeIndex,
    ): Promise<DarAddress | null> {
        if (destroyed) {
            return null
        }

        const suggestion =
            typeof selection === "number"
                ? state.suggestions[selection]
                : selection

        if (!suggestion) {
            return null
        }

        /*
         * These are navigation results.
         *
         * Selecting them makes the query
         * more specific and performs
         * another address search.
         */
        if (
            suggestion.type !== "adresse"
        ) {
            await searchImmediately(
                suggestion.titel,
            )

            return null
        }

        /*
         * Actual DAR address selected.
         */
        cancelPending()

        operation += 1

        const currentOperation =
            operation

        const controller =
            new AbortController()

        requestController =
            controller

        update({
            query: suggestion.titel,
            suggestions: [],
            activeIndex: -1,
            selected: null,
            error: null,
            status: "resolving",
        })

        try {
            const address =
                await client.getAddress(
                    suggestion.id,
                    {
                        signal:
                        controller.signal,
                    },
                )

            if (
                destroyed ||
                controller.signal.aborted ||
                currentOperation !== operation
            ) {
                return null
            }

            update({
                selected: address,
                status: "idle",
            })

            options.onSelect?.(
                address,
            )

            return address
        } catch (error) {
            if (
                isAbortError(error) ||
                currentOperation !== operation ||
                destroyed
            ) {
                return null
            }

            handleError(error)

            return null
        } finally {
            if (
                requestController === controller
            ) {
                requestController = undefined
            }
        }
    }

    function close(): void {
        /*
         * Important:
         * abort the current search as well,
         * otherwise Escape could close the
         * list only for an old request to
         * reopen it milliseconds later.
         */
        cancelPending()

        operation += 1

        update({
            suggestions: [],
            activeIndex: -1,
            status: "idle",
        })
    }

    function clear(): void {
        cancelPending()

        operation += 1

        update({
            query: "",
            suggestions: [],
            activeIndex: -1,
            status: "idle",
            error: null,
            selected: null,
        })
    }

    function subscribe(
        listener: (
            state:
            Readonly<DarAutocompleteState>,
        ) => void,
    ): () => void {
        listeners.add(listener)

        /*
         * Immediately send current state.
         */
        listener(state)

        return () => {
            listeners.delete(listener)
        }
    }

    function destroy(): void {
        if (destroyed) {
            return
        }

        cancelPending()

        operation += 1

        listeners.clear()

        destroyed = true
    }

    function handleError(
        value: unknown,
    ): void {
        const error =
            value instanceof Error
                ? value
                : new Error(String(value))

        update({
            suggestions: [],
            activeIndex: -1,
            status: "error",
            error,
        })

        options.onError?.(
            error,
        )
    }

    return {
        getState,
        setQuery,
        moveActive,
        select,
        close,
        clear,
        subscribe,
        destroy,
    }
}

function isAbortError(
    error: unknown,
): boolean {
    return (
        (
            error instanceof DOMException &&
            error.name === "AbortError"
        ) ||
        (
            typeof error === "object" &&
            error !== null &&
            "name" in error &&
            error.name === "AbortError"
        )
    )
}