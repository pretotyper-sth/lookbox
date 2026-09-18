"""추천 카드 생성 순서를 고정한다."""

import ast
import unittest
from pathlib import Path


MAIN_PATH = Path(__file__).parents[1].joinpath("app/main.py")


class LiveCoordinatePipelineTest(unittest.TestCase):
    def setUp(self):
        source = MAIN_PATH.read_text()
        tree = ast.parse(source)
        fn = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "live_coordinate")
        self.source = ast.get_source_segment(source, fn) or ""

    def test_uses_product_cuts_without_text_recommendation(self):
        self.assertIn("combos = recommend_closet(", self.source)
        self.assertNotIn("recommend_text(", self.source)
        self.assertNotIn("_ensure_style_attrs", self.source)

    def test_streams_all_cards_before_right_to_left_wishes(self):
        self.assertLess(self.source.index("for i, combo in enumerate(combos):"), self.source.index("for outfit, combo, wish, wish_item in reversed(wish_jobs):"))
        self.assertIn('report({"_wish": {"id": outfit["id"], "stage": "draw"}})', self.source)

    def test_model_look_server_only_accepts_one_target(self):
        source = MAIN_PATH.read_text()
        self.assertIn('targets = [o for o in outfits if not o.get("lookImg")][:1]', source)


if __name__ == "__main__":
    unittest.main()
