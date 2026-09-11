// All communication with AdresseVælgeren

import type {
    DarAddress,
    DarAddressResponse,
    DarRequestOptions,
    DarSearchOptions,
    DarSearchResponse,
    DarSearchResult,
} from "./types.js"

const DEFAULT_BASE_URL = "https://adressevaelger.dk"

export interface CreateDarClientOptions {
    token: string
    baseUrl?: string
    fetch?: typeof globalThis.fetch
}

export interface DarClient {
    search(
        query: string,
        options?: DarSearchOptions,
    ): Promise<DarSearchResult[]>

    getAddress(
        id: string,
        options?: DarRequestOptions,
    ): Promise<DarAddress>
}

export class DarApiError extends Error {
    constructor(
        message: string,
        public readonly status?: number,
    ) {
        super(message)
        this.name = "DarApiError"
    }
}

export function createDarClient(
    options: CreateDarClientOptions,
): DarClient {
    const token = options.token.trim()
    const baseUrl =
        options.baseUrl ?? DEFAULT_BASE_URL

    const fetchImpl =
        options.fetch ?? globalThis.fetch

    if (!token) {
        throw new TypeError(
            "dar-autocomplete: token is required",
        )
    }

    if (typeof fetchImpl !== "function") {
        throw new TypeError(
            "dar-autocomplete: fetch is not available",
        )
    }

    async function search(
        query: string,
        searchOptions: DarSearchOptions = {},
    ): Promise<DarSearchResult[]> {
        const text = query.trim()

        if (!text) {
            return []
        }

        const url = createUrl(
            baseUrl,
            "/adresser/soeg",
        )

        url.searchParams.set("tekst", text)
        url.searchParams.set("token", token)

        if (
            searchOptions.maxResults !== undefined
        ) {
            if (
                !Number.isInteger(
                    searchOptions.maxResults,
                ) ||
                searchOptions.maxResults < 1 ||
                searchOptions.maxResults > 200
            ) {
                throw new RangeError(
                    "dar-autocomplete: maxResults must be an integer between 1 and 200",
                )
            }

            url.searchParams.set(
                "maksimum",
                String(searchOptions.maxResults),
            )
        }

        if (searchOptions.municipalityCode) {
            url.searchParams.set(
                "kommuneKode",
                searchOptions.municipalityCode,
            )
        }

        if (searchOptions.includeProvisional) {
            url.searchParams.set(
                "medtagForeloebige",
                "true",
            )
        }

        const requestInit: RequestInit = {
            method: "GET",
        }

        if (searchOptions.signal) {
            requestInit.signal =
                searchOptions.signal
        }

        const response = await fetchImpl(
            url,
            requestInit,
        )

        assertHttpOk(response)

        const data =
            (await response.json()) as DarSearchResponse

        if (data.status === "fejl") {
            throw new DarApiError(
                data.beskrivelse ||
                "Address search failed",
            )
        }

        if (!Array.isArray(data.fund)) {
            throw new DarApiError(
                "dar-autocomplete: invalid search response",
            )
        }

        return data.fund
    }

    async function getAddress(
        id: string,
        requestOptions: DarRequestOptions = {},
    ): Promise<DarAddress> {
        const addressId = id.trim()

        if (!addressId) {
            throw new TypeError(
                "dar-autocomplete: address id is required",
            )
        }

        const url = createUrl(
            baseUrl,
            `/adresser/${encodeURIComponent(
                addressId,
            )}`,
        )

        url.searchParams.set("token", token)

        const requestInit: RequestInit = {
            method: "GET",
        }

        if (requestOptions.signal) {
            requestInit.signal =
                requestOptions.signal
        }

        const response = await fetchImpl(
            url,
            requestInit,
        )

        assertHttpOk(response)

        const data =
            (await response.json()) as DarAddressResponse

        if (data.status === "fejl") {
            throw new DarApiError(
                data.beskrivelse ||
                "Address lookup failed",
            )
        }

        if (!data.adresse) {
            throw new DarApiError(
                "dar-autocomplete: invalid address response",
            )
        }

        return data.adresse
    }

    return {
        search,
        getAddress,
    }
}

function createUrl(
    baseUrl: string,
    path: string,
): URL {
    const normalizedBaseUrl =
        baseUrl.endsWith("/")
            ? baseUrl
            : `${baseUrl}/`

    return new URL(
        path.replace(/^\//, ""),
        normalizedBaseUrl,
    )
}

function assertHttpOk(
    response: Response,
): void {
    if (response.ok) {
        return
    }

    throw new DarApiError(
        `dar-autocomplete: request failed with HTTP ${response.status}`,
        response.status,
    )
}