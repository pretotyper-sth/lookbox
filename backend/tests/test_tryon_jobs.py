"""Background try-on survives clients leaving and deduplicates reconnects."""
import ast
import copy
import base64
import hashlib
import io
from concurrent.futures import ThreadPoolExecutor
import threading
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from typing import Callable


class HttpError(Exception):
    def __init__(self, status_code=502, detail='failed'):
        super().__init__(detail)
        self.detail = detail


class Database:
    def __init__(self):
        self.rows = []

    def table(self, name):
        return Query(self)


class Query:
    def __init__(self, db):
        self.db, self.filters, self.mode, self.payload = db, {}, 'select', None

    def select(self, fields):
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def limit(self, limit):
        return self

    def insert(self, payload):
        self.mode, self.payload = 'insert', payload
        return self

    def upsert(self, payload, **kwargs):
        return self.insert(payload)

    def update(self, payload):
        self.mode, self.payload = 'update', payload
        return self

    def execute(self):
        if self.mode == 'insert':
            if any(all(row[k] == self.payload[k] for k in ('user_id', 'cache_key', 'kind')) for row in self.db.rows):
                raise ValueError('duplicate')
            self.db.rows.append(copy.deepcopy(self.payload))
            return SimpleNamespace(data=[])
        rows = [r for r in self.db.rows if all(r.get(k) == v for k, v in self.filters.items())]
        if self.mode == 'update':
            for row in rows:
                row.update(copy.deepcopy(self.payload))
        return SimpleNamespace(data=copy.deepcopy(rows))


class DeferredThread:
    def __init__(self, target, daemon):
        self.target = target

    def start(self):
        pass


class TryOnJobsTest(unittest.TestCase):
    def setUp(self):
        self.db, self.threads = Database(), []
        def thread(**kwargs):
            t = DeferredThread(**kwargs)
            self.threads.append(t)
            return t
        tree = ast.parse(Path(__file__).parents[1].joinpath('app/main.py').read_text())
        nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in (
            '_tryon_job_read', '_tryon_job_write', '_tryon_job_start')]
        self.ns = {'Any': object, 'Callable': Callable, 'time': time, 'supabase_admin': self.db,
                   'threading': SimpleNamespace(Thread=thread), 'HTTPException': HttpError,
                   'note_fail': lambda *args: None,
                   '_IMPORT_STEPS': {'tryon_segment': ('옷 경계를 정리하고 있어요', 78, 92, 8)}}
        exec(compile(ast.Module(body=nodes, type_ignores=[]), '<tryon-jobs>', 'exec'), self.ns)

    def test_reconnect_deduplicates_and_result_survives_client_leaving(self):
        calls = []
        def work(report):
            calls.append(True)
            report('tryon_segment')
            return {'imageUrl': 'ready', 'validated': True}
        start, read = self.ns['_tryon_job_start'], self.ns['_tryon_job_read']
        self.assertEqual(start('owner', 'id', work)['status'], 'running')
        self.assertEqual(start('owner', 'id', work)['status'], 'running')
        self.assertEqual(len(self.threads), 1)
        self.threads[0].target()
        self.assertEqual(calls, [True])
        job = read('owner', 'id')
        self.assertEqual(job['status'], 'succeeded')
        self.assertEqual(job['result']['imageUrl'], 'ready')
        self.assertEqual(job['step']['key'], 'tryon_segment')
        self.assertIsNone(read('someone-else', 'id'))
        self.assertEqual(start('owner', 'id', work)['status'], 'succeeded')
        self.assertEqual(len(self.threads), 1)

    def test_quality_failure_is_persisted_without_success(self):
        def work(report):
            raise HttpError(detail='옷 경계를 정리하지 못했어요.')
        self.ns['_tryon_job_start']('owner', 'id', work)
        self.threads[0].target()
        job = self.ns['_tryon_job_read']('owner', 'id')
        self.assertEqual(job['status'], 'failed')
        self.assertIn('옷 경계', job['failure'])
        self.assertNotIn('result', job)

    def test_stalled_worker_is_reported_as_interrupted(self):
        self.ns['_tryon_job_start']('owner', 'id', lambda report: {})
        self.db.rows[0]['metadata']['updated'] = time.time() - 1801
        job = self.ns['_tryon_job_read']('owner', 'id')
        self.assertEqual(job['status'], 'failed')
        self.assertIn('중단', job['failure'])

    def test_unexpected_worker_failure_never_exposes_technical_error(self):
        def work(report):
            raise RuntimeError('technical failure')
        self.ns['_tryon_job_start']('owner', 'id', work)
        self.threads[0].target()
        job = self.ns['_tryon_job_read']('owner', 'id')
        self.assertEqual(job['status'], 'failed')
        self.assertNotIn('technical', job['failure'])


class TryOnRetryTest(unittest.TestCase):
    def run_generation(self, valid_on, upload_failures=0):
        calls = {"generated": 0, "saved": {}, "usage": [], "failures": []}
        def edit(**kwargs):
            calls["generated"] += 1
            return SimpleNamespace(data=[SimpleNamespace(b64_json=base64.b64encode(b"image"))])
        def valid(assets, reasons):
            if calls["generated"] >= valid_on:
                return True
            reasons.append("vertical_coverage")
            return False
        def upload(path, blob, content_type):
            attempts = calls["saved"].get(path, 0) + 1
            calls["saved"][path] = attempts
            if attempts <= upload_failures:
                raise OSError("temporary storage error")
            return path
        client = SimpleNamespace(images=SimpleNamespace(edit=edit))
        client.with_options = lambda **kwargs: client
        noop = lambda *args, **kwargs: None
        tree = ast.parse(Path(__file__).parents[1].joinpath('app/main.py').read_text())
        node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'live_tryon_body')
        node.decorator_list = []
        node.args.defaults = []
        ns = {'TryOnBody': object, 'UserContext': object, 'Any': object, 'Callable': Callable,
              'require_supabase': noop, '_face_image_bytes': lambda x: b'face',
              '_tryon_body_profile_note': lambda *args: '', 'hashlib': hashlib,
              'supabase_admin': Database(), '_TRYON_BUSY': set(), '_TRYON_BUSY_LOCK': threading.Lock(),
              'ensure_within_limit': noop, 'ensure_within_daily_fail': noop,
              'openai_client': client, 'OPENAI_IMAGE_TIMEOUT_TRYON': 150,
              'OPENAI_IMAGE_MODEL_TRYON': 'model', 'OPENAI_IMAGE_QUALITY_TRYON': 'high',
              '_TRYON_BODY_PROMPT': 'unchanged', 'io': io, 'base64': base64,
              'log_ai_usage': noop, '_tryon_make_assets': lambda blob: {k: b'image' for k in ('body', 'top', 'bottom', 'full')},
              '_tryon_assets_valid': valid, '_TRYON_FAIL_MSG': {'mask': '옷 경계 실패'},
              'HTTPException': HttpError, 'ThreadPoolExecutor': ThreadPoolExecutor,
              'upload_bytes': upload, 'note_usage': lambda *args: calls['usage'].append(args),
              'note_fail': lambda *args: calls['failures'].append(args),
              'time': SimpleNamespace(sleep=noop), 'stream_with_keepalive': lambda work: work(noop)}
        exec(compile(ast.Module(body=[node], type_ignores=[]), '<tryon-retry>', 'exec'), ns)
        try:
            result = ns['live_tryon_body'](SimpleNamespace(face_data_url='face', profile={}, request_id=None),
                                           SimpleNamespace(id='owner', email='owner@example.test'))
        except HttpError:
            result = None
        self.assertEqual(ns['_TRYON_BUSY'], set())
        return calls, result

    def test_third_valid_generation_is_saved_once(self):
        calls, result = self.run_generation(3)
        self.assertEqual(calls['generated'], 3)
        self.assertTrue(result['validated'])
        self.assertEqual(len(calls['usage']), 1)
        self.assertFalse(calls['failures'])

    def test_three_bad_masks_fail_without_saving_or_charging(self):
        calls, result = self.run_generation(4)
        self.assertIsNone(result)
        self.assertEqual(calls['generated'], 3)
        self.assertFalse(calls['saved'])
        self.assertFalse(calls['usage'])
        self.assertEqual(len(calls['failures']), 1)
        self.assertEqual(calls['failures'][0][2]['reasons'], ['vertical_coverage'])

    def test_transient_upload_retries_do_not_generate_again(self):
        calls, result = self.run_generation(1, upload_failures=1)
        self.assertTrue(result['validated'])
        self.assertEqual(calls['generated'], 1)
        self.assertEqual(list(calls['saved'].values()), [2, 2, 2, 2])


if __name__ == '__main__':
    unittest.main()
