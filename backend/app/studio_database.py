import os
import threading
from contextlib import contextmanager
from pathlib import Path

from fastapi import HTTPException

_SCHEMA_READY = False
_SCHEMA_LOCK = threading.Lock()


class StudioConnection:
    def __init__(self, conn):
        self.conn = conn

    @staticmethod
    def query(statement):
        ignored = statement.startswith('INSERT OR IGNORE INTO ')
        if ignored:
            statement = statement.replace('INSERT OR IGNORE INTO ', 'INSERT INTO ', 1) + ' ON CONFLICT DO NOTHING'
        return statement.replace('?', '%s')

    def execute(self, statement, params=()):
        return self.conn.execute(self.query(statement), params)

    def executemany(self, statement, params):
        cursor = self.conn.cursor()
        cursor.executemany(self.query(statement), params)
        return cursor


@contextmanager
def production_db():
    import psycopg
    from psycopg.rows import dict_row
    global _SCHEMA_READY
    url = os.environ.get('STYLE_STUDIO_DATABASE_URL', '')
    if not url:
        raise HTTPException(503, '피드 저장 서버를 준비하고 있어요. 잠시 후 다시 시도해 주세요.')
    with psycopg.connect(url, row_factory=dict_row, connect_timeout=10, prepare_threshold=None, sslmode='require') as conn:
        if not _SCHEMA_READY:
            with _SCHEMA_LOCK:
                if not _SCHEMA_READY:
                    schema = Path(__file__).with_name('studio.sql')
                    conn.execute('SELECT pg_advisory_xact_lock(20261011)')
                    conn.execute(schema.read_text())
                    conn.commit()
                    _SCHEMA_READY = True
        conn.execute('SET LOCAL search_path TO realcloset_studio')
        conn.execute("SET LOCAL statement_timeout = '15s'")
        yield StudioConnection(conn)
