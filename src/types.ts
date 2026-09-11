export type DarSearchResultType =
  | 'adresse'
  | 'husnummer'
  | 'vejnavn'
  | 'navngivenvejpostnummer'

export interface DarAddressValue {
  id: string
  title: string
}

export interface DarAddressSuggestion {
  type: 'adresse'
  id: string
  title: string
}

export interface DarRefinementSuggestion {
  type: Exclude<DarSearchResultType, 'adresse'>
  title: string
}

export type DarSuggestion = DarAddressSuggestion | DarRefinementSuggestion

export interface DarSearchOptions {
  limit?: number
  signal?: AbortSignal
}

export interface DarAddressDetails extends DarAddressValue {
  postnummer?: string
}

export interface AdressevaelgerSearchResponse {
  status: string
  beskrivelse?: string
  fund?: Array<{
    type?: string
    id?: string
    titel?: string
  }>
}

export interface AdressevaelgerAddressResponse {
  status: string
  beskrivelse?: string
  adresse?: {
    id_lokalid?: string
    adressebetegnelse?: string
    husnummer?: {
      postnummer?: {
        postnr?: string
      }
    }
  }
}
