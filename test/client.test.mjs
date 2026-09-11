import test from 'node:test'
import assert from 'node:assert/strict'
import { createAdressevaelgerClient } from '../dist/client.js'

test('preserves supported search result types', async () => {
  const fetch = async () => new Response(JSON.stringify({
    status: 'ok',
    fund: [
      { type: 'vejnavn', titel: 'Nørrevænget' },
      { type: 'navngivenvejpostnummer', titel: 'Nørrevænget, 8600 Silkeborg' },
      { type: 'husnummer', titel: 'Nørrevænget 47A, 8600 Silkeborg' },
      { type: 'adresse', id: 'abc', titel: 'Nørrevænget 47A, 8600 Silkeborg' }
    ]
  }), { status: 200 })

  const client = createAdressevaelgerClient({ token: 'test', fetch })
  assert.deepEqual(await client.search('fund'), [
    { type: 'vejnavn', title: 'Nørrevænget' },
    { type: 'navngivenvejpostnummer', title: 'Nørrevænget, 8600 Silkeborg' },
    { type: 'husnummer', title: 'Nørrevænget 47A, 8600 Silkeborg' },
    { type: 'adresse', id: 'abc', title: 'Nørrevænget 47A, 8600 Silkeborg' }
  ])
})

test('uses the expected provider query parameters', async () => {
  let requestedUrl
  const fetch = async (url) => {
    requestedUrl = new URL(String(url))
    return new Response(JSON.stringify({ status: 'ok', fund: [] }), { status: 200 })
  }
  const client = createAdressevaelgerClient({ token: 'client-token', fetch })
  await client.search('nørre', { limit: 7 })
  assert.equal(requestedUrl.pathname, '/adresser/soeg')
  assert.equal(requestedUrl.searchParams.get('tekst'), 'nørre')
  assert.equal(requestedUrl.searchParams.get('maksimum'), '7')
  assert.equal(requestedUrl.searchParams.get('token'), 'client-token')
})
