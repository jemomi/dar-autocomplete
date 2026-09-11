import test from 'node:test'
import assert from 'node:assert/strict'
import { createDarAutocompleteController } from '../dist/controller.js'

const client = {
  async search() { return [] },
  async getAddress(id) { return { id, title: 'Testvej 1, 1000 København K' } }
}

test('selects a final address', () => {
  let value = null
  const controller = createDarAutocompleteController({
    client,
    getOptions: () => ({}),
    onStateChange: () => {},
    onChange: next => { value = next }
  })
  controller.select({ type: 'adresse', id: '1', title: 'Testvej 1' })
  assert.deepEqual(value, { id: '1', title: 'Testvej 1' })
  assert.equal(controller.state.query, 'Testvej 1')
})

test('uses non-address result types as refinements', () => {
  let changeCount = 0
  const controller = createDarAutocompleteController({
    client,
    getOptions: () => ({}),
    onStateChange: () => {},
    onChange: () => { changeCount++ }
  })
  controller.select({ type: 'vejnavn', title: 'Nørrevænget' })
  assert.equal(controller.state.value, null)
  assert.equal(controller.state.query, 'Nørrevænget ')
  assert.equal(changeCount, 0)
})
