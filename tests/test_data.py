"""Run with python -m unittest discover -s tests -p 'test_*.py'."""
import copy
import csv
import io
import json
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from validate import COUNTRIES, validate_records
from export_csv import safe_cell, to_csv


class DatasetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.records = json.loads((ROOT / "data/programs.json").read_text(encoding="utf-8"))

    def single(self, row):
        return validate_records([row], min_count=1, require_coverage=False, today=date(2100, 1, 1))

    def test_real_dataset_is_valid(self):
        self.assertEqual(validate_records(self.records), [])

    def test_country_coverage_and_count(self):
        self.assertGreaterEqual(len(self.records), 30)
        self.assertEqual({r["country"] for r in self.records}, COUNTRIES)

    def test_unique_identifiers(self):
        self.assertEqual(len({r["id"] for r in self.records}), len(self.records))

    def test_rejects_non_array(self):
        self.assertTrue(validate_records({}))

    def test_rejects_duplicate(self):
        rows = [copy.deepcopy(self.records[0])] * 2
        self.assertTrue(any("duplicate" in e for e in validate_records(rows, min_count=1, require_coverage=False)))

    def test_rejects_bad_date(self):
        row = copy.deepcopy(self.records[0]); row["deadline"]["date"] = "2027-02-30"
        self.assertTrue(self.single(row))

    def test_rejects_future_verification_date(self):
        row = copy.deepcopy(self.records[0]); row["last_verified"] = "2099-01-01"
        self.assertTrue(validate_records([row], min_count=1, require_coverage=False, today=date(2026, 11, 15)))

    def test_rejects_unproven_free_tuition(self):
        row = copy.deepcopy(self.records[0]); row["annual_tuition"].update(amount=0, basis="unknown")
        self.assertTrue(self.single(row))

    def test_rejects_unattributed_known_language_fact(self):
        row = copy.deepcopy(self.records[0]); row["language"].update(ielts_overall=6.5, source_url=None)
        self.assertTrue(self.single(row))

    def test_rejects_unsafe_urls(self):
        row = copy.deepcopy(self.records[0]); row["program_url"] = "javascript:alert(1)"
        self.assertTrue(self.single(row))

    def test_rejects_unknown_schema_fields(self):
        row = copy.deepcopy(self.records[0]); row["guaranteed_admission"] = True
        self.assertTrue(self.single(row))

    def test_unknowns_are_legitimate(self):
        row = copy.deepcopy(self.records[0])
        row["annual_tuition"].update(amount=None, basis="unknown")
        row["deadline"]["date"] = None
        row["language"]["ielts_overall"] = None
        row["gre"]["status"] = "unknown"
        self.assertEqual(self.single(row), [])

    def test_schema_enforces_ielts_range(self):
        row = copy.deepcopy(self.records[0]); row["language"]["ielts_overall"] = 9.5
        self.assertTrue(self.single(row))

    def test_csv_roundtrip_preserves_quotes_and_notes(self):
        row = copy.deepcopy(self.records[0]); row["university"] = 'Test, "University"\nCampus'
        decoded = list(csv.DictReader(io.StringIO(to_csv([row]).lstrip("\ufeff"))))
        self.assertEqual(decoded[0]["university"], row["university"])
        self.assertIn("verification_notes", decoded[0])

    def test_csv_formula_injection_protection(self):
        for value in ["=HYPERLINK(1)", "+cmd", "-cmd", "@SUM(1)", "  =1+1", "\t=1", "\rtest"]:
            with self.subTest(value=value): self.assertTrue(safe_cell(value).startswith("'"))
        self.assertEqual(safe_cell(None), "")
        self.assertEqual(safe_cell(0), "0")

    def test_checked_in_csv_is_reproducible(self):
        expected = to_csv(self.records).encode("utf-8")
        self.assertEqual((ROOT / "data/programs.csv").read_bytes(), expected)


if __name__ == "__main__":
    unittest.main()
