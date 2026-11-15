# Contributing to CyberAbroad

Thanks for helping international cybersecurity students compare real options. Correctness and clear uncertainty matter more than record count.

## Add or update a record

1. Find the current **official university program page**. Confirm the qualification, campus/mode, relevant security specialisation, and whether international students can use that route. Do not silently replace a cybersecurity degree with generic computer science.
2. Open official admissions, fee, language, scholarship, and document pages as needed. Search snippets, agents' memory, and third-party directories are not evidence. Official national admissions portals are acceptable where the university delegates applications to them.
3. Copy a similar object in `data/programs.json` and use the exact fields in [the schema](data/program.schema.json). Use a stable, unique lowercase ID; do not regenerate IDs when titles change because shortlists depend on them.
4. Attach every reviewed URL to `sources` with a title and the fields it supports. Each established fee/date/IELTS/GRE fact needs a `source_url` present in that list; scholarship URLs must also appear there. Summarize/paraphrase evidence rather than copying long passages.
5. Set `last_verified` only to the date you actually reviewed the cited sources. Explain unconfirmed details, program substitutions, historical data, conditional admission, joint-degree mobility, and restricted international routes in `verification_notes`.
6. Run validation/tests and regenerate `data/programs.csv`. Submit a small PR with your official links and the specific corrections.

## Field guide

| Field | Evidence and uncertainty rule |
|---|---|
| `university`, `country`, `program`, `degree` | Use the current official title and qualification. Identify a security track or joint route explicitly, not as a standalone degree it is not. |
| `annual_tuition` | International/non-EU rate in the original currency, with the **published academic year**, audience, and compulsory extra-charge caveats. Unknown amount is `null` with `basis: "unknown"`. Zero requires an explicit no-tuition source; semester contributions are not silently ignored. |
| Tuition estimate | Use `annualized_estimate` only for a calculation from an official total and a fixed duration; put the exact arithmetic and limitations in `notes`. Do not mix per-credit, semester, total-program, and annual amounts without conversion evidence. Never invent currency conversions. |
| `deadline` | Full ISO date (`YYYY-MM-DD`) tied to the identified international intake/cycle and route. A recurring month/day without an intake year stays `null`. Rolling, unpublished, nationality-dependent, and unclear cutoffs stay `null` with notes. Historical dates may stay with an explicit closed/historical label; do not roll them forward. |
| `language` | Official IELTS Academic overall minimum or `null`. Include band minima, accepted alternatives/exemptions, and teaching language in notes. IELTS alone is never a full admission assessment. |
| `scholarships` | Named official opportunities with links and precise eligibility/restrictions. Do not claim all nationalities or master's students qualify without evidence. `[]` means none established in the reviewed sources, not “no scholarships exist.” |
| `required_documents` | Ground requirements in an official checklist. If a program-specific checklist is unavailable, include a clearly labeled “not verified” note instead of manufacturing a definitive list. |
| `gre` | Explicit `required`, `not_required`, or `optional` only when an official source supports it; otherwise `unknown`. Omission from a short marketing page is not a waiver. |
| `last_verified` | Actual review date, never a future date or a date automatically refreshed by a build. It does not imply that every nullable field was confirmed. |

## Withdrawn or renamed courses

Do not keep a closed course looking like an active application opportunity. Verify a real cybersecurity successor or remove it in a reviewed replacement PR that preserves the dataset's minimum country/record coverage. Explain renames and specialisations. Historical deadlines on still-existing courses are different from a university discontinuing admissions entirely.

## Checks

```sh
python -m pip install -r requirements-dev.txt
python scripts/validate.py
python -m unittest discover -s tests -p 'test_*.py' -v
npm run check
npm test
python scripts/export_csv.py
```

CI does not fetch every source, guarantee admissions accuracy, or automatically refresh the research date. Maintainers review the primary evidence, specificity, and fair comparison semantics. Keep all ten requested countries and at least thirty records unless a separately agreed change revises the scope.

## Frontend changes

Keep the site usable on phones and with a keyboard. Preserve explicit unknown/closed labels, native-currency budgets, safe HTTPS links, HTML escaping, spreadsheet-formula protection, compare limit of three, and resilience to unavailable browser storage. Add regression tests. Do not add analytics, application forms, secrets, scraping services, or personal student information.

## Report a correction

Open an issue describing the record ID, disputed field, official source, applicable intake/fee year, and proposed change. Do not paste private admission letters or personal documents. Security issues follow [SECURITY.md](SECURITY.md).
