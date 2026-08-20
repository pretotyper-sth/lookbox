"""요금제·크레딧 — 무엇이 얼마짜리인지, 무료 등급이 어디서 멈추는지 고정한다.

AI를 쓰는 작업에는 실제 돈이 나간다(측정값은 CREDIT_COSTS 위 주석). 사용자에게는
'크레딧'이라는 한 단위로만 보여주되, 무거운 작업일수록 많이 깎여야 한다.
"""

import ast
import unittest
from datetime import datetime, timezone
from pathlib import Path


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")
FNS = ("_period_key", "_period_end", "_plan_of")
CONSTS = ("CREDIT_COSTS", "CREDIT_LABELS", "PLANS", "DEFAULT_PLAN")


def load():
    tree = ast.parse(MAIN_PATH.read_text())
    body = [
        n for n in tree.body
        if (isinstance(n, ast.FunctionDef) and n.name in FNS)
        or (isinstance(n, (ast.Assign, ast.AnnAssign))
            and getattr(getattr(n, "target", None) or n.targets[0], "id", "") in CONSTS)
    ]
    ns = {"Any": object, "datetime": datetime, "timezone": timezone}
    exec(compile(ast.Module(body=body, type_ignores=[]), "<billing>", "exec"), ns)
    return ns


class PlanShapeTest(unittest.TestCase):
    def setUp(self):
        self.ns = load()

    def test_default_is_free_and_free_is_actually_free(self):
        plans = self.ns["PLANS"]
        self.assertEqual(self.ns["DEFAULT_PLAN"], "free")
        self.assertEqual(plans["free"]["price_krw"], 0)
        self.assertGreater(plans["free"]["credits"], 0)          # 써볼 수는 있어야 한다
        self.assertFalse(plans["free"]["model_look"])            # 제일 비싼 기능은 유료

    def test_paid_plans_give_more_for_more(self):
        plans = self.ns["PLANS"]
        order = ["free", "basic", "pro"]
        prices = [plans[p]["price_krw"] for p in order]
        credits = [plans[p]["credits"] for p in order]
        self.assertEqual(prices, sorted(prices))
        self.assertEqual(credits, sorted(credits))
        self.assertTrue(plans["pro"]["model_look"])

    def test_heavier_work_costs_more_credits(self):
        c = self.ns["CREDIT_COSTS"]
        # 원가 순서: URL 등록($0.006) < 사진 등록($0.08) < AI 착장($0.25)
        self.assertLess(c["import_url"], c["import_photo"])
        self.assertLess(c["import_photo"], c["model_look"])
        self.assertEqual(c["coordinate"], 1)
        for action in c:
            self.assertIn(action, self.ns["CREDIT_LABELS"])      # 화면에 쓸 이름이 있어야 한다

    def test_free_plan_covers_a_real_first_month(self):
        # 무료로도 '옷장을 만들고 코디를 받아보는' 경험은 끝까지 가야 한다:
        # URL로 30벌 담고(30) 추천 15회(15) = 45 ≤ 60
        c, free = self.ns["CREDIT_COSTS"], self.ns["PLANS"]["free"]["credits"]
        self.assertLessEqual(30 * c["import_url"] + 15 * c["coordinate"], free)


class PeriodTest(unittest.TestCase):
    def setUp(self):
        self.ns = load()

    def test_period_is_monthly_and_end_rolls_over(self):
        key = self.ns["_period_key"](datetime(2026, 8, 20, tzinfo=timezone.utc))
        self.assertEqual(key, "2026-08")
        self.assertTrue(self.ns["_period_end"]("2026-08").startswith("2026-09-01"))
        self.assertTrue(self.ns["_period_end"]("2026-12").startswith("2027-01-01"))

    def test_plan_is_the_latest_plan_row(self):
        rows = [
            {"reason": "grant", "metadata": {"period": "2026-08"}},
            {"reason": "plan", "metadata": {"plan": "basic"}},
            {"reason": "plan", "metadata": {"plan": "pro"}},
            {"reason": "coordinate", "metadata": {}},
        ]
        self.assertEqual(self.ns["_plan_of"](rows), "pro")
        self.assertEqual(self.ns["_plan_of"]([]), "free")
        # 없는 요금제 이름은 무시하고 마지막 유효값을 쓴다
        rows.append({"reason": "plan", "metadata": {"plan": "unicorn"}})
        self.assertEqual(self.ns["_plan_of"](rows), "pro")
