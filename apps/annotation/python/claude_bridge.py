#!/usr/bin/env python3
"""Bridge script for invoking Anthropic Claude from the annotation service."""

import json
import os
import sys


def read_payload() -> dict:
    try:
        raw = sys.stdin.read()
        return json.loads(raw) if raw else {}
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Failed to decode payload: {exc}") from exc


def extract_json_from_text(text: str) -> dict:
    if not text:
        return {}
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {"reasoning": text.strip()}
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return {"reasoning": text.strip()}


def main() -> None:
    payload = read_payload()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY environment variable is required")

    try:
        from anthropic import Anthropic
    except ImportError as exc:  # pragma: no cover - runtime dependency
        raise RuntimeError(
            "anthropic package is required. Install via `pip install anthropic`."
        ) from exc

    client = Anthropic(api_key=api_key)

    model = payload.get("model") or "claude-3-5-sonnet-20240620"
    system = payload.get("system") or "You are an annotation assistant returning JSON."
    prompt = payload.get("prompt")
    if not prompt:
        raise RuntimeError("prompt is required in payload")

    response = client.messages.create(
        model=model,
        max_output_tokens=400,
        temperature=0,
        system=system,
        messages=[{"role": "user", "content": prompt}]
    )

    text_parts = []
    for block in response.content:
        if getattr(block, "type", "") == "text":
            text_parts.append(block.text)

    annotation = extract_json_from_text("\n".join(text_parts))

    output = {
        "annotation": annotation,
        "model": response.model
    }

    sys.stdout.write(json.dumps(output))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pragma: no cover - ensure stderr gets message
        sys.stderr.write(f"Claude bridge failed: {exc}\n")
        sys.exit(1)
