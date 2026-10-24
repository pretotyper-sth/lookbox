"""Health readiness checks without importing external AI/database services."""
import ast
from pathlib import Path
import unittest
from unittest.mock import MagicMock


class HTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        self.detail = detail


class HealthProbeTests(unittest.TestCase):
    def setUp(self):
        tree = ast.parse((Path(__file__).parents[1] / 'app/main.py').read_text())
        health = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'health')
        health.decorator_list = []
        self.db = MagicMock()
        self.env = dict(Any=object, HTTPException=HTTPException, require_supabase=MagicMock(), supabase_admin=self.db,
                        openai_client=None, SUPABASE_URL='url', SUPABASE_SERVICE_ROLE_KEY='secret', DEPLOY_REV='revision', LOOK_TEST_LIMIT=1)
        exec(compile(ast.Module(body=[health], type_ignores=[]), '<health>', 'exec'), self.env)

    def test_regular_health_does_not_query_database(self):
        self.assertTrue(self.env['health']()['ok'])
        self.db.table.assert_not_called()

    def test_database_probe_reads_one_row_without_returning_personal_data(self):
        result = self.env['health'](db=True)
        self.assertTrue(result['database'])
        self.db.table.assert_called_once_with('profiles')
        self.db.table.return_value.select.assert_called_once_with('id')
        self.db.table.return_value.select.return_value.limit.assert_called_once_with(1)
        self.assertNotIn('id', result)

    def test_database_failure_is_not_reported_healthy(self):
        self.db.table.side_effect = RuntimeError('private server diagnostics')
        with self.assertRaises(HTTPException) as raised:
            self.env['health'](db=True)
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail, 'Database unavailable')


if __name__ == '__main__':
    unittest.main()
