#!/usr/bin/env python3
"""
LOOKBOX Analytics Server
실행: uv run --with flask python3 server.py

Landing:   http://localhost:8080
Dashboard: http://localhost:8080/dashboard  (ID: admin / PW: lookbox2026)
"""
import os, json, sqlite3, hashlib
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, Response, abort

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'v2')
DATA_DIR   = os.environ.get('DATA_DIR', BASE_DIR)
DB_PATH    = os.path.join(DATA_DIR, 'tracker.db')
DASH_PW    = os.environ.get('DASHBOARD_PASSWORD', 'lookbox2026')

app = Flask(__name__, static_folder=None)

# ── DB ────────────────────────────────────────────────────────
# init_db() also called at module load so WSGI hosts (PythonAnywhere) initialize the schema.
def db():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    with db() as c:
        c.execute('''CREATE TABLE IF NOT EXISTS events (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id   TEXT,
            event_name   TEXT,
            properties   TEXT,
            page_url     TEXT,
            referrer     TEXT,
            user_agent   TEXT,
            ip_hash      TEXT,
            utm_source   TEXT,
            utm_medium   TEXT,
            utm_campaign TEXT,
            device       TEXT,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        )''')
        for col in ['event_name','session_id','created_at']:
            c.execute(f'CREATE INDEX IF NOT EXISTS idx_{col} ON events({col})')
        c.execute('''CREATE TABLE IF NOT EXISTS ip_blocklist (
            ip TEXT PRIMARY KEY,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )''')
        c.commit()

init_db()

# ── Helpers ───────────────────────────────────────────────────
def blocklist():
    with db() as c:
        rows = c.execute('SELECT ip FROM ip_blocklist').fetchall()
    return {r['ip'] for r in rows}

def client_ip():
    return request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip()

def hash_ip(ip):
    return hashlib.sha256(ip.encode()).hexdigest()[:16]

def device(ua):
    u = (ua or '').lower()
    if any(x in u for x in ['iphone','android','mobile']): return 'mobile'
    if any(x in u for x in ['ipad','tablet']): return 'tablet'
    return 'desktop'

BOT_PATTERNS = (
    'bot','crawler','spider','curl','wget','python-requests','httpclient',
    'headlesschrome','phantomjs','puppeteer','playwright','selenium',
    'facebookexternalhit','meta-externalagent','kakaotalk-scrap','daum',
    'twitterbot','whatsapp','telegrambot','linkedinbot','slackbot',
    'discordbot','pinterestbot','redditbot','embed','preview','lighthouse',
    'gptbot','claudebot','perplexity','anthropic','openai','ccbot',
)

def is_bot(ua):
    u = (ua or '').lower()
    if not u: return True
    return any(p in u for p in BOT_PATTERNS)

def require_auth(f):
    @wraps(f)
    def wrap(*a, **kw):
        auth = request.authorization
        if not auth or auth.password != DASH_PW:
            return Response('Login required', 401, {'WWW-Authenticate': 'Basic realm="LOOKBOX"'})
        return f(*a, **kw)
    return wrap

# ── API ───────────────────────────────────────────────────────
@app.route('/api/track', methods=['POST','OPTIONS'])
def track():
    if request.method == 'OPTIONS':
        return '', 204
    ip = client_ip()
    if ip in blocklist():
        return jsonify({'ok': True})
    ua = request.headers.get('User-Agent', '')
    if is_bot(ua):
        return jsonify({'ok': True, 'filtered': 'bot'})
    try:
        data  = request.get_json(silent=True) or {}
        props = data.get('properties', {})
        with db() as c:
            c.execute('''INSERT INTO events
                (session_id,event_name,properties,page_url,referrer,user_agent,
                 ip_hash,utm_source,utm_medium,utm_campaign,device)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)''', (
                data.get('session_id'), data.get('event'),
                json.dumps(props, ensure_ascii=False),
                data.get('url'), data.get('referrer'), ua, hash_ip(ip),
                props.get('utm_source'), props.get('utm_medium'), props.get('utm_campaign'),
                device(ua)
            ))
            c.commit()
    except Exception as e:
        print(f'Track error: {e}')
    resp = jsonify({'ok': True})
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp

@app.route('/api/dashboard/data')
@require_auth
def dash_data():
    today = datetime.now().strftime('%Y-%m-%d')
    start = request.args.get('start', '')
    end   = request.args.get('end', today)

    if start:
        df = "AND date(created_at) BETWEEN ? AND ?"
        da = (start, end)
    else:
        df, da = '', ()

    with db() as c:
        def q(sql, *args): return c.execute(sql, args).fetchall()
        def scalar(sql, *args): return c.execute(sql, args).fetchone()[0]
        def pq(sql, *args): return q(sql + ' ' + df, *args, *da)
        def ps(sql, *args): return scalar(sql + ' ' + df, *args, *da)

        funnel = {ev: ps('SELECT COUNT(DISTINCT session_id) FROM events WHERE event_name=?', ev)
                  for ev in ['page_view','plan_picker_open','plan_form_valid','plan_selected','confirm_btn_click']}

        today_pv   = scalar("SELECT COUNT(DISTINCT session_id) FROM events WHERE event_name='page_view' AND date(created_at)=?", today)
        today_conv = scalar("SELECT COUNT(DISTINCT session_id) FROM events WHERE event_name='confirm_btn_click' AND date(created_at)=?", today)
        active     = scalar("SELECT COUNT(DISTINCT session_id) FROM events WHERE datetime(created_at) >= datetime('now','-5 minutes')")

        recent_sql = 'SELECT event_name,properties,device,utm_source,session_id,created_at FROM events'
        recent_sql += (' WHERE date(created_at) BETWEEN ? AND ?' if start else '') + ' ORDER BY id DESC LIMIT 50'
        recent   = q(recent_sql, *(da if start else ()))
        utms     = pq("SELECT COALESCE(utm_source,'(직접 방문)') utm_source, COUNT(DISTINCT session_id) cnt FROM events WHERE event_name='page_view' GROUP BY utm_source ORDER BY cnt DESC LIMIT 10")
        ad_break = pq("SELECT COALESCE(utm_source,'(직접)') src, COALESCE(utm_campaign,'-') camp, COALESCE(json_extract(properties,'$.utm_content'),'-') content, COUNT(DISTINCT session_id) cnt FROM events WHERE event_name='page_view' AND utm_source IS NOT NULL GROUP BY src, camp, content ORDER BY cnt DESC LIMIT 20")
        payers   = pq("SELECT properties, created_at FROM events WHERE event_name='confirm_btn_click' ORDER BY id DESC LIMIT 50")
        devices  = pq("SELECT device, COUNT(DISTINCT session_id) cnt FROM events WHERE event_name='page_view' GROUP BY device ORDER BY cnt DESC")
        hourly_d = end if start else today
        hourly   = q("SELECT strftime('%H',created_at) hr, COUNT(DISTINCT session_id) cnt FROM events WHERE event_name='page_view' AND date(created_at)=? GROUP BY hr ORDER BY hr", hourly_d)
        plans    = pq("SELECT properties, COUNT(*) cnt FROM events WHERE event_name='plan_selected' GROUP BY properties ORDER BY cnt DESC")
        scroll   = pq("SELECT json_extract(properties,'$.depth') depth, COUNT(DISTINCT session_id) cnt FROM events WHERE event_name='scroll_depth' GROUP BY depth ORDER BY CAST(depth AS INTEGER)")
        sections = pq("SELECT json_extract(properties,'$.section') sec, COUNT(DISTINCT session_id) cnt FROM events WHERE event_name='section_view' GROUP BY sec ORDER BY cnt DESC")

    plans_out = []
    for p in plans:
        try: plans_out.append({'plan': json.loads(p['properties']).get('plan','?'), 'cnt': p['cnt']})
        except: pass

    return jsonify({
        'funnel': funnel,
        'today': {'visitors': today_pv, 'conversions': today_conv},
        'active_now': active,
        'recent':   [dict(r) for r in recent],
        'utms':     [dict(r) for r in utms],
        'ad_break': [dict(r) for r in ad_break],
        'payers':   [dict(r) for r in payers],
        'devices':  [dict(r) for r in devices],
        'hourly':   [dict(r) for r in hourly],
        'plans':    plans_out,
        'scroll':   [dict(r) for r in scroll],
        'sections': [dict(r) for r in sections],
    })

@app.route('/api/reset', methods=['POST'])
@require_auth
def reset_data():
    with db() as c:
        c.execute('DELETE FROM events')
        c.commit()
    return jsonify({'ok': True})

# ── Blocklist API ─────────────────────────────────────────────
@app.route('/api/blocklist', methods=['GET'])
@require_auth
def bl_get():
    with db() as c:
        rows = c.execute('SELECT ip FROM ip_blocklist ORDER BY created_at DESC').fetchall()
    return jsonify({'ips': [r['ip'] for r in rows]})

@app.route('/api/blocklist', methods=['POST'])
@require_auth
def bl_add():
    ip = (request.get_json(silent=True) or {}).get('ip', '').strip()
    if not ip:
        return jsonify({'error': 'IP required'}), 400
    with db() as c:
        c.execute('INSERT OR IGNORE INTO ip_blocklist (ip) VALUES (?)', (ip,))
        c.commit()
    return jsonify({'ok': True})

@app.route('/api/blocklist/<path:ip>', methods=['DELETE'])
@require_auth
def bl_del(ip):
    with db() as c:
        c.execute('DELETE FROM ip_blocklist WHERE ip=?', (ip,))
        c.commit()
    return jsonify({'ok': True})

# ── Dashboard & Static ────────────────────────────────────────
@app.route('/dashboard')
@require_auth
def dashboard():
    return send_from_directory(os.path.join(BASE_DIR, 'admin'), 'dashboard.html')

@app.route('/')
def root():
    return send_from_directory(STATIC_DIR, 'Landing.html')

@app.route('/v2/<path:path>')
def static_v2(path):
    return send_from_directory(STATIC_DIR, path)

@app.route('/<path:path>')
def static_root(path):
    try: return send_from_directory(STATIC_DIR, path)
    except: abort(404)

if __name__ == '__main__':
    print(f'\n  LOOKBOX Analytics Server')
    print(f'  Landing:   http://localhost:8080')
    print(f'  Dashboard: http://localhost:8080/dashboard  (PW: {DASH_PW})')
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
