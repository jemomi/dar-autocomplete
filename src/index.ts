//Core entrypoint

export {
    createDarClient,
    DarApiError,
} from "./client.js"

export type {
    CreateDarClientOptions,
    DarClient,
} from "./client.js"

export {
    createAutocomplete,
} from "./autocomplete.js"

export type {
    DarAutocompleteController,
    DarAutocompleteOptions,
    DarAutocompleteState,
    DarAutocompleteStatus,
} from "./autocomplete.js"

export type {
    DarAddress,
    DarAddressResult,
    DarHouseNumberResult,
    DarRequestOptions,
    DarSearchOptions,
    DarSearchResponse,
    DarSearchResult,
    DarStreetPostalCodeResult,
    DarStreetResult,
} from "./types.js"