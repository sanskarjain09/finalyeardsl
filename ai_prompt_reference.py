#!/usr/bin/env python3
"""
Gemini-based .st generator and DSL prompt reference.

What this script gives you:
1) Full DSL tag catalog and purpose.
2) Prompt template used for .st generation.
3) Real AI call to Gemini and .st file creation inside `example/`.

Usage:
  python3 ai_prompt_reference.py --show-tags
  python3 ai_prompt_reference.py "build todo app with login and per-user CRUD"
  python3 ai_prompt_reference.py --name crm-app.st "build CRM app with auth and leads CRUD"
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import time
from textwrap import dedent
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


TAG_REFERENCE = {
    "Root/System": {
        "app": "Root app container",
        "config": "Global app config",
        "client": "Browser-side UI and interactions",
        "server": "Backend-side declarative blocks",
        "route": "Page or route-level definition",
    },
    "UI Rendering": {
        "text": "Text element (similar to span/p)",
        "box": "Generic container (div-like)",
        "row": "Horizontal flex container",
        "column": "Vertical flex container",
        "button": "Action button",
        "input": "Input field",
        "image": "Image",
        "link": "Hyperlink",
        "video": "Video media",
        "audio": "Audio media",
        "card": "Card-style container",
        "section": "Content section",
        "navbar": "Navigation bar",
        "footer": "Footer container",
    },
    "Logic": {
        "if": "Conditional rendering",
        "else": "Fallback branch for condition",
        "for": "Loop over list/data source",
    },
    "State/Data": {
        "state": "Local reactive state",
        "store": "Global state store",
        "computed": "Derived/computed value",
    },
    "Component": {
        "component": "Reusable component declaration",
        "slot": "Slot for component content projection",
    },
    "API/Backend": {
        "api": "HTTP endpoint definition",
        "middleware": "Request middleware chain",
        "response": "Structured endpoint response",
    },
    "Database": {
        "db": "Database connection type/config",
        "model": "Data model definition",
        "field": "Model field definition",
        "query": "Named query block",
    },
}


ATTRIBUTE_REFERENCE = {
    "click": "Click event handler expression",
    "change": "Input change handler expression",
    "input": "Live input handler expression",
    "submit": "Form submit handler expression",
    "model": "Two-way binding with state",
    "if": "Inline conditional render",
    "each": "Inline loop expression",
    "id": "Element id",
    "class": "CSS classes",
    "style": "Inline style",
    "name": "State/model/component name",
    "value": "Default/initial value",
    "src": "Media source",
    "href": "Hyperlink target",
    "width": "Width",
    "height": "Height",
    "bg": "Background style shortcut",
    "color": "Text color style shortcut",
    "padding": "Padding style shortcut",
    "margin": "Margin style shortcut",
    "gap": "Gap style shortcut",
    "center": "Alignment style shortcut",
}


PROMPT_TEMPLATE = dedent(
    """
    You are an expert TTS Markup DSL code generator.
    Output only valid .st DSL code. Do not add markdown fences or explanation.

    Requirements:
    - Use a single <app> root.
    - Prefer tags: <db>, <schema>, <state>, <api>, <client>, <row>, <column>, <input>, <button>, <if>, <for>, <card>.
    - Use only runtime-safe tags. Avoid unsupported control tags.
    - Never use tags: <script>, <route>, <store>, <on>, <set>, <call>, <try>, <catch>, <component>, <slot>, <middleware>, <response>, <model>, <field>.
    - If authentication/data app is requested, include working register/login APIs and per-user data isolation.
    - For CRUD requests, include create/read/update/delete endpoints and matching UI interactions.
    - Keep syntax consistent with tag-based DSL and event attributes.

    DSL Tags and Purpose:
    {tag_reference}

    Core Attributes:
    {attribute_reference}

    User Prompt:
    {user_prompt}
    """
).strip()

FORBIDDEN_TAGS = (
    "script",
    "route",
    "store",
    "on",
    "set",
    "call",
    "try",
    "catch",
    "component",
    "slot",
    "middleware",
    "response",
    "model",
    "field",
)

DEFAULT_MODEL_CANDIDATES = (
    "gemini-flash-latest",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
)


def format_tag_reference() -> str:
    lines: list[str] = []
    for group, tags in TAG_REFERENCE.items():
        lines.append(f"- {group}:")
        for name, purpose in tags.items():
            lines.append(f"  - <{name}>: {purpose}")
    return "\n".join(lines)


def format_attribute_reference() -> str:
    lines = [f"- {name}: {purpose}" for name, purpose in ATTRIBUTE_REFERENCE.items()]
    return "\n".join(lines)


def build_generation_prompt(user_prompt: str) -> str:
    return PROMPT_TEMPLATE.format(
        tag_reference=format_tag_reference(),
        attribute_reference=format_attribute_reference(),
        user_prompt=user_prompt.strip(),
    )


def get_api_key() -> str:
    return (
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or os.getenv("GOOGLE_GENAI_API_KEY")
        or ""
    )


def strip_fences(text: str) -> str:
    content = text.strip()
    if content.startswith("```") and content.endswith("```"):
        lines = content.splitlines()
        if len(lines) >= 3:
            return "\n".join(lines[1:-1]).strip()
    return content


def find_forbidden_tags(code: str) -> list[str]:
    lower = code.lower()
    found: list[str] = []
    for tag in FORBIDDEN_TAGS:
        if f"<{tag}" in lower and tag not in found:
            found.append(tag)
    return found


def call_gemini(prompt: str, model: str, api_key: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.4,
            "topP": 0.9,
            "maxOutputTokens": 8192,
        },
    }

    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=120) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini API HTTP error {error.code}: {details}") from error
    except URLError as error:
        raise RuntimeError(f"Gemini API network error: {error}") from error

    parsed = json.loads(raw)
    candidates = parsed.get("candidates", [])
    if not candidates:
        raise RuntimeError("Gemini returned no candidates.")

    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts).strip()
    if not text:
        raise RuntimeError("Gemini returned empty text.")
    return strip_fences(text)


def build_model_candidates(requested_model: str) -> list[str]:
    candidates: list[str] = []
    requested = (requested_model or "").strip()
    if requested:
        candidates.append(requested)

    for model in DEFAULT_MODEL_CANDIDATES:
        if model not in candidates:
            candidates.append(model)

    extra_models = os.getenv("GEMINI_FALLBACK_MODELS", "").strip()
    if extra_models:
        for model in [m.strip() for m in extra_models.split(",") if m.strip()]:
            if model not in candidates:
                candidates.append(model)
    return candidates


def call_gemini_with_fallback(prompt: str, requested_model: str, api_key: str) -> tuple[str, str]:
    candidates = build_model_candidates(requested_model)
    last_error: Exception | None = None

    for model in candidates:
        for attempt in range(2):
            try:
                return call_gemini(prompt, model, api_key), model
            except RuntimeError as error:
                message = str(error).lower()
                last_error = error
                # 503 is usually transient; retry once on same model.
                if "http error 503" in message and attempt == 0:
                    time.sleep(2)
                    continue
                # 429/quota or other errors: move to next model immediately.
                break

    if last_error:
        raise RuntimeError(
            "All model attempts failed. Last error: "
            f"{last_error}"
        ) from last_error
    raise RuntimeError("All model attempts failed.")


def normalize_file_name(name: str) -> str:
    base = Path(name).name.strip() or "generated-app.st"
    if not base.endswith(".st"):
        base = f"{base}.st"
    return base


def generate_to_example(user_prompt: str, model: str, out_name: str) -> tuple[Path, str]:
    api_key = get_api_key()
    if not api_key:
        raise RuntimeError(
            "Missing API key. Set GEMINI_API_KEY (or GOOGLE_API_KEY / GOOGLE_GENAI_API_KEY)."
        )

    final_prompt = build_generation_prompt(user_prompt)
    generated, used_model = call_gemini_with_fallback(final_prompt, model, api_key)
    if "<app" not in generated.lower():
        app_fix_prompt = dedent(
            f"""
            Convert the following output to valid TTS Markup DSL.
            Rules:
            - Output only DSL code.
            - Must have exactly one <app> root and closing </app>.
            - Keep feature intent unchanged.

            CONTENT:
            {generated}
            """
        ).strip()
        generated, used_model = call_gemini_with_fallback(app_fix_prompt, used_model, api_key)
        if "<app" not in generated.lower():
            raise RuntimeError("Generated output does not look like valid DSL (<app> missing).")

    forbidden = find_forbidden_tags(generated)
    if forbidden:
        repair_prompt = dedent(
            f"""
            Rewrite the following TTS Markup code so that it uses only runtime-safe tags.
            Keep app behavior same, but remove unsupported tags.
            Allowed tags: <app>, <db>, <schema>, <query>, <state>, <api>, <client>, <if>, <else>, <for>, <row>, <column>, <box>, <card>, <text>, <button>, <input>, <section>, <navbar>, <footer>, <image>, <link>, <video>, <audio>.
            Forbidden tags found: {", ".join(forbidden)}.
            Output only corrected .st code, no explanation.

            CODE TO REWRITE:
            {generated}
            """
        ).strip()
        generated, used_model = call_gemini_with_fallback(repair_prompt, used_model, api_key)
        forbidden_after = find_forbidden_tags(generated)
        if forbidden_after:
            raise RuntimeError(
                "Generated code still contains unsupported tags: "
                + ", ".join(forbidden_after)
            )

    repo_root = Path(__file__).resolve().parent
    example_dir = repo_root / "example"
    example_dir.mkdir(parents=True, exist_ok=True)
    file_path = example_dir / normalize_file_name(out_name)
    file_path.write_text(generated, encoding="utf-8")
    return file_path, used_model


def main() -> None:
    parser = argparse.ArgumentParser(description="TTS Markup DSL prompt reference helper")
    parser.add_argument("prompt", nargs="*", help="User prompt from CLI/terminal")
    parser.add_argument(
        "--show-tags",
        action="store_true",
        help="Print tags and attributes reference only",
    )
    parser.add_argument(
        "--preview-prompt",
        action="store_true",
        help="Print final merged prompt instead of generating file",
    )
    parser.add_argument(
        "--name",
        default="generated-app.st",
        help="Output file name inside example/ (default: generated-app.st)",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("GEMINI_MODEL", "gemini-flash-latest"),
        help="Preferred Gemini model id (fallback models are used automatically)",
    )
    args = parser.parse_args()

    if args.show_tags:
        print("DSL TAGS")
        print(format_tag_reference())
        print("\nDSL ATTRIBUTES")
        print(format_attribute_reference())
        return

    user_prompt = " ".join(args.prompt).strip()
    if not user_prompt:
        user_prompt = input("Describe the .st app you want to generate: ").strip()
    if not user_prompt:
        raise RuntimeError("Prompt is required.")

    if args.preview_prompt:
        print(build_generation_prompt(user_prompt))
        return

    output, used_model = generate_to_example(user_prompt, args.model, args.name)
    print(f"Generated: {output} (model: {used_model})")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(f"Error: {error}")
        raise SystemExit(1)
