"""Build a spreadsheet-safe CSV without losing uncertainty and source context."""
from __future__ import annotations

import csv
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COLUMNS = ["id", "university", "country", "program", "degree", "annual_tuition", "currency", "fee_year", "tuition_basis", "tuition_notes", "deadline", "deadline_cycle", "deadline_notes", "ielts_overall", "language_notes", "scholarships_and_eligibility", "scholarships_note", "required_documents", "gre", "gre_notes", "program_url", "last_verified", "verification_notes", "sources"]


def safe_cell(value):
    text = "" if value is None else str(value)
    if text.lstrip().startswith(("=", "+", "-", "@")) or text.startswith(("\t", "\r", "\n")):
        return "'" + text
    return text


def to_csv(records):
    out = io.StringIO(newline="")
    writer = csv.DictWriter(out, fieldnames=COLUMNS, lineterminator="\r\n")
    writer.writeheader()
    for row in records:
        fee, deadline, lang = row["annual_tuition"], row["deadline"], row["language"]
        flattened = {
            "id": row["id"], "university": row["university"], "country": row["country"], "program": row["program"], "degree": row["degree"],
            "annual_tuition": fee["amount"], "currency": fee["currency"], "fee_year": fee["fee_year"], "tuition_basis": fee["basis"], "tuition_notes": fee["notes"],
            "deadline": deadline["date"], "deadline_cycle": deadline["cycle"], "deadline_notes": deadline["notes"], "ielts_overall": lang["ielts_overall"], "language_notes": lang["notes"],
            "scholarships_and_eligibility": " | ".join(f"{s['name']}: {s['eligibility']} ({s['url']})" for s in row["scholarships"]),
            "scholarships_note": row["scholarships_note"], "required_documents": " | ".join(row["required_documents"]),
            "gre": row["gre"]["status"], "gre_notes": row["gre"]["notes"], "program_url": row["program_url"], "last_verified": row["last_verified"],
            "verification_notes": row["verification_notes"], "sources": " | ".join(s["url"] for s in row["sources"]),
        }
        writer.writerow({key: safe_cell(value) for key, value in flattened.items()})
    return "\ufeff" + out.getvalue()


if __name__ == "__main__":
    records = json.loads((ROOT / "data/programs.json").read_text(encoding="utf-8"))
    path = ROOT / "data/programs.csv"
    path.write_text(to_csv(records), encoding="utf-8", newline="")
    print(f"Exported {len(records)} records to {path.relative_to(ROOT)}")
