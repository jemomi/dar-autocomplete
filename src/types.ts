export type DarSearchResult =
    | DarStreetResult
    | DarStreetPostalCodeResult
    | DarHouseNumberResult
    | DarAddressResult

export interface DarStreetResult {
    type: "vejnavn"
    titel: string
    vejnavn: string
}

export interface DarStreetPostalCodeResult {
    type: "navngivenvejpostnummer"
    id: string
    titel: string
    vejnavn: string
    postnr: string
    postdistrikt: string
    antal_husnumre: number
}

export interface DarHouseNumberResult {
    type: "husnummer"
    id: string
    titel: string
    vejnavn: string
    husnummer: string
}

export interface DarAddressResult {
    type: "adresse"
    id: string
    titel: string
    husnummerId: string
}

export interface DarSearchResponse {
    status: "ok" | "fejl"
    beskrivelse: string
    fund: DarSearchResult[]
}

export interface DarSearchOptions {
    maxResults?: number
    municipalityCode?: string
    includeProvisional?: boolean
    signal?: AbortSignal
}

export interface DarRequestOptions {
    signal?: AbortSignal
}

export interface DarAddress {
    id_lokalid: string
    adressebetegnelse: string
    etagebetegnelse: string | null
    doerbetegnelse: string | null
    status: string
    virkningfra: string
    virkningtil: string | null
    registreringfra: string
    registreringtil: string | null
    husnummer: DarAddressHouseNumber
}

export interface DarAddressHouseNumber {
    id_lokalid: string
    husnummertekst: string
    adgangsadressebetegnelse: string
    vejnavn: string
    status: string
    virkningfra: string
    virkningtil: string | null
    registreringfra: string
    registreringtil: string | null

    adgangspunkt?: {
        id_lokalid: string
        koordinater: {
            x: number
            y: number
        }
        [key: string]: unknown
    }

    postnummer?: {
        id_lokalid: string
        navn: string
        postnr: string
        [key: string]: unknown
    }

    [key: string]: unknown
}

export type DarAddressResponse =
    | {
    status: "ok"
    adresse: DarAddress
}
    | {
    status: "fejl"
    beskrivelse: string
}