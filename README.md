# HyperHTML Prototype (DSL MVP v3)

A tag-based HTML extension DSL where one `.hhtml` file can define:

- UI tags (`<text>`, `<row>`, `<column>`, `<box>`, `<card>`, `<button>`, `<input>`)
- Logic (`<if>`, `<else>`, `<for>`, and inline `if` / `each` attributes)
- State (`<state name="..." value="..."/>`)
- Backend APIs (`<api route="..." method="...">`)
- Database + schema (`<db>`, `<schema>`)

## Run the full Todo app

```bash
npm install
npm run dev -- example/todo-app.hhtml 3000
```

Open `http://localhost:3000`.

This single DSL file includes:

- User register/login/logout
- Per-user SQLite persistence
- Todo CRUD from frontend (`create`, `list`, `update`, `toggle`, `delete`)

Database file gets created automatically at:

- `example/todo-app.db`

## Also available

- `example/app.hhtml` (smaller syntax demo)

## Supported Tags (MVP)

- Root/System: `<app>`, `<client>`, `<server>`, `<api>`, `<db>`, `<query>`, `<state>`
- UI: `<text>`, `<box>`, `<row>`, `<column>`, `<button>`, `<input>`, `<card>`, plus native HTML tags
- Logic: `<if>`, `<else>`, `<for each="...">`

## Supported Attributes (MVP)

- Reactivity: `click`, `model`, `if`, `each`
- Common: `id`, `class`, `style`, `name`, `value`, `src`, `href`, `width`, `height`, `type`
- Style shortcuts: `bg`, `color`, `padding`, `margin`, `gap`, `center`

## Runtime helpers in expressions

- `$post('/api/route', payload)` for JSON POST requests
- `{{expression}}` interpolation support

## Notes

This is an experimental compiler/runtime. Next hardening steps:

1. Secure expression sandbox (replace raw `new Function`).
2. Password hashing + proper auth tokens.
3. Role-based access and route guards.
4. Hot reload and multi-file component imports.
5. Type-checking for DSL blocks.
