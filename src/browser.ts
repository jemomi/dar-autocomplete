// Binding to an existing input field.

import type {
    DarAutocompleteController,
} from "./autocomplete.js"

export interface BindAddressInputOptions {
    autocomplete?: string
}

export function bindAddressInput(
    input: HTMLInputElement,
    autocomplete: DarAutocompleteController,
    options: BindAddressInputOptions = {},
): () => void {
    const previousAutocomplete =
        input.getAttribute(
            "autocomplete",
        )

    const previousAriaAutocomplete =
        input.getAttribute(
            "aria-autocomplete",
        )

    const previousAriaExpanded =
        input.getAttribute(
            "aria-expanded",
        )

    const previousAriaBusy =
        input.getAttribute(
            "aria-busy",
        )

    input.setAttribute(
        "autocomplete",
        options.autocomplete ?? "off",
    )

    input.setAttribute(
        "aria-autocomplete",
        "list",
    )

    let composing = false

    /*
     * Keep input synced when selecting
     * intermediate suggestions.
     */
    const unsubscribe =
        autocomplete.subscribe(
            state => {
                if (
                    input.value !==
                    state.query
                ) {
                    input.value =
                        state.query
                }

                input.setAttribute(
                    "aria-expanded",
                    state.suggestions.length > 0
                        ? "true"
                        : "false",
                )

                input.setAttribute(
                    "aria-busy",
                    state.status === "searching" ||
                    state.status === "resolving"
                        ? "true"
                        : "false",
                )
            },
        )

    function onInput(): void {
        if (composing) {
            return
        }

        autocomplete.setQuery(
            input.value,
        )
    }

    function onCompositionStart(): void {
        composing = true
    }

    function onCompositionEnd(): void {
        composing = false

        autocomplete.setQuery(
            input.value,
        )
    }

    function onKeyDown(
        event: KeyboardEvent,
    ): void {
        const state =
            autocomplete.getState()

        if (
            event.key === "ArrowDown" &&
            state.suggestions.length > 0
        ) {
            event.preventDefault()

            autocomplete.moveActive(1)

            return
        }

        if (
            event.key === "ArrowUp" &&
            state.suggestions.length > 0
        ) {
            event.preventDefault()

            autocomplete.moveActive(-1)

            return
        }

        if (
            event.key === "Enter" &&
            state.activeIndex >= 0
        ) {
            event.preventDefault()

            void autocomplete.select()

            return
        }

        if (
            event.key === "Escape"
        ) {
            autocomplete.close()
        }
    }

    input.addEventListener(
        "input",
        onInput,
    )

    input.addEventListener(
        "keydown",
        onKeyDown,
    )

    input.addEventListener(
        "compositionstart",
        onCompositionStart,
    )

    input.addEventListener(
        "compositionend",
        onCompositionEnd,
    )

    return () => {
        unsubscribe()

        input.removeEventListener(
            "input",
            onInput,
        )

        input.removeEventListener(
            "keydown",
            onKeyDown,
        )

        input.removeEventListener(
            "compositionstart",
            onCompositionStart,
        )

        input.removeEventListener(
            "compositionend",
            onCompositionEnd,
        )

        restoreAttribute(
            input,
            "autocomplete",
            previousAutocomplete,
        )

        restoreAttribute(
            input,
            "aria-autocomplete",
            previousAriaAutocomplete,
        )

        restoreAttribute(
            input,
            "aria-expanded",
            previousAriaExpanded,
        )

        restoreAttribute(
            input,
            "aria-busy",
            previousAriaBusy,
        )
    }
}

function restoreAttribute(
    element: Element,
    name: string,
    previousValue: string | null,
): void {
    if (
        previousValue === null
    ) {
        element.removeAttribute(
            name,
        )
    } else {
        element.setAttribute(
            name,
            previousValue,
        )
    }
}