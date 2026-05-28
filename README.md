# todoDSL

`todoDSL` is your HTML-extension DSL runtime where one `.st` file can contain:

- frontend UI tags
- backend APIs
- database schema
- auth logic
- per-user CRUD flows

This project already includes a complete Todo app with login/register and SQLite persistence.

## Folder

- Project path: `/Users/sanskarjain/Desktop/todoDSL`
- Full Todo app DSL file: `/Users/sanskarjain/Desktop/todoDSL/example/todo-app.st`
- SQLite DB created at runtime: `/Users/sanskarjain/Desktop/todoDSL/example/todo-app.db`

## Install

```bash
cd /Users/sanskarjain/Desktop/todoDSL
npm install
npm run build
```

## Use From Anywhere (Global CLI)

```bash
cd /Users/sanskarjain/Desktop/todoDSL
npm run link:global
```

Then from **any folder**:

```bash
tododsl run /absolute/path/to/app.st 3000
```

or:

```bash
tododsl /absolute/path/to/app.st 3000
```

## Run Included Todo Website

```bash
tododsl run /Users/sanskarjain/Desktop/todoDSL/example/todo-app.st 3000
```

Open:

- `http://localhost:3000`

Features in this website:

- Register
- Login / Logout
- User-specific todo list
- Create / Read / Update / Toggle / Delete todos
- SQLite database auto-create and persistence

## Create Your Own DSL Website Anywhere

1. Create any file, e.g. `/Users/sanskarjain/Desktop/myapps/shop.st`.
2. Write your `<app> ... </app>` DSL.
3. Run:

```bash
tododsl run /Users/sanskarjain/Desktop/myapps/shop.st 4000
```

## CLI Help

```bash
tododsl --help
```
