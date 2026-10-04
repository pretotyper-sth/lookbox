"""추천 카드 생성 순서를 고정한다."""

import ast
import unittest
import contextlib
import io
import time
import uuid
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock
from fastapi import HTTPException
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

    def test_streams_all_cards_before_left_to_right_wishes(self):
        self.assertLess(self.source.index("for i, combo in enumerate(combos):"), self.source.index("for outfit, combo, wish, wish_item in wish_jobs:"))
        self.assertIn('report({"_wish": {"id": outfit["id"], "stage": "draw"}})', self.source)

    def test_model_look_server_only_accepts_one_target(self):
        source = MAIN_PATH.read_text()
        self.assertIn('targets = [o for o in outfits if not o.get("lookImg")][:1]', source)

    def test_wish_product_cut_uses_the_fast_thumbnail_tier(self):
        source = MAIN_PATH.read_text()
        start = source.index("def generate_wish_product_image")
        wish_source = source[start:source.index("\ndef ", start + 1)]
        self.assertIn("quality = OPENAI_IMAGE_QUALITY_WISH", wish_source)
        self.assertIn('"size": "1024x1024"', wish_source)


class PickedCoordinateValidationTest(unittest.TestCase):
    def setUp(self):
        tree = ast.parse(MAIN_PATH.read_text())
        names = ('_validate_picked_outfit', '_category_key', '_category_display')
        self.ns = {'Any': Any, 'HTTPException': HTTPException, 'CATEGORY_KO': {'top': '상의', 'outer': '아우터', 'bottom': '하의', 'skirt': '스커트', 'dress': '원피스', 'shoes': '신발', 'bag': '가방', 'hat': '모자', 'misc': '소품'}, '_LEGACY_CATEGORY_KO': {'accessory': '소품'}}
        self.ns['CATEGORY_EN'] = {v: k for k, v in self.ns['CATEGORY_KO'].items()}
        exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names], type_ignores=[]), '<selection>', 'exec'), self.ns)

    def validate(self, categories):
        rows = {str(i): {'id': str(i), 'category': category, 'name': '옷' + str(i)} for i, category in enumerate(categories)}
        self.ns['_validate_picked_outfit'](list(rows), rows)

    def test_valid_core_and_accessories(self):
        self.validate(['상의', '하의', '신발', '아우터', '가방', '모자'])
        self.validate(['원피스', '아우터', '신발'])

    def test_incompatible_selections_have_removal_guidance(self):
        for categories, message in [(['아우터', 'outer'], '아우터 2개 중 1개'), (['상의', '원피스'], '선택 해제'), (['하의', '스커트'], '하의와 스커트'), (['상의'] * 8, '2개를 선택 해제')]:
            with self.subTest(categories=categories), self.assertRaises(HTTPException) as raised:
                self.validate(categories)
            self.assertIn(message, raised.exception.detail)

    def test_unknown_or_archived_item_rejected(self):
        with self.assertRaises(HTTPException):
            self.ns['_validate_picked_outfit'](['missing'], {})


class CoordinateGenerationOrderTest(unittest.TestCase):
    def run_pipeline(self, model_look, personal=False):
        node = next(n for n in ast.parse(MAIN_PATH.read_text()).body if isinstance(n, ast.FunctionDef) and n.name == 'live_coordinate')
        node.decorator_list = []
        owned = [{'id': 'shirt', 'category': 'top'}, {'id': 'pants', 'category': 'bottom'}]
        events = []
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value.data = owned
        db.table.return_value.insert.return_value.execute.side_effect = [SimpleNamespace(data=[{'id': 'look1'}]), SimpleNamespace(data=[{'id': 'look2'}])]
        looks = MagicMock()
        def apply(user_id, outfits, by_id, gender, **kwargs):
            events.append(('look-start', gender, kwargs['personal']))
            outfits[0]['lookImg'] = 'ai.png'
            kwargs['report']({'_look': {'id': outfits[0]['id'], 'lookImg': 'ai.png'}})
        looks.side_effect = apply
        def wish(*args):
            events.append(('wish-start',))
            return None
        ns = {'Any': Any, 'time': time, 'uuid': uuid, 'LiveCoordinate': object, 'UserContext': object, 'Depends': lambda x: None, 'current_user': None, 'HTTPException': HTTPException,
              'ensure_credits': MagicMock(), 'supabase_admin': db, '_recent_daily_exclusions': lambda *a: [], '_recent_daily_feedback': lambda *a: [], '_recent_daily_wishes': lambda *a: [],
              '_validate_picked_outfit': MagicMock(), '_combo_has_top_and_bottom': lambda *a: True, '_combo_has_unique_garment_slots': lambda *a: True,
              '_wish_live_item': lambda id, wish: {'id': id}, 'live_item_payload': lambda row: row,
              'recommend_closet': lambda *a: [{'item_ids': ['shirt','pants']}, {'item_ids': ['shirt','pants']}], '_wish_key': lambda wish: ('outer', 'coat', 'beige'), '_gap_wish': lambda *a: {'category': 'outer', 'name': 'coat'}, '_apply_wish_slot': lambda *a: None,
              '_apply_model_looks': looks, '_face_image_bytes': lambda value: b'face', 'generate_wish_product_image': wish, '_record_recommendation_timing': MagicMock(), 'spend_credits': MagicMock(), 'stream_with_keepalive': lambda work: work(events.append)}
        exec(compile(ast.Module(body=[node], type_ignores=[]), '<coordinate>', 'exec'), ns)
        body = SimpleNamespace(anchor_id=None, personal_color='',fit='',palettes=[],gender='남성',age='',height='178',weight='72',weather=None,max_combos=2,wish_combos=1,for_date=None,exclude_item_ids=[],style='minimal',styles=[],include_item_ids=['pants'],model_look=model_look,personal_model_look=personal,face_data_url='face')
        with contextlib.redirect_stdout(io.StringIO()):
            result = ns['live_coordinate'](body, SimpleNamespace(id='user'))
        return events, looks, result

    def test_all_product_cards_then_first_look_then_external_product(self):
        events, looks, result = self.run_pipeline(True, True)
        kinds = [next(iter(e)) if isinstance(e, dict) else e[0] for e in events]
        self.assertEqual(kinds[:2], ['_outfit', '_outfit'])
        self.assertLess(kinds.index('look-start'), kinds.index('wish-start'))
        self.assertEqual(looks.call_args.args[3], '남성')
        self.assertTrue(looks.call_args.kwargs['personal'])
        self.assertEqual(result['outfits'][0]['lookImg'], 'ai.png')

    def test_disabled_ai_never_starts_a_look(self):
        events, looks, result = self.run_pipeline(False)
        looks.assert_not_called()
        self.assertEqual(len(result['outfits']), 2)


if __name__ == "__main__":
    unittest.main()
