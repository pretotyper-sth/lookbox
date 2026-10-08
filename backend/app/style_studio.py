import hashlib
import json
import os
import re
import math
import secrets
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from contextlib import contextmanager
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix='/api/studio')
_DB = Path(os.environ.get('STYLE_STUDIO_DB', str(Path(__file__).resolve().parents[1] / '.local/style-studio.sqlite3')))
_LOCK = threading.RLock()


@contextmanager
def db():
    _DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DB)
    conn.row_factory = sqlite3.Row
    conn.executescript('''
      CREATE TABLE IF NOT EXISTS looks(id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL, share TEXT UNIQUE);
      CREATE TABLE IF NOT EXISTS profiles(owner TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, owner TEXT NOT NULL, actor TEXT NOT NULL, kind TEXT NOT NULL, look_id TEXT, created_at TEXT NOT NULL, read INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS polls(token TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS poll_votes(token TEXT, visitor TEXT, choice INTEGER, PRIMARY KEY(token,visitor));
      CREATE TABLE IF NOT EXISTS state(owner TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS public_items(id TEXT, owner TEXT, payload TEXT NOT NULL, PRIMARY KEY(id,owner));
      CREATE TABLE IF NOT EXISTS reactions(share TEXT, visitor TEXT, kind TEXT, value TEXT, PRIMARY KEY(share,visitor,kind));
      CREATE TABLE IF NOT EXISTS replies(id TEXT PRIMARY KEY, share TEXT, visitor TEXT, name TEXT, text TEXT);
    ''')
    try:
        with conn:
            if 'created_at' not in {column['name'] for column in conn.execute('PRAGMA table_info(polls)')}:
                conn.execute("ALTER TABLE polls ADD COLUMN created_at TEXT NOT NULL DEFAULT ''")
            conn.execute("UPDATE polls SET created_at=? WHERE created_at=''", (datetime.now(timezone.utc).isoformat(),))
            yield conn
    finally:
        conn.close()


def owner(request: Request, x_studio_owner: str = Header(default='')):
    if request.client and request.client.host not in ('127.0.0.1', '::1', 'testclient'):
        raise HTTPException(403, '이 체험은 로컬에서만 사용할 수 있어요.')
    if len(x_studio_owner) < 24 or len(x_studio_owner) > 160:
        raise HTTPException(401, '체험 저장 정보가 없어요. 새로고침해 주세요.')
    return hashlib.sha256(x_studio_owner.encode()).hexdigest()


class LookBody(BaseModel):
    title: str = Field(default='나의 스타일', max_length=80)
    note: str = Field(default='', max_length=600)
    author: str = Field(default='나', max_length=40)
    mood: str = Field(default='데일리', max_length=40)
    occasion: str = Field(default='일상', max_length=40)
    background: str = Field(default='ivory', pattern='^(ivory|paper|sage|sand|ink|lime|pink|blue|lavender)$')
    items: list[dict] = Field(default_factory=list, max_length=20)
    decorations: list[dict] = Field(default_factory=list, max_length=80)
    photo: str = Field(default='', max_length=1600000)
    includePhoto: bool = False
    privacy: str = Field(default='private', pattern='^(private|link|public)$')
    allowRemix: bool = True
    origin: dict | None = None
    comparison: dict | None = None
    createdAt: str = ''


def clean_item(it):
    img = str(it.get('img', ''))
    if not (img.startswith('/prototype-assets/') or img.startswith('/studio-assets/feed-samples/') or img.startswith('https://') or img.startswith('data:image/jpeg;base64,') or img.startswith('data:image/png;base64,') or img.startswith('data:image/webp;base64,')):
        img = ''
    return {key: it.get(key) for key in ('id', 'name', 'category', 'kind', 'x', 'y', 'scale', 'rotation', 'z')} | {'img': img, 'brand': str(it.get('brand') or '')[:100], 'price': str(it.get('price') or '')[:40], 'showInfo': bool(it.get('showInfo')), **{key: str(it.get(key) or '')[:600 if key == 'note' else 100] for key in ('color', 'size', 'material', 'store', 'note')}, 'url': str(it.get('url') or '')[:2000] if str(it.get('url') or '').startswith('https://') else ''}


def clean_layer(layer):
    def number(key, default, low, high):
        try:
            value = float(layer.get(key, default))
            return max(low, min(high, value)) if math.isfinite(value) else default
        except (TypeError, ValueError):
            return default
    kind = layer.get('type', 'text')
    if kind not in ('text', 'image', 'stroke', 'giphy'):
        raise HTTPException(400, '지원하지 않는 장식 형식이에요.')
    result = {'id': str(layer.get('id', secrets.token_hex(12)))[:100], 'type': kind,
              'x': number('x', 50, 0, 100), 'y': number('y', 30, 0, 100),
              'scale': number('scale', 28, 4, 110), 'size': number('size', 26, 12, 70),
              'rotation': number('rotation', 0, -180, 180), 'z': number('z', 40, -500, 1500),
              'opacity': number('opacity', 1, .1, 1), 'ratio': number('ratio', 1, .02, 50),
              'motion': layer.get('motion') if layer.get('motion') in ('float', 'pulse', 'wiggle') else 'none'}
    for key in ('color', 'bg'):
        value = str(layer.get(key, ''))
        if re.fullmatch(r'#[0-9a-fA-F]{6}', value): result[key] = value
    result['label'] = str(layer.get('label', ''))[:180]
    source = str(layer.get('source', ''))
    if source.startswith('https://'): result['source'] = source[:2000]
    if kind == 'text':
        result['text'] = str(layer.get('text', ''))[:180]
        result['font'] = layer.get('font') if layer.get('font') in ('sans', 'bold', 'serif', 'mono', 'hand') else 'sans'
        if 'bold' in layer:
            result['bold'] = bool(layer['bold'])
        result['italic'] = bool(layer.get('italic', False))
        result['textStyle'] = layer.get('textStyle') if layer.get('textStyle') in ('plain', 'outline', 'label', 'shadow') else 'plain'
    elif kind == 'image':
        img = str(layer.get('img', ''))
        allowed = img.startswith(('https://', 'data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/webp;base64,', 'data:image/gif;base64,')) or re.fullmatch(r'/studio-assets/[a-z0-9-]+\.svg', img) or re.fullmatch(r'/prototype-assets/style[A-Za-z0-9]+\.webp', img) or re.fullmatch(r'/studio-assets/feed-samples/[a-z0-9-]+\.png', img)
        if not allowed or len(img) > 4100000: raise HTTPException(400, '콜라주 이미지 주소 또는 크기를 확인해 주세요.')
        result['img'] = img
    elif kind == 'giphy':
        gif = str(layer.get('giphyId', ''))
        if not re.fullmatch(r'[A-Za-z0-9]{4,100}', gif): raise HTTPException(400, 'GIPHY 링크를 확인해 주세요.')
        result['giphyId'] = gif
        result['source'] = 'https://giphy.com/embed/' + gif
    elif kind == 'stroke':
        points = layer.get('points', [])
        if not isinstance(points, list) or len(points) > 800: raise HTTPException(400, '펜 선의 길이를 확인해 주세요.')
        clean = []
        for point in points:
            if not isinstance(point, list) or len(point) != 2: raise HTTPException(400, '펜 좌표를 확인해 주세요.')
            try:
                x, y = float(point[0]), float(point[1])
                if not math.isfinite(x) or not math.isfinite(y): raise ValueError()
            except (TypeError, ValueError): raise HTTPException(400, '펜 좌표를 확인해 주세요.')
            clean.append([max(0, min(100, x)), max(0, min(100, y))])
        result['points'] = clean
        result['width'] = number('width', 1, .4, 8)
        result['brush'] = layer.get('brush') if layer.get('brush') in ('pen', 'marker', 'highlighter', 'dotted') else 'pen'
    return result


def payload(body):
    data = body.model_dump()
    data['items'] = [clean_item(it) for it in data['items']]
    if data['photo'] and not data['photo'].startswith(('data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,')):
        raise HTTPException(400, '사진 형식이 올바르지 않아요.')
    data['decorations'] = [clean_layer(it) for it in data['decorations']]
    if len(json.dumps(data)) > 16000000: raise HTTPException(413, '이미지가 많아요. 작은 파일로 바꿔 저장해 주세요.')
    if data['origin']:
        data['origin'] = {k: data['origin'].get(k, '') for k in ('id', 'title', 'author', 'sample')}
    if data['comparison']:
        data['comparison'] = {k: data['comparison'].get(k) for k in ('id', 'title', 'background', 'items', 'decorations')}
        data['comparison']['items'] = [clean_item(it) for it in (data['comparison'].get('items') or [])[:20]]
        data['comparison']['decorations'] = [clean_layer(it) for it in (data['comparison'].get('decorations') or [])[:80]]
    return data


def person(uid, conn):
    profile = conn.execute('SELECT payload FROM profiles WHERE owner=?', (uid,)).fetchone()
    data = json.loads(profile['payload']) if profile else {}
    return {'creatorId': uid[:16], 'author': data.get('author') or '나', 'avatar': data.get('feedAvatar') or ''}


def notify(conn, target, actor, kind, look_id=''):
    if target == actor: return
    event = f'{kind}:{target}:{actor}:{look_id}'
    conn.execute('INSERT OR IGNORE INTO notifications(id,owner,actor,kind,look_id,created_at) VALUES(?,?,?,?,?,?)',
                 (event, target, actor, kind, look_id, datetime.now(timezone.utc).isoformat()))


def social_counts(uid, conn):
    row = conn.execute('SELECT payload FROM state WHERE owner=?', (uid,)).fetchone()
    following = json.loads(row['payload']).get('follows', []) if row else []
    followers = [r['owner'] for r in conn.execute('SELECT * FROM state') if uid[:16] in json.loads(r['payload']).get('follows', []) and r['owner'] != uid]
    return following, followers


def public_look(row, conn):
    data = json.loads(row['payload'])
    result = {k: data.get(k) for k in ('title', 'note', 'author', 'mood', 'occasion', 'background', 'items', 'decorations', 'allowRemix', 'origin', 'comparison', 'createdAt')}
    result.update(id=row['id'], share=row['share'], creatorId=row['owner'][:16], privacy=data['privacy'], avatar=person(row['owner'], conn)['avatar'])
    result['photo'] = data.get('photo', '') if data.get('includePhoto') else ''
    result['includePhoto'] = bool(data.get('includePhoto'))
    counts = conn.execute('SELECT kind,value,COUNT(*) n FROM reactions WHERE share=? GROUP BY kind,value', (row['share'],)).fetchall()
    result['stats'] = {'likes': 0, 'views': 0, 'A': 0, 'B': 0}
    for r in counts:
        if r['kind'] == 'like': result['stats']['likes'] += r['n']
        if r['kind'] == 'view': result['stats']['views'] += r['n']
        if r['kind'] == 'vote' and r['value'] in ('A', 'B'): result['stats'][r['value']] += r['n']
    result['replies'] = [dict(r) for r in conn.execute('SELECT id,name,text FROM replies WHERE share=? ORDER BY rowid', (row['share'],))]
    return result


@router.get('/looks')
def list_looks(request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    with db() as conn:
        return {'looks': [json.loads(r['payload']) | {'id': r['id'], 'share': r['share'], 'creatorId': r['owner'][:16], 'stats': public_look(r, conn)['stats'] if r['share'] else None} for r in conn.execute('SELECT * FROM looks WHERE owner=? ORDER BY rowid DESC', (uid,))]}


@router.put('/looks/{look_id}')
def save_look(look_id: str, body: LookBody, request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    if not look_id or len(look_id) > 100: raise HTTPException(400, '스타일 주소가 올바르지 않아요.')
    data = payload(body)
    with _LOCK, db() as conn:
        row = conn.execute('SELECT * FROM looks WHERE id=?', (look_id,)).fetchone()
        if row and row['owner'] != uid: raise HTTPException(403, '내 스타일만 수정할 수 있어요.')
        share = (row['share'] if row else None) if data['privacy'] != 'private' else None
        if data['privacy'] != 'private' and not share: share = secrets.token_urlsafe(24)
        conn.execute('INSERT INTO looks VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,share=excluded.share', (look_id, uid, json.dumps(data, ensure_ascii=False), share))
        if data['privacy'] == 'public' and data.get('origin') and not data['origin'].get('sample'):
            original = conn.execute('SELECT * FROM looks WHERE share=? OR id=?', (data['origin']['id'], data['origin']['id'])).fetchone()
            if original and original['share'] and json.loads(original['payload']).get('allowRemix'):
                notify(conn, original['owner'], uid, 'restyle', look_id)

    return data | {'id': look_id, 'share': share}


@router.delete('/looks/{look_id}')
def delete_look(look_id: str, request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    with db() as conn:
        conn.execute('DELETE FROM looks WHERE id=? AND owner=?', (look_id, uid))
    return {'ok': True}


@router.get('/state')
def get_state(request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    with db() as conn:
        row = conn.execute('SELECT payload FROM state WHERE owner=?', (uid,)).fetchone()
    return json.loads(row['payload']) if row else {'collections': [], 'diary': [], 'follows': [], 'hidden': []}


@router.put('/state')
def save_state(body: dict, request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    data = {k: body.get(k, [])[:200] for k in ('collections', 'diary', 'follows', 'hidden') if isinstance(body.get(k, []), list)}
    encoded = json.dumps(data, ensure_ascii=False)
    if len(encoded) > 6000000: raise HTTPException(413, '사진 저장 공간이 가득 찼어요. 기록을 정리해 주세요.')
    with _LOCK, db() as conn:
        previous = conn.execute('SELECT payload FROM state WHERE owner=?', (uid,)).fetchone()
        old = json.loads(previous['payload']).get('follows', []) if previous else []
        for creator in data.get('follows', []):
            if creator not in old and re.fullmatch(r'[a-f0-9]{16}', str(creator)):
                target = conn.execute('SELECT owner FROM profiles WHERE substr(owner,1,16)=? UNION SELECT owner FROM looks WHERE substr(owner,1,16)=? LIMIT 1', (creator, creator)).fetchone()
                if target: notify(conn, target['owner'], uid, 'follow')
        conn.execute('INSERT INTO state VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET payload=excluded.payload', (uid, encoded))
    return data


class ItemVisibilityBody(BaseModel):
    item: dict = Field(default_factory=dict)
    public: bool = False


def creator_profile(creator_id, conn):
    rows = conn.execute("SELECT * FROM looks WHERE substr(owner,1,16)=? AND share IS NOT NULL ORDER BY rowid DESC", (creator_id,)).fetchall()
    posts = [public_look(r, conn) for r in rows if json.loads(r['payload'])['privacy'] == 'public']
    items = [json.loads(r['payload']) for r in conn.execute('SELECT payload FROM public_items WHERE substr(owner,1,16)=? ORDER BY rowid DESC', (creator_id,))]
    owner_row = conn.execute('SELECT owner FROM profiles WHERE substr(owner,1,16)=? UNION SELECT owner FROM looks WHERE substr(owner,1,16)=? LIMIT 1', (creator_id, creator_id)).fetchone()
    info = person(owner_row['owner'], conn) if owner_row else {'creatorId': creator_id, 'author': posts[0]['author'] if posts else '나', 'avatar': ''}
    following, followers = social_counts(owner_row['owner'], conn) if owner_row else ([], [])
    return info | {'looks': posts, 'items': items, 'following': len(following), 'followers': len(followers)}


@router.get('/profile')
def my_profile(request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    with db() as conn:
        return creator_profile(uid[:16], conn)


@router.get('/profiles/{creator_id}')
def profile(creator_id: str):
    if not re.fullmatch(r'[a-f0-9]{16}', creator_id): raise HTTPException(404, '프로필을 찾을 수 없어요.')
    with db() as conn:
        return creator_profile(creator_id, conn)


@router.put('/closet/{item_id}')
def item_visibility(item_id: str, body: ItemVisibilityBody, request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    if not item_id or len(item_id) > 100: raise HTTPException(400, '옷 주소를 확인해 주세요.')
    with _LOCK, db() as conn:
        if body.public:
            data = clean_item(body.item | {'id': item_id, 'kind': 'owned'})
            encoded = json.dumps(data, ensure_ascii=False)
            if len(encoded) > 2000000: raise HTTPException(413, '이미지가 너무 커요.')
            conn.execute('INSERT INTO public_items VALUES(?,?,?) ON CONFLICT(id,owner) DO UPDATE SET payload=excluded.payload', (item_id, uid, encoded))
        else:
            conn.execute('DELETE FROM public_items WHERE id=? AND owner=?', (item_id, uid))
        return creator_profile(uid[:16], conn)


@router.get('/feed')
def feed(request: Request, x_studio_owner: str = Header(default='')):
    visitor = owner(request, x_studio_owner) if x_studio_owner else ''
    with db() as conn:
        looks = [public_look(r, conn) for r in conn.execute('SELECT * FROM looks WHERE share IS NOT NULL ORDER BY rowid DESC') if json.loads(r['payload'])['privacy'] == 'public']
        for look in looks:
            look['myLike'] = bool(conn.execute('SELECT 1 FROM reactions WHERE share=? AND visitor=? AND kind=?', (look['share'], visitor, 'like')).fetchone())
    return {'looks': looks}


def shared_row(share, conn):
    row = conn.execute('SELECT * FROM looks WHERE share=?', (share,)).fetchone()
    if not row: raise HTTPException(404, '공유가 종료됐거나 존재하지 않는 스타일이에요.')
    return row


@router.get('/shared/{share}')
def shared(share: str, request: Request, x_studio_owner: str = Header(default='')):
    visitor = owner(request, x_studio_owner)
    with db() as conn:
        row = shared_row(share, conn)
        conn.execute('INSERT OR IGNORE INTO reactions VALUES(?,?,?,?)', (share, visitor, 'view', '1'))
        result = public_look(row, conn)
        result['myLike'] = bool(conn.execute('SELECT 1 FROM reactions WHERE share=? AND visitor=? AND kind=?', (share, visitor, 'like')).fetchone())
        vote = conn.execute('SELECT value FROM reactions WHERE share=? AND visitor=? AND kind=?', (share, visitor, 'vote')).fetchone()
        result['myVote'] = vote['value'] if vote else ''
    return result


@router.post('/shared/{share}/reaction')
def react(share: str, body: dict, request: Request, x_studio_owner: str = Header(default='')):
    visitor = owner(request, x_studio_owner)
    kind, value = body.get('kind'), body.get('value')
    if kind not in ('like', 'vote') or (kind == 'vote' and value not in ('A', 'B')): raise HTTPException(400, '반응을 확인해 주세요.')
    with _LOCK, db() as conn:
        row = shared_row(share, conn)
        if kind == 'vote' and not json.loads(row['payload']).get('comparison'): raise HTTPException(400, '비교 코디가 없어요.')
        conn.execute('DELETE FROM reactions WHERE share=? AND visitor=? AND kind=?', (share, visitor, kind))
        if value:
            conn.execute('INSERT INTO reactions VALUES(?,?,?,?)', (share, visitor, kind, str(value)))
            if kind == 'like': notify(conn, row['owner'], visitor, 'like', row['id'])
    return {'ok': True}


@router.post('/shared/{share}/reply')
def reply(share: str, body: dict, request: Request, x_studio_owner: str = Header(default='')):
    visitor = owner(request, x_studio_owner)
    text = str(body.get('text', '')).strip()[:600]
    if not text: raise HTTPException(400, '스타일링 제안을 적어 주세요.')
    with db() as conn:
        shared_row(share, conn)
        conn.execute('INSERT INTO replies VALUES(?,?,?,?,?)', (secrets.token_urlsafe(12), share, visitor, str(body.get('name', '친구'))[:40], text))
    return {'ok': True}


class PollBody(BaseModel):
    question: str = Field(default='어떤 코디가 더 좋아?', min_length=1, max_length=80)
    lookIds: list[str] = Field(min_length=2, max_length=4)


class PollVoteBody(BaseModel):
    choice: int = Field(ge=0, le=3)


def poll_result(token, visitor, conn, now=None):
    row = conn.execute('SELECT * FROM polls WHERE token=?', (token,)).fetchone()
    if not row: raise HTTPException(404, '종료됐거나 존재하지 않는 투표예요.')
    expires_at = datetime.fromisoformat(row['created_at']) + timedelta(days=7)
    if expires_at <= (now or datetime.now(timezone.utc)):
        raise HTTPException(404, '기간이 지나 종료된 투표예요.')
    result = json.loads(row['payload'])
    counts = [0] * len(result['looks'])
    for vote in conn.execute('SELECT choice,COUNT(*) n FROM poll_votes WHERE token=? GROUP BY choice', (token,)):
        counts[vote['choice']] = vote['n']
    mine = conn.execute('SELECT choice FROM poll_votes WHERE token=? AND visitor=?', (token, visitor)).fetchone()
    return result | {'token': token, 'createdAt': row['created_at'], 'expiresAt': expires_at.isoformat(), 'counts': counts, 'total': sum(counts), 'myVote': mine['choice'] if mine else None}


@router.post('/polls')
def create_poll(body: PollBody, request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    if len(set(body.lookIds)) != len(body.lookIds): raise HTTPException(400, '서로 다른 스타일을 골라 주세요.')
    with _LOCK, db() as conn:
        looks = []
        for look_id in body.lookIds:
            row = conn.execute('SELECT * FROM looks WHERE id=? AND owner=?', (look_id, uid)).fetchone()
            if not row: raise HTTPException(404, '내가 저장한 스타일만 투표에 넣을 수 있어요.')
            look = public_look(row, conn)
            looks.append({k: look[k] for k in ('title', 'author', 'background', 'items', 'decorations', 'photo', 'includePhoto')})
        data = {'question': body.question, 'looks': looks}
        if len(json.dumps(data)) > 16000000: raise HTTPException(413, '이미지가 많아요. 스타일 수를 줄여 주세요.')
        token = secrets.token_urlsafe(24)
        conn.execute('INSERT INTO polls(token,owner,payload,created_at) VALUES(?,?,?,?)', (token, uid, json.dumps(data, ensure_ascii=False), datetime.now(timezone.utc).isoformat()))
        return poll_result(token, uid, conn)


@router.get('/polls')
def my_polls(request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    with db() as conn:
        now = datetime.now(timezone.utc)
        cutoff = (now - timedelta(days=7)).isoformat()
        return {'polls': [poll_result(r['token'], uid, conn, now) for r in conn.execute('SELECT token FROM polls WHERE owner=? AND created_at>? ORDER BY rowid DESC', (uid, cutoff))]}


@router.get('/polls/{token}')
def get_poll(token: str, request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    with db() as conn:
        return poll_result(token, uid, conn)


@router.post('/polls/{token}/vote')
def vote_poll(token: str, body: PollVoteBody, request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    with _LOCK, db() as conn:
        data = poll_result(token, uid, conn)
        if body.choice >= len(data['looks']): raise HTTPException(400, '투표할 코디를 골라 주세요.')
        conn.execute('INSERT INTO poll_votes VALUES(?,?,?) ON CONFLICT(token,visitor) DO UPDATE SET choice=excluded.choice', (token, uid, body.choice))
        return poll_result(token, uid, conn)


@router.delete('/polls/{token}')
def close_poll(token: str, request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    with _LOCK, db() as conn:
        row = conn.execute('SELECT owner FROM polls WHERE token=?', (token,)).fetchone()
        if not row or row['owner'] != uid: raise HTTPException(403, '내 투표만 종료할 수 있어요.')
        conn.execute('DELETE FROM polls WHERE token=?', (token,))
        conn.execute('DELETE FROM poll_votes WHERE token=?', (token,))
    return {'ok': True}


class ProfileBody(BaseModel):
    author: str = Field(default='나', max_length=40)
    avatar: str | None = Field(default=None, max_length=1600000)


@router.put('/profile')
def update_profile(body: ProfileBody, request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    avatar = body.avatar
    if avatar and not avatar.startswith(('https://', '/prototype-assets/', 'data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,')):
        raise HTTPException(400, '프로필 사진 형식을 확인해 주세요.')
    with db() as conn:
        row = conn.execute('SELECT payload FROM profiles WHERE owner=?', (uid,)).fetchone()
        data = json.loads(row['payload']) if row else {}
        data['author'] = body.author
        if avatar is not None:
            data['feedAvatar'] = avatar
        conn.execute('INSERT INTO profiles VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET payload=excluded.payload', (uid, json.dumps(data)))
        return creator_profile(uid[:16], conn)


@router.get('/social')
def my_social(request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    with db() as conn:
        profile = creator_profile(uid[:16], conn)
        following, followers = social_counts(uid, conn)
        people = []
        for creator in following:
            if str(creator).startswith('sample:'):
                people.append({'creatorId': creator, 'author': creator[7:], 'sample': True})
            elif re.fullmatch(r'[a-f0-9]{16}', str(creator)):
                people.append({k: creator_profile(creator, conn)[k] for k in ('creatorId', 'author', 'avatar')})
        return profile | {'followingPeople': people, 'followerPeople': [person(x, conn) for x in followers]}


@router.get('/notifications')
def notifications(request: Request, x_studio_owner: str = Header(default=''), offset: int = 0, limit: int = 30):
    uid = owner(request, x_studio_owner)
    with db() as conn:
        result = []
        offset, limit = max(0, offset), max(1, min(100, limit))
        rows = conn.execute('SELECT * FROM notifications WHERE owner=? ORDER BY created_at DESC,rowid DESC LIMIT ? OFFSET ?', (uid, limit + 1, offset)).fetchall()
        for row in rows[:limit]:
            look = conn.execute('SELECT * FROM looks WHERE id=?', (row['look_id'],)).fetchone()
            public = public_look(look, conn) if look and look['share'] and (json.loads(look['payload'])['privacy'] == 'public' or look['owner'] == uid) else None
            result.append({'id': row['id'], 'kind': row['kind'], 'actor': person(row['actor'], conn), 'look': public, 'createdAt': row['created_at'], 'read': bool(row['read'])})
        unread = conn.execute('SELECT COUNT(*) n FROM notifications WHERE owner=? AND read=0', (uid,)).fetchone()['n']
        return {'notifications': result, 'unread': unread, 'hasMore': len(rows) > limit}


@router.post('/notifications/read')
def read_notifications(body: dict, request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    ids = body.get('ids', [])
    if not isinstance(ids, list) or len(ids) > 100: raise HTTPException(400, '알림을 확인해 주세요.')
    with db() as conn:
        for identifier in ids:
            if isinstance(identifier, str): conn.execute('UPDATE notifications SET read=1 WHERE owner=? AND id=?', (uid, identifier))
    return {'ok': True}


@router.get('/sample-reactions')
def sample_reactions(request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    with db() as conn:
        return {'looks': [{'id': f'editorial-v4-{i}', 'stats': {'likes': conn.execute('SELECT COUNT(*) n FROM reactions WHERE share=? AND kind=?', (f'sample:{i}', 'like')).fetchone()['n']}, 'myLike': bool(conn.execute('SELECT 1 FROM reactions WHERE share=? AND visitor=? AND kind=?', (f'sample:{i}', uid, 'like')).fetchone())} for i in range(8)]}


@router.post('/samples/{identifier}/reaction')
def sample_like(identifier: str, body: dict, request: Request, x_studio_owner: str = Header(default='')):
    uid = owner(request, x_studio_owner)
    if not re.fullmatch(r'editorial-v4-[0-7]', identifier): raise HTTPException(404, '예시 스타일을 찾지 못했어요.')
    share = 'sample:' + identifier[-1]
    with _LOCK, db() as conn:
        conn.execute('DELETE FROM reactions WHERE share=? AND visitor=? AND kind=?', (share, uid, 'like'))
        if body.get('value'): conn.execute('INSERT INTO reactions VALUES(?,?,?,?)', (share, uid, 'like', '1'))
    return {'ok': True}
