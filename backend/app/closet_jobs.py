"""Local durable jobs; the server owns work after upload acknowledgement."""
import json
import base64
import sqlite3
import threading
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from PIL import Image
import io
from contextlib import contextmanager, asynccontextmanager


class JobStore:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, owner TEXT, request_id TEXT, kind TEXT, status TEXT, payload TEXT, result TEXT, UNIQUE(owner,request_id))')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def create(self, owner, request_id, kind, payload):
        with self.lock, self.connect() as db:
            old = db.execute('SELECT * FROM jobs WHERE owner=? AND request_id=?', (owner, request_id)).fetchone()
            if old:
                return self.public(old)
            count = db.execute("SELECT COUNT(*) FROM jobs WHERE owner=? AND status IN ('queued','running')", (owner,)).fetchone()[0]
            if count >= 2:
                raise HTTPException(429, '진행 중인 작업이 끝나면 다시 요청해 주세요.')
            jid = uuid.uuid4().hex
            db.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?,?)', (jid, owner, request_id, kind, 'queued', json.dumps(payload), '{}'))
            return self.public(db.execute('SELECT * FROM jobs WHERE id=?', (jid,)).fetchone())

    @staticmethod
    def public(row):
        payload = json.loads(row['payload'])
        return {'id': row['id'], 'kind': row['kind'], 'status': row['status'], 'generation_revision':payload.get('generation_revision','legacy'), 'gender':payload.get('gender',''), 'character':payload.get('character',False), 'personal':bool(payload.get('personal',False)), 'height':payload.get('height',''), 'weight':payload.get('weight',''), 'use_face':bool(payload.get('face')), 'personal_color':payload.get('personal_color',''), 'total': len(payload.get('items', [])) if row['kind'] == 'import' else 1, **json.loads(row['result'])}

    def list(self, owner):
        with self.connect() as db:
            return [self.public(r) for r in db.execute('SELECT * FROM jobs WHERE owner=? ORDER BY rowid DESC LIMIT 12', (owner,))]

    def update(self, jid, result, status='running'):
        with self.lock, self.connect() as db:
            db.execute('UPDATE jobs SET status=?,result=? WHERE id=?', (status, json.dumps(result), jid))

    def next(self):
        with self.lock, self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY rowid LIMIT 1").fetchone()
            if row:
                db.execute("UPDATE jobs SET status='running' WHERE id=?", (row['id'],))
            return dict(row) if row else None

    def resume(self):
        with self.connect() as db:
            db.execute("UPDATE jobs SET status='queued' WHERE status='running'")


class DressRequest(BaseModel):
    request_id: str = Field(min_length=8, max_length=100)
    item_ids: list[str] = Field(default_factory=list, max_length=6)
    resources: list[dict] = Field(default_factory=list, max_length=6)
    gender: str = Field(default='', max_length=20)
    face: str = Field(default='', max_length=12000000)
    height: str = Field(default='', max_length=10)
    weight: str = Field(default='', max_length=10)
    generation_revision: str = Field(default='gender-reviewed-v2', max_length=80)
    personal: bool = False
    personal_color: str = Field(default='', max_length=80)
    styles: list[str] = Field(default_factory=list, max_length=10)
    character: bool = False
    pose: str = Field(default='자연스럽게 서 있기', max_length=100)


def install(app, main):
    store = JobStore(Path(__file__).resolve().parents[1] / '.local/closet-jobs.sqlite3')
    images = store.path.parent / 'import-sources'
    images.mkdir(exist_ok=True)
    wake, stop = threading.Event(), threading.Event()
    router = APIRouter(prefix='/api/live/closet-jobs')

    @router.get('')
    def jobs(user=Depends(main.current_user)):
        return {'jobs': store.list(user.id)}

    @router.post('/import', status_code=202)
    async def submit_import(metadata: str = Form(...), request_id: str = Form(...), images_in: list[UploadFile] = File(...), user=Depends(main.current_user)):
        try:
            rows = json.loads(metadata)
        except (ValueError, TypeError):
            raise HTTPException(400, '상품 정보를 읽지 못했어요.')
        if not isinstance(rows, list) or not 1 <= len(rows) <= 100 or len(rows) != len(images_in) or not 8 <= len(request_id) <= 100:
            raise HTTPException(400, '한 번에 1~100개를 선택해 주세요.')
        prepared, paths, total = [], [], 0
        try:
            for row, image in zip(rows, images_in):
                if not isinstance(row, dict):
                    raise HTTPException(400, '상품 정보를 확인해 주세요.')
                raw = await image.read(8 * 1024 * 1024 + 1)
                total += len(raw)
                if len(raw) > 8 * 1024 * 1024 or total > 100 * 1024 * 1024:
                    raise HTTPException(413, '사진 용량이 커요. 나눠서 접수해 주세요.')
                try:
                    with Image.open(io.BytesIO(raw)) as check:
                        image_format = check.format
                        if image_format not in {'JPEG','PNG','WEBP','GIF'} or check.width * check.height > 24000000:
                            raise ValueError('unsupported image')
                        check.verify()
                except Exception:
                    raise HTTPException(400, '유효한 상품 사진이 필요해요.')
                path = images / (uuid.uuid4().hex + '.img')
                path.write_bytes(raw)
                paths.append(path)
                prepared.append({k: str(row.get(k) or '')[:500] for k in ['name','brand','store','price','material','color','url']} | {'path': str(path), 'suffix': {'JPEG':'.jpg','PNG':'.png','WEBP':'.webp','GIF':'.gif'}[image_format], 'content_type': Image.MIME[image_format], 'public': row.get('public') is True})
            job = store.create(user.id, request_id, 'import', {'items': prepared})
            with store.connect() as db:
                existing = json.loads(db.execute('SELECT payload FROM jobs WHERE id=?', (job['id'],)).fetchone()[0])
            if existing != {'items': prepared}:
                for path in paths: path.unlink(missing_ok=True)
            wake.set()
            return job
        except Exception:
            for path in paths: path.unlink(missing_ok=True)
            raise

    @router.post('/dress', status_code=202)
    def submit_dress(body: DressRequest, user=Depends(main.current_user)):
        if body.character:
            raise HTTPException(400, '캐릭터 변경 메뉴를 이용해 주세요.')
        if not 2 <= len(body.item_ids) + len(body.resources) <= 6:
            raise HTTPException(400, '아이템을 2~6개 골라 주세요.')
        if body.face:
            main._face_image_bytes(body.face)
        job = store.create(user.id, body.request_id, 'dress', body.model_dump())
        wake.set()
        return job

    @router.post('/character', status_code=202)
    def submit_character(body: DressRequest, user=Depends(main.current_user)):
        if body.face:
            main._face_image_bytes(body.face)
        payload = body.model_dump() | {'character':True, 'item_ids':[], 'resources':[]}
        job = store.create(user.id, body.request_id, 'dress', payload)
        wake.set()
        return job

    @router.post('/{job_id}/save')
    def save_dress(job_id: str, user=Depends(main.current_user)):
        with store.lock, store.connect() as db:
            row = db.execute("SELECT * FROM jobs WHERE id=? AND owner=? AND kind='dress' AND status='done'", (job_id, user.id)).fetchone()
            if not row:
                raise HTTPException(404, '완료된 착장을 찾지 못했어요.')
            result = json.loads(row['result'])
            if result.get('saved_id'):
                return {'id': result['saved_id']}
            outfit = result['outfit']
            saved = main.supabase_admin.table('outfits').insert({'user_id':user.id,'label':outfit['label'],'mood':'직접 만든 코디','type':'manual','item_ids':outfit['itemIds'],'saved':True,'look_image_url':outfit['lookImg'],'metadata':{'styles':[], 'studio_items': result['items'], 'closet_job_id': job_id}}).execute().data[0]
            result['saved_id'] = saved['id']
            db.execute('UPDATE jobs SET result=? WHERE id=?', (json.dumps(result), job_id))
            return {'id': saved['id']}

    def process_import(job):
        payload = json.loads(job['payload'])
        result = json.loads(job['result'])
        completed = result.get('completed', [])
        for index, it in enumerate(payload['items']):
            if any(x['index'] == index for x in completed):
                continue
            store.update(job['id'], {'completed': completed, 'current': it['name'], 'processed': len(completed)})
            try:
                raw = Path(it['path']).read_bytes()
                hit = main._match_duplicate(main._wardrobe_dupe_index(job['owner']), url=it['url'], name=it['name'], fp=main._image_fingerprint(raw))
                if hit:
                    completed.append({'index': index, 'name': it['name'], 'status':'duplicate'})
                else:
                    row = main._store_uploaded_item(job['owner'], raw, it.get('suffix','.jpg'), it.get('content_type','image/jpeg'), 'owned', source='order', name_override=it['name'], source_url=it['url'], brand=it['brand'], store=it['store'], price=it['price'], material=it['material'], color_override=it['color'])
                    if it['public']:
                        main.supabase_admin.table('wardrobe_items').update({'metadata': {**(row.get('metadata') or {}),'public': True}}).eq('id', row['id']).eq('user_id',job['owner']).execute()
                    completed.append({'index':index,'name':it['name'],'status':'saved','id':row['id']})
            except Exception as exc:
                completed.append({'index':index,'name':it['name'],'status':'failed','error':str(getattr(exc,'detail', '추출하지 못했어요. 사진으로 다시 추가해 주세요.'))})
            store.update(job['id'], {'completed':completed, 'processed':len(completed)})
            Path(it['path']).unlink(missing_ok=True)
        store.update(job['id'], {'completed': completed,'processed':len(completed)}, 'done')

    def process_dress(job):
        body = json.loads(job['payload'])
        rows = main._wardrobe_rows_by_ids(job['owner'], body['item_ids'])
        if len(rows) != len(set(body['item_ids'])):
            raise HTTPException(400, '옷장 아이템이 변경됐어요. 다시 골라 주세요.')
        resource_ids = []
        for resource in body['resources']:
            url = str(resource.get('img') or '')
            if url.startswith(('data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/webp;base64,')):
                encoded = url.split(',', 1)[1]
                if len(encoded) > 12 * 1024 * 1024:
                    raise HTTPException(413, '재료 사진이 너무 커요.')
                try:
                    raw = base64.b64decode(encoded, validate=True)
                except ValueError:
                    raise HTTPException(400, '재료 사진을 읽지 못했어요.')
            elif url.startswith(main.SUPABASE_URL.rstrip('/') + '/storage/v1/object/public/'):
                response = main.requests.get(url, timeout=20)
                response.raise_for_status()
                raw = response.content
            else:
                raise HTTPException(400, '재료 사진을 다시 선택해 주세요.')
            if len(raw) > 8 * 1024 * 1024:
                raise HTTPException(413, '재료 사진이 너무 커요.')
            with Image.open(io.BytesIO(raw)) as im:
                im.thumbnail((1536, 1536))
                buf = io.BytesIO()
                im.convert('RGBA').save(buf, format='PNG')
                raw = buf.getvalue()
            rid = 'resource-' + uuid.uuid4().hex
            path = f"{job['owner']}/studio/{rid}.png"
            uploaded_url = main.upload_bytes(path, raw, 'image/png')
            rows.append({'id':rid,'name':str(resource.get('name') or '저장한 아이템')[:120],'category':str(resource.get('category') or 'top'),'color':str(resource.get('color') or ''),'storage_path':path,'image_url':uploaded_url,'brand':str(resource.get('brand') or '')[:120]})
            resource_ids.append(rid)
        if body.get('character'):
            rows = [{'id':'base-top','name':'무지 아이보리 반팔 티셔츠','category':'top','color':'ivory'}, {'id':'base-bottom','name':'라이트 그레이 스트레이트 팬츠','category':'bottom','color':'light gray'}, {'id':'base-shoes','name':'무지 흰색 스니커즈','category':'shoes','color':'white'}]
        character_path = Path(__file__).resolve().parents[2] / 'frontend/public/studio-assets/characters' / f'default-{main._look_gender_key(body["gender"])}.png'
        composition = None
        if character_path.is_file():
            with Image.open(character_path) as im:
                im.thumbnail((768, 960))
                buf = io.BytesIO()
                im.save(buf, format='PNG')
                composition = buf.getvalue()
        reference = main._face_image_bytes(body['face']) if body.get('personal') and body['face'] else composition
        def stage(key):
            store.update(job['id'], {'stage':key})
        url = main.generate_model_look_image(job['owner'], [r['id'] for r in rows]+['studio-'+job['id']], rows, body['gender'], reference_png=reference, composition_reference_png=composition, stage=stage, personal=bool(body.get('personal')), styles=body.get('styles') or [], height=body['height'], weight=body['weight'], user_request=f"직접 선택한 아이템을 모두 착용. 포즈: {body['pose']}. 새로운 스타일링으로 연출. 퍼스널 컬러 {body.get('personal_color','') if body.get('personal') else ''}는 피부와 메이크업의 자연스러운 톤에만 참고하고 상품의 원래 색은 유지.")
        if not url:
            raise HTTPException(502, '착장을 만들지 못했어요. 다시 시도해 주세요.')
        store.update(job['id'], {'gender':body['gender'],'character':bool(body.get('character')),'personal':bool(body.get('personal')),'test_mode':main.AI_TEST_MODE,'processed':1,'outfit':{'id':'studio-'+job['id'],'label':'내가 찾은 코디','itemIds':[r['id'] for r in rows],'lookImg':url},'items':[main.live_item_payload(r) for r in rows]}, 'done')

    def worker():
        while not stop.is_set():
            job = store.next()
            if not job:
                wake.wait(2)
                wake.clear()
                continue
            try:
                (process_import if job['kind'] == 'import' else process_dress)(job)
            except Exception as exc:
                store.update(job['id'], {'error':str(getattr(exc,'detail','작업을 완료하지 못했어요. 다시 시도해 주세요.'))}, 'failed')

    previous_lifespan = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(application):
        async with previous_lifespan(application) as state:
            store.resume()
            thread = threading.Thread(target=worker, daemon=True, name='closet-jobs')
            thread.start()
            try:
                yield state
            finally:
                stop.set()
                wake.set()
                thread.join(timeout=1)

    app.router.lifespan_context = lifespan

    app.include_router(router)
    return store
