# todoDSL

`todoDSL` is your HTML-extension DSL runtime where one `.st` file can contain:

- frontend UI tags
- backend APIs
- database schema
- auth logic
- per-user CRUD flows

This project already includes a complete Todo app with login/register and SQLite persistence.

## Folder

- Project path: `/Users/sanskarjain/Desktop/finalyear`
- Full Todo app DSL file: `/Users/sanskarjain/Desktop/finalyear/example/todo.st`
- SQLite DB created at runtime: `/Users/sanskarjain/Desktop/finalyear/example/todo.db`

## Install

```bash
cd /Users/sanskarjain/Desktop/finalyear
npm install
npm run build
```

## Use From Anywhere (Global CLI)

```bash
cd /Users/sanskarjain/Desktop/finalyear
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
tododsl run /Users/sanskarjain/Desktop/finalyear/example/todo.st 3000
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

## AI Generation via Python (Gemini -> `example/*.st`)

Set API key:

```bash
export GEMINI_API_KEY="your_api_key_here"
```

Print DSL tags and attributes reference:

```bash
python3 ai_prompt_reference.py --show-tags
```

Generate `.st` file from terminal prompt text (file is always created inside `example/`):

```bash
python3 ai_prompt_reference.py --name crm-app.st "Build a CRM app with login and leads CRUD"
```

Use a specific model (optional):

```bash
python3 ai_prompt_reference.py --model gemini-flash-latest --name crm-app.st "Build a CRM app with login and leads CRUD"
```

Interactive prompt mode:

```bash
python3 ai_prompt_reference.py --name my-app.st
```

Preview the final merged AI prompt without API call:

```bash
python3 ai_prompt_reference.py --preview-prompt "Build a todo app with login"
```

## CLI Help

```bash
tododsl --help
```
