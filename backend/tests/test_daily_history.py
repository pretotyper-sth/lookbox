"""데일리 코디 날짜 키 — metadata.for_date 없을 때 created_at으로 보정."""

import ast
import unittest
from pathlib import Path
from typing import Any


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")


def load():
    tree = ast.parse(MAIN_PATH.read_text())
    fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "_outfit_for_date")
    ns: dict = {"Any": Any}
    exec(compile(ast.Module(body=[fn], type_ignores=[]), "<daily-history>", "exec"), ns)
    return ns["_outfit_for_date"]


OUTFIT_FOR_DATE = None


class OutfitForDateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        global OUTFIT_FOR_DATE
        OUTFIT_FOR_DATE = load()

    def test_uses_metadata_for_date(self):
        row = {"type": "daily", "metadata": {"for_date": "2026-08-28"}, "created_at": "2026-08-30T01:00:00Z"}
        self.assertEqual(OUTFIT_FOR_DATE(row), "2026-08-28")

    def test_backfills_from_created_at_for_daily(self):
        row = {"type": "daily", "metadata": {}, "created_at": "2026-08-27T15:30:00+09:00"}
        self.assertEqual(OUTFIT_FOR_DATE(row), "2026-08-27")

    def test_non_daily_without_for_date_returns_none(self):
        row = {"type": "manual", "metadata": {}, "created_at": "2026-08-27T15:30:00+09:00"}
        self.assertIsNone(OUTFIT_FOR_DATE(row))


if __name__ == "__main__":
    unittest.main()
