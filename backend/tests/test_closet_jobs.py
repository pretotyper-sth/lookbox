import io
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from app.closet_jobs import JobStore, install


class DurableJobsTests(unittest.TestCase):
    def test_restart_resume_and_idempotency_and_owner_isolation(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'jobs.sqlite3'
            store=JobStore(path)
            one=store.create('alice','request-001','import',{'items':[{},{}]})
            store.next()
            store.update(one['id'],{'processed':1,'completed':[{'index':0,'status':'saved'}]})
            restarted=JobStore(path)
            restarted.resume()
            claimed=restarted.next()
            self.assertEqual(claimed['id'],one['id'])
            self.assertEqual(restarted.list('alice')[0]['processed'],1)
            self.assertEqual(store.create('alice','request-001','import',{'items':[{}]})['id'],one['id'])
            self.assertEqual(restarted.list('bob'),[])

    def test_two_active_jobs_limit(self):
        with tempfile.TemporaryDirectory() as folder:
            store=JobStore(Path(folder)/'jobs.sqlite3')
            store.create('alice','request-001','dress',{})
            store.create('alice','request-002','dress',{})
            with self.assertRaises(Exception) as caught:
                store.create('alice','request-003','dress',{})
            self.assertEqual(caught.exception.status_code,429)

    def test_upload_is_accepted_before_processing_and_survives_request(self):
        import threading
        gate=threading.Event()
        entered=threading.Event()
        def extract(*args,**kwargs):
            entered.set()
            gate.wait(3)
            return {'id':'saved-shirt','metadata':{}}
        main=SimpleNamespace(current_user=lambda:SimpleNamespace(id='alice'),_wardrobe_dupe_index=lambda uid:[],_match_duplicate=lambda *a,**kw:None,_image_fingerprint=lambda raw:{},_store_uploaded_item=extract)
        raw=io.BytesIO();Image.new('RGB',(16,16),'white').save(raw,format='PNG')
        with tempfile.TemporaryDirectory() as folder, patch('app.closet_jobs.JobStore', side_effect=lambda _:JobStore(Path(folder)/'jobs.sqlite3')):
            app=FastAPI();install(app,main)
            with TestClient(app) as client:
                response=client.post('/api/live/closet-jobs/import',data={'metadata':'[{"name":"셔츠","url":"https://shop.example/shirt"}]','request_id':'request-001'},files={'images_in':('shirt.png',raw.getvalue(),'image/png')})
                self.assertEqual(response.status_code,202)
                self.assertTrue(entered.wait(1))
                self.assertEqual(client.get('/api/live/closet-jobs').json()['jobs'][0]['status'],'running')
                gate.set()
                for _ in range(40):
                    job=client.get('/api/live/closet-jobs').json()['jobs'][0]
                    if job['status']=='done':break
                    time.sleep(.025)
                self.assertEqual(job['completed'][0]['id'],'saved-shirt')
                self.assertEqual(job['status'],'done')
                self.assertFalse(list((Path(folder)/'import-sources').glob('*')))

    def test_failure_does_not_lose_other_items(self):
        def extract(uid,raw,*args,**kwargs):
            if kwargs['name_override']=='bad':raise ValueError('bad')
            return {'id':'ok','metadata':{}}
        main=SimpleNamespace(current_user=lambda:SimpleNamespace(id='alice'),_wardrobe_dupe_index=lambda uid:[],_match_duplicate=lambda *a,**kw:None,_image_fingerprint=lambda raw:{},_store_uploaded_item=extract)
        raw=io.BytesIO();Image.new('RGB',(16,16),'white').save(raw,format='PNG')
        with tempfile.TemporaryDirectory() as folder, patch('app.closet_jobs.JobStore', side_effect=lambda _:JobStore(Path(folder)/'jobs.sqlite3')):
            app=FastAPI();install(app,main)
            with TestClient(app) as client:
                response=client.post('/api/live/closet-jobs/import',data={'metadata':'[{"name":"bad"},{"name":"good"}]','request_id':'request-001'},files=[('images_in',('a.png',raw.getvalue(),'image/png')),('images_in',('b.png',raw.getvalue(),'image/png'))])
                self.assertEqual(response.status_code,202)
                for _ in range(40):
                    job=client.get('/api/live/closet-jobs').json()['jobs'][0]
                    if job['status']=='done':break
                    time.sleep(.025)
                self.assertEqual([x['status'] for x in job['completed']],['failed','saved'])

    def test_dress_uses_user_items_measurements_and_unique_variant(self):
        calls=[]
        def generate(owner,ids,rows,gender,**options):
            calls.append((owner,ids,rows,gender,options))
            return 'https://example.com/look.png'
        main=SimpleNamespace(current_user=lambda:SimpleNamespace(id='alice'),_wardrobe_rows_by_ids=lambda uid,ids:[{'id':i,'name':i,'category':'top','image_url':'https://example.com/a.png'} for i in ids],_look_gender_key=lambda gender:'m',generate_model_look_image=generate,live_item_payload=lambda row:row,AI_TEST_MODE=True)
        with tempfile.TemporaryDirectory() as folder, patch('app.closet_jobs.JobStore', side_effect=lambda _:JobStore(Path(folder)/'jobs.sqlite3')):
            app=FastAPI();install(app,main)
            with TestClient(app) as client:
                response=client.post('/api/live/closet-jobs/dress',json={'request_id':'dress-001','item_ids':['shirt','pants'],'gender':'남성','personal':True,'height':'175','weight':'68','pose':'한 걸음 걷기'})
                self.assertEqual(response.status_code,202)
                for _ in range(40):
                    job=client.get('/api/live/closet-jobs').json()['jobs'][0]
                    if job['status']=='done':break
                    time.sleep(.025)
                self.assertEqual(job['outfit']['itemIds'],['shirt','pants'])
                self.assertEqual(calls[0][4]['height'],'175')
                self.assertTrue(calls[0][4]['personal'])
                self.assertIn('한 걸음 걷기',calls[0][4]['user_request'])
                self.assertTrue(calls[0][1][-1].startswith('studio-'))
                self.assertTrue(job['test_mode'])
                self.assertEqual(job['gender'],'남성')
                self.assertTrue(job['personal'])
                self.assertEqual(job['height'],'175')
                self.assertEqual(job['weight'],'68')
                self.assertFalse(job['use_face'])
                self.assertEqual(job['generation_revision'],'gender-reviewed-v2')
                self.assertTrue(calls[0][4]['composition_reference_png'])
                self.assertEqual(calls[0][4]['reference_png'],calls[0][4]['composition_reference_png'])

    def test_invalid_images_do_not_queue_jobs(self):
        main=SimpleNamespace(current_user=lambda:SimpleNamespace(id='alice'))
        with tempfile.TemporaryDirectory() as folder, patch('app.closet_jobs.JobStore', side_effect=lambda _:JobStore(Path(folder)/'jobs.sqlite3')):
            app=FastAPI();store=install(app,main)
            with TestClient(app) as client:
                response=client.post('/api/live/closet-jobs/import',data={'metadata':'[{"name":"bad"}]','request_id':'request-001'},files={'images_in':('a.png',b'not an image','image/png')})
                self.assertEqual(response.status_code,400)
                self.assertEqual(store.list('alice'),[])
