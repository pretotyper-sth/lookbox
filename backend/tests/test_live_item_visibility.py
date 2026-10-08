import ast
import unittest
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from fastapi import HTTPException
from pydantic import BaseModel


class Store:
    def __init__(self):
        self.row = {'id': 'shirt', 'user_id': 'alice', 'name': '셔츠', 'category': 'top', 'status': 'owned', 'metadata': {'brand': 'COS', 'price': '90000'}}
    def table(self, name):
        return Query(self)


class Query:
    def __init__(self, store):
        self.store, self.filters, self.patch = store, {}, None
    def select(self, fields): return self
    def eq(self, key, value):
        self.filters[key] = value
        return self
    def limit(self, value): return self
    def update(self, patch):
        self.patch = patch
        return self
    def execute(self):
        if any(self.store.row.get(k) != v for k, v in self.filters.items()): return SimpleNamespace(data=[])
        if self.patch: self.store.row.update(self.patch)
        return SimpleNamespace(data=[dict(self.store.row)])


class ItemVisibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        tree = ast.parse(Path(__file__).parents[1].joinpath('app/main.py').read_text())
        names = {'live_item_payload', 'LiveItemUpdate', 'live_update_item'}
        nodes = [x for x in tree.body if getattr(x, 'name', '') in names]
        for node in nodes: node.decorator_list = []
        cls.module = compile(ast.Module(body=nodes, type_ignores=[]), '<live-item-visibility>', 'exec')
    def setUp(self):
        self.store = Store()
        self.env = {'Any': Any, 'BaseModel': BaseModel, 'UserContext': SimpleNamespace, 'Depends': lambda x: None, 'current_user': lambda: None, 'supabase_admin': self.store, 'HTTPException': HTTPException, '_category_display': lambda x: x, '_canonicalize_color': lambda x: x, '_clean_seasons': lambda x: x or [], 'CATEGORY_KO': [], 'CATEGORY_EN': {}}
        exec(self.module, self.env)
    def test_visibility_round_trip_preserves_existing_metadata(self):
        self.assertFalse(self.env['live_item_payload'](self.store.row)['public'])
        for visible in [True, False]:
            body = self.env['LiveItemUpdate'](public=visible)
            result = self.env['live_update_item']('shirt', body, SimpleNamespace(id='alice'))
            self.assertEqual(result['item']['public'], visible)
            self.assertEqual(self.store.row['metadata']['brand'], 'COS')
            self.assertEqual(self.store.row['metadata']['price'], '90000')
    def test_other_owner_cannot_change_visibility(self):
        with self.assertRaises(HTTPException) as error:
            self.env['live_update_item']('shirt', self.env['LiveItemUpdate'](public=True), SimpleNamespace(id='bob'))
        self.assertEqual(error.exception.status_code, 404)
        self.assertNotIn('public', self.store.row['metadata'])
