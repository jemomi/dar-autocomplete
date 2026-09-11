import type {
  AdressevaelgerAddressResponse,
  AdressevaelgerSearchResponse,
  DarAddressDetails,
  DarSearchOptions,
  DarSearchResultType,
  DarSuggestion
} from './types.js'

export interface DarClient {
  search(query: string, options?: DarSearchOptions): Promise<DarSuggestion[]>
  getAddress(id: string, signal?: AbortSignal): Promise<DarAddressDetails>
}

export interface AdressevaelgerClientOptions {
  token: string
  baseUrl?: string
  fetch?: typeof globalThis.fetch
}

export interface ProxyClientOptions {
  baseUrl?: string
  fetch?: typeof globalThis.fetch
}

const supportedTypes = new Set<DarSearchResultType>([
  'adresse',
  'husnummer',
  'vejnavn',
  'navngivenvejpostnummer'
])

function requireFetch(customFetch?: typeof globalThis.fetch): typeof globalThis.fetch {
  const fetcher = customFetch ?? globalThis.fetch
  if (!fetcher) throw new Error('No fetch implementation is available')
  return fetcher
}

function cleanBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`DAR request failed (${response.status})`)
  return response.json() as Promise<T>
}

function normalizeSearchResponse(response: AdressevaelgerSearchResponse, limit: number): DarSuggestion[] {
  if (response.status !== 'ok' || !Array.isArray(response.fund)) {
    throw new Error(response.beskrivelse || 'Adressevaelger returned an invalid search response')
  }

  return response.fund.flatMap<DarSuggestion>((item) => {
    const type = item.type as DarSearchResultType | undefined
    const title = item.titel?.trim()
    if (!type || !title || !supportedTypes.has(type)) return []

    if (type === 'adresse') {
      const id = item.id?.trim()
      return id ? [{ type, id, title }] : []
    }

    return [{ type, title }]
  }).slice(0, limit)
}

/**
 * Direct Adressevaelger client.
 *
 * Note: when used in a browser, `token` is visible to the end user. Only use
 * this mode with a token that is intended to be public/client-side.
 */
export function createAdressevaelgerClient(options: AdressevaelgerClientOptions): DarClient {
  const token = options.token.trim()
  if (!token) throw new Error('An Adressevaelger token is required')

  const baseUrl = cleanBaseUrl(options.baseUrl ?? 'https://adressevaelger.dk')
  const fetcher = requireFetch(options.fetch)

  return {
    async search(query, { limit = 10, signal } = {}) {
      const text = query.trim()
      if (!text) return []

      const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20)
      const url = new URL(`${baseUrl}/adresser/soeg`)
      url.searchParams.set('tekst', text)
      url.searchParams.set('maksimum', String(safeLimit))
      url.searchParams.set('token', token)

      const response = await fetcher(url, signal ? { signal } : undefined)
      return normalizeSearchResponse(await readJson<AdressevaelgerSearchResponse>(response), safeLimit)
    },

    async getAddress(id, signal) {
      const addressId = id.trim()
      if (!addressId) throw new Error('Address id is required')

      const url = new URL(`${baseUrl}/adresser/${encodeURIComponent(addressId)}`)
      url.searchParams.set('token', token)
      const response = await readJson<AdressevaelgerAddressResponse>(await fetcher(url, signal ? { signal } : undefined))
      const address = response.adresse
      const resolvedId = address?.id_lokalid?.trim()
      const title = address?.adressebetegnelse?.trim()

      if (response.status !== 'ok' || !resolvedId || !title) {
        throw new Error(response.beskrivelse || 'Adressevaelger returned an invalid address response')
      }

      const postnummer = address?.husnummer?.postnummer?.postnr?.trim()
      return { id: resolvedId, title, ...(postnummer ? { postnummer } : {}) }
    }
  }
}

/**
 * Client for a server-side proxy exposing:
 *   GET {baseUrl}/search?q=...&limit=...
 *   GET {baseUrl}/{id}
 *
 * Use this when the Adressevaelger token must remain private.
 */
export function createProxyClient(options: ProxyClientOptions = {}): DarClient {
  const baseUrl = cleanBaseUrl(options.baseUrl ?? '/api/address')
  const fetcher = requireFetch(options.fetch)

  return {
    async search(query, { limit = 10, signal } = {}) {
      const params = new URLSearchParams({ q: query.trim(), limit: String(limit) })
      return readJson<DarSuggestion[]>(await fetcher(`${baseUrl}/search?${params}`, signal ? { signal } : undefined))
    },
    async getAddress(id, signal) {
      return readJson<DarAddressDetails>(await fetcher(`${baseUrl}/${encodeURIComponent(id)}`, signal ? { signal } : undefined))
    }
  }
}
