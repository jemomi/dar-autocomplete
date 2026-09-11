# dar-autocomplete

Framework-agnostic autocomplete for Danish addresses using Adressevaelger.dk.

## Install

```bash
npm install dar-autocomplete
```

## Browser / native JavaScript

```html
<label for="address">Adresse</label>
<input id="address" name="address" required>
```

```ts
import { attachDarAutocomplete } from 'dar-autocomplete/browser'
import 'dar-autocomplete/style.css'

const autocomplete = attachDarAutocomplete(
  document.querySelector<HTMLInputElement>('#address')!,
  {
    token: 'your-client-token',
    onChange(address) {
      console.log(address) // { id, title } or null
    }
  }
)
```

The existing input stays the real form field. Selecting a final address updates its visible text. `autocomplete.value` contains the selected address id/title.

Available methods:

```ts
autocomplete.value
autocomplete.validate()
autocomplete.clear()
autocomplete.focus()
autocomplete.destroy()
```

### Important: browser tokens are public

A token passed to browser JavaScript cannot be secret. If your Adressevaelger token must remain private, put it on your server and pass a proxy client instead:

```ts
import { createProxyClient } from 'dar-autocomplete'
import { attachDarAutocomplete } from 'dar-autocomplete/browser'

attachDarAutocomplete(input, {
  client: createProxyClient({ baseUrl: '/api/address' })
})
```

The proxy contract is intentionally tiny:

- `GET /api/address/search?q=fund&limit=10` -> `DarSuggestion[]`
- `GET /api/address/:id` -> `{ id, title, postnummer? }`

_This will be expanded later!_

## Direct client

```ts
import { createAdressevaelgerClient } from 'dar-autocomplete'

const client = createAdressevaelgerClient({ token: '...' })
const suggestions = await client.search('fund')
```

Search results retain Adressevaelger's supported result types:

- `adresse` is a selectable final address and has an `id`.
- `husnummer`, `vejnavn` and `navngivenvejpostnummer` are refinement suggestions. Selecting one continues the search with that text.

## Options

`attachDarAutocomplete(input, options)` accepts:

- `client` - custom `DarClient`. Takes precedence over direct token settings.
- `token` - token for direct Adressevaelger browser requests.
- `baseUrl` - defaults to `https://adressevaelger.dk`.
- `value` - initial `{ id, title }` value.
- `initialAddressId` - loads an initial address by id.
- `required`, `disabled`, `error`.
- `minSearchLength` - default `2`.
- `debounceMs` - default `250`.
- `maxSuggestions` - default `10`, provider requests are capped at `20`.
- `onChange(value)` - called for selection and when an edited selection becomes invalid.
- `onSelect(value)` - called only when a final address is selected.

## Accessibility

The browser adapter implements the combobox/listbox ARIA pattern, keyboard navigation, live status messages, native form validity, `required`, `disabled`, `readonly`, form reset, and cleanup through `destroy()`.

## Future and improvements

- [ ] `Documentation` - JSDoc, Comments, README, Examples, Customization/Styling
- [ ] Tests
- [ ] Vue/Nuxt component
- [ ] React/NextJS component
- [ ] Web-components component
- [ ] Typing improvements
- [ ] More data
- [ ] Dark-mode support

Want more, or have suggestions? - Feel free to open an issue.