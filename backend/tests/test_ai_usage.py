import ast
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from datetime import datetime, timezone, timedelta
from typing import Any
from unittest.mock import MagicMock

from backend.app.ai_usage import UsageLedger, call_ai, estimate_cost, tokens_from_usage


class AiUsageTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.rows = []
        self.ledger = UsageLedger(Path(self.temp.name) / 'usage.sqlite3', self.rows.append)

    def test_response_is_logged_before_caller_processing_and_preserves_usage(self):
        usage = {'input_tokens': 1300, 'input_tokens_details': {'text_tokens': 300, 'image_tokens': 1000}, 'output_tokens': 1510}
        result = SimpleNamespace(usage=usage, _request_id='req-a', id='img-a')
        response = call_ai('user-a', 'model_look', lambda **kwargs: result,
                           ledger=self.ledger, model='gpt-image-2.5-flare', quality='high', size='1024x1280')
        self.assertIs(response, result)
        start, end = self.rows
        self.assertEqual(start['id'], end['id'])
        self.assertEqual(start['metadata']['status'], 'started')
        self.assertEqual(end['metadata']['raw_usage'], usage)
        self.assertAlmostEqual(end['metadata']['cost_usd'], .0548)
        self.assertEqual(end['metadata']['request_id'], 'req-a')
        self.assertNotIn('prompt', end['metadata'])

    def test_unknown_model_and_missing_usage_are_not_zero_cost(self):
        for model, usage in [('future-model', {'input_tokens': 1, 'output_tokens': 1}), ('gpt-image-1', None)]:
            call_ai(None, 'image', lambda **kw: SimpleNamespace(usage=usage), model=model, ledger=self.ledger)
            self.assertIsNone(self.rows[-1]['metadata']['cost_usd'])
            self.assertEqual(self.rows[-1]['metadata']['cost_status'], 'unknown')

    def test_each_failed_attempt_is_logged_and_reraised(self):
        def failure(**kwargs):
            raise TimeoutError('prompt must never be logged')
        for _ in range(2):
            with self.assertRaises(TimeoutError):
                call_ai(None, 'image', failure, ledger=self.ledger, model='gpt-image-1')
        self.assertEqual(len({r['id'] for r in self.rows}), 2)
        self.assertEqual(self.rows[-1]['metadata']['status'], 'error')
        self.assertIsNone(self.rows[-1]['metadata']['cost_usd'])
        self.assertNotIn('prompt must never', json.dumps(self.rows))

    def test_cloud_start_record_failure_prevents_paid_call(self):
        self.ledger.sink = MagicMock(side_effect=ConnectionError())
        provider = MagicMock()
        with self.assertRaisesRegex(RuntimeError, 'not sent'):
            call_ai(None, 'image', provider, ledger=self.ledger, model='gpt-image-1')
        provider.assert_not_called()
        self.assertEqual(self.ledger.pending_count(), 1)

    def test_completion_sync_failure_replays_same_id_after_restart(self):
        def sink(row):
            if row['metadata']['status'] == 'success':
                raise ConnectionError()
        self.ledger.sink = sink
        call_ai(None, 'image', lambda **kw: SimpleNamespace(usage=None), ledger=self.ledger, model='gpt-image-1')
        self.assertEqual(self.ledger.pending_count(), 1)
        replay = UsageLedger(self.ledger.path, self.rows.append)
        replay.flush()
        self.assertEqual(replay.pending_count(), 0)
        self.assertEqual(self.rows[-1]['metadata']['status'], 'success')

    def test_cached_chat_tokens_use_discount_and_invalid_totals_stay_unknown(self):
        tokens = tokens_from_usage({'prompt_tokens': 1000, 'completion_tokens': 100, 'prompt_tokens_details': {'cached_tokens': 800}})
        self.assertAlmostEqual(estimate_cost('gpt-4o', tokens), .0025)
        self.assertIsNone(tokens_from_usage({'input_tokens': 1, 'output_tokens': 1, 'input_tokens_details': {'text_tokens': 2}}))

    def test_direct_image2_cached_tokens_do_not_get_responses_discount(self):
        tokens = {'text_in': 500, 'image_in': 1000, 'out': 5488, 'text_cached': 100, 'image_cached': 500}
        self.assertAlmostEqual(estimate_cost('gpt-image-2', tokens), .17514)

    def test_image_input_breakdown_missing_does_not_underprice_as_text(self):
        call_ai(None, 'image', lambda **kw: SimpleNamespace(usage={'input_tokens': 5000, 'output_tokens': 1510}),
                ledger=self.ledger, model='gpt-image-2.5-flare')
        self.assertIsNone(self.rows[-1]['metadata']['cost_usd'])

    def test_admin_reads_all_pages_and_separates_diagnostics_and_unknown_costs(self):
        path = Path(__file__).parents[1] / 'app' / 'main.py'
        node = next(n for n in ast.parse(path.read_text()).body if isinstance(n, ast.FunctionDef) and n.name == 'live_admin_ai_cost')
        node.decorator_list = []
        node.args.defaults = []
        stamp = datetime.now(timezone.utc).isoformat()
        rows = [{'id': str(i), 'created_at': stamp, 'feature': 'classify', 'model': 'gpt-4o', 'metadata': {'cost_usd': .01}} for i in range(1000)]
        rows.extend({'id': str(1000+i), 'created_at': stamp, 'feature': f, 'model': 'unknown', 'metadata': {}} for i, f in enumerate(['model_look', 'product_image', 'tryon_validation', 'product_image_error']))
        class Query:
            def __init__(self):
                self.pages = []
            def __getattr__(self, name):
                return lambda *args, **kwargs: self
            def range(self, start, end):
                self.pages.append((start, end))
                self.batch = rows[start:end+1]
                return self
            def execute(self):
                return SimpleNamespace(data=self.batch)
        query = Query()
        ledger = MagicMock()
        ledger.pending_count.return_value = 0
        ns = {'Any': Any, 'datetime': datetime, 'timezone': timezone, 'timedelta': timedelta,
              'ADMIN_TOKEN': 'test-token', 'require_supabase': lambda: None,
              'supabase_admin': query, 'get_ledger': lambda: ledger}
        exec(compile(ast.Module(body=[node], type_ignores=[]), '<ai-cost>', 'exec'), ns)
        report = ns['live_admin_ai_cost'](30, 'test-token')
        self.assertEqual(query.pages, [(0, 999), (1000, 1999)])
        self.assertEqual(report['total']['calls'], 1002)
        self.assertEqual(report['total']['cost_usd'], 10)
        self.assertEqual(report['unpriced_calls'], 2)
        self.assertEqual(report['diagnostic_events'], 2)
        self.assertFalse(report['cost_complete'])

    def test_failed_local_write_prevents_api_request(self):
        ledger = MagicMock()
        ledger.save.side_effect = OSError('disk full')
        provider = MagicMock()
        with self.assertRaises(OSError):
            call_ai(None, 'image', provider, ledger=ledger, model='gpt-image-1')
        provider.assert_not_called()

    def test_every_openai_and_gemini_call_site_uses_audit_wrapper(self):
        root = Path(__file__).parents[2]
        for path in ['backend/app/main.py', 'backend/scripts/gen_mood_images.py', 'server.py']:
            tree = ast.parse((root / path).read_text())
            for node in ast.walk(tree):
                if isinstance(node, ast.Call):
                    name = ast.unparse(node.func)
                    self.assertFalse(any(x in name for x in ['images.edit', 'images.generate', 'chat.completions.create', 'generate_content']), (path, node.lineno))


if __name__ == '__main__':
    unittest.main()
