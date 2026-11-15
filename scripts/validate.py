"""Validate the public dataset without making network requests (Python 3.10+)."""
from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
COUNTRIES = {"Germany", "Canada", "UK", "Netherlands", "Sweden", "Finland", "Australia", "Malaysia", "Turkey", "USA"}


def validate_records(records, *, min_count=30, require_coverage=True, today=None):
    """Return all actionable errors; unknown facts are legitimate, invented defaults are not."""
    if not isinstance(records, list):
        return ["Dataset must be a JSON array"]
    today = today or date.today()
    schema = json.loads((ROOT / "data/program.schema.json").read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = []
    seen = set()
    countries = set()
    if len(records) < min_count:
        errors.append(f"Expected at least {min_count} programs, got {len(records)}")
    for index, record in enumerate(records):
        label = f"record[{index}]"
        shape_errors = list(validator.iter_errors(record))
        if shape_errors:
            errors.extend(f"{label} {'/'.join(map(str, e.path))}: {e.message}" for e in shape_errors)
            continue
        identifier = record["id"]
        label = identifier
        if identifier in seen:
            errors.append(f"{label}: duplicate id")
        seen.add(identifier)
        countries.add(record["country"])
        if date.fromisoformat(record["last_verified"]) > today:
            errors.append(f"{label}: last_verified must not be in the future")
        sources = {source["url"] for source in record["sources"]}
        urls = sources | {record["program_url"]}
        if not any("program" in source["fields"] for source in record["sources"]):
            errors.append(f"{label}: an opened program source is required")
        for field, fact_key in [("annual_tuition", "amount"), ("deadline", "date"), ("language", "ielts_overall"), ("gre", "status")]:
            fact = record[field]
            source = fact["source_url"]
            if source:
                urls.add(source)
                if source not in sources:
                    errors.append(f"{label}: {field}.source_url is missing from sources")
            established = fact[fact_key] is not None and not (field == "gre" and fact[fact_key] == "unknown")
            if established and not source:
                errors.append(f"{label}: established {field} requires a source_url")
        tuition = record["annual_tuition"]
        if (tuition["amount"] is None) != (tuition["basis"] == "unknown"):
            errors.append(f"{label}: unknown tuition needs null amount and unknown basis together")
        for scholarship in record["scholarships"]:
            urls.add(scholarship["url"])
            if scholarship["url"] not in sources:
                errors.append(f"{label}: scholarship URL is missing from sources")
        for url in urls:
            parts = urlsplit(url)
            if parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
                errors.append(f"{label}: unsafe source URL {url!r}")
    missing = COUNTRIES - countries
    if require_coverage and missing:
        errors.append("Missing required countries: " + ", ".join(sorted(missing)))
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", type=Path, default=ROOT / "data/programs.json")
    args = parser.parse_args()
    try:
        records = json.loads(args.path.read_text(encoding="utf-8"))
        errors = validate_records(records)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Validation failed: {error}\n")
    if errors:
        parser.exit(1, "Validation failed:\n- " + "\n- ".join(errors) + "\n")
    print(f"Valid: {len(records)} source-linked programs across {len({r['country'] for r in records})} countries")


if __name__ == "__main__":
    main()
