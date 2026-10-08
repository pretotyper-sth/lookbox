import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app import style_studio

A = {'X-Studio-Owner': 'a' * 48}
B = {'X-Studio-Owner': 'b' * 48}
BODY = {'title': '내 스타일', 'items': [{'id': 'shirt', 'name': '셔츠', 'img': '/prototype-assets/shirt.webp', 'kind': 'sample', 'price': 99000}], 'photo': 'data:image/jpeg;base64,AAAA'}

class StudioTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.previous = style_studio._DB
        style_studio._DB = Path(self.directory.name) / 'studio.sqlite3'
        app = FastAPI()
        app.include_router(style_studio.router)
        self.client = TestClient(app)
    def tearDown(self):
        self.client.close()
        style_studio._DB = self.previous
        self.directory.cleanup()
    def save(self, identifier, **kwargs):
        response = self.client.put('/api/studio/looks/' + identifier, headers=A, json=BODY | kwargs)
        self.assertEqual(response.status_code, 200)
        return response.json()
    def test_private_isolation_and_public_projection(self):
        self.assertIsNone(self.save('one')['share'])
        self.assertEqual(self.client.get('/api/studio/feed').json()['looks'], [])
        self.assertEqual(self.client.get('/api/studio/looks', headers=B).json()['looks'], [])
        self.assertEqual(self.client.put('/api/studio/looks/one', headers=B, json=BODY).status_code, 403)
        saved = self.save('one', privacy='public')
        public = self.client.get('/api/studio/shared/' + saved['share'], headers=B).json()
        self.assertEqual(public['photo'], '')
        self.assertNotIn('price', public['items'][0])
        self.assertEqual(public['items'][0]['kind'], 'sample')
        self.assertEqual(len(self.client.get('/api/studio/feed').json()['looks']), 1)
    def test_link_unlisted_and_revoked(self):
        saved = self.save('link', privacy='link', includePhoto=True)
        url = '/api/studio/shared/' + saved['share']
        self.assertEqual(self.client.get('/api/studio/feed').json()['looks'], [])
        self.assertEqual(self.client.get(url, headers=B).json()['photo'], BODY['photo'])
        self.save('link')
        self.assertEqual(self.client.get(url, headers=B).status_code, 404)
    def test_profile_excludes_private_link_and_unpublished_items(self):
        self.save('private')
        self.save('link', privacy='link')
        self.save('public', privacy='public')
        mine = self.client.get('/api/studio/profile', headers=A).json()
        url = '/api/studio/profiles/' + mine['creatorId']
        public = self.client.get(url, headers=B).json()
        self.assertEqual([x['id'] for x in public['looks']], ['public'])
        self.assertEqual(public['items'], [])
        item = BODY['items'][0] | {'privateNote': 'secret'}
        self.client.put('/api/studio/closet/shirt', headers=A, json={'item': item, 'public': True})
        public = self.client.get(url, headers=B).json()
        self.assertEqual(public['items'][0]['id'], 'shirt')
        self.assertNotIn('price', public['items'][0])
        self.assertNotIn('privateNote', public['items'][0])
        self.client.put('/api/studio/closet/shirt', headers=B, json={'public': False})
        self.assertEqual(len(self.client.get(url).json()['items']), 1)
        self.client.put('/api/studio/closet/shirt', headers=A, json={'public': False})
        self.assertEqual(self.client.get(url).json()['items'], [])

    def test_unique_reactions_and_comparison(self):
        saved = self.save('vote', privacy='link', comparison={'id':'two','title':'B','background':'sage','items':BODY['items']})
        self.assertEqual(saved['comparison']['id'], 'two')
        url = '/api/studio/shared/' + saved['share']
        for _ in range(2):
            self.client.get(url, headers=B)
            self.client.post(url + '/reaction', headers=B, json={'kind':'like','value':'1'})
        self.client.post(url + '/reaction', headers=B, json={'kind':'vote','value':'A'})
        self.client.post(url + '/reaction', headers=B, json={'kind':'vote','value':'B'})
        self.assertEqual(self.client.get(url, headers=B).json()['stats'], {'likes':1,'views':1,'A':0,'B':1})
        self.client.post(url + '/reaction', headers=B, json={'kind':'like','value':''})
        self.assertEqual(self.client.get(url, headers=B).json()['stats']['likes'], 0)
    def test_diary_inspiration_separate_from_wardrobe(self):
        state = {'diary':[{'date':'2026-10-02','note':'나만 보기'}],'collections':[{'type':'item','item':{'kind':'inspiration'}}]}
        self.client.put('/api/studio/state', headers=A, json=state)
        self.assertEqual(self.client.get('/api/studio/state', headers=A).json()['diary'], state['diary'])
        self.assertEqual(self.client.get('/api/studio/state', headers=B).json()['diary'], [])
        self.assertEqual(self.client.get('/api/studio/looks', headers=A).json()['looks'], [])

    def test_collage_layers_survive_share_and_comparison(self):
        layers = [
            {'id': 'text', 'type': 'text', 'text': 'MY STYLE', 'color': '#ff713e', 'font': 'mono', 'rotation': -12, 'z': 30},
            {'id': 'sticker', 'type': 'image', 'img': '/studio-assets/cutout-0-0.svg', 'opacity': .5, 'motion': 'float'},
            {'id': 'gif', 'type': 'giphy', 'giphyId': 'l0HlHFRbmaZtBRhXG'},
            {'id': 'draw', 'type': 'stroke', 'points': [[0, 0], [100, 100]], 'width': 3, 'color': '#292824', 'ratio': 2},
        ]
        saved = self.save('collage', background='lime', decorations=layers, privacy='link', comparison={'id': 'other', 'decorations': layers})
        public = self.client.get('/api/studio/shared/' + saved['share'], headers=B).json()
        self.assertEqual([x['type'] for x in public['decorations']], ['text', 'image', 'giphy', 'stroke'])
        self.assertEqual(public['decorations'][1]['img'], layers[1]['img'])
        self.assertEqual(public['decorations'][3]['points'], layers[3]['points'])
        self.assertEqual(public['comparison']['decorations'][2]['giphyId'], layers[2]['giphyId'])
        self.assertEqual(public['background'], 'lime')

    def test_collage_rejects_executable_sources_and_invalid_paths(self):
        for layer in [{'type': 'image', 'img': 'javascript:alert(1)'}, {'type': 'image', 'img': 'data:image/svg+xml,<svg onload="alert(1)"/>'}, {'type': 'giphy', 'giphyId': '../bad'}, {'type': 'stroke', 'points': [['oops', 1]]}]:
            response = self.client.put('/api/studio/looks/unsafe', headers=A, json=BODY | {'decorations': [layer]})
            self.assertEqual(response.status_code, 400)

    def test_friend_poll_snapshots_private_styles_and_unique_votes(self):
        self.save('one', note='private note')
        self.save('two', includePhoto=True)
        response = self.client.post('/api/studio/polls', headers=A, json={'lookIds': ['one', 'two'], 'question': '오늘 뭐 입지?'})
        self.assertEqual(response.status_code, 200)
        poll = response.json()
        self.assertEqual(poll['looks'][0]['photo'], '')
        self.assertEqual(poll['looks'][1]['photo'], BODY['photo'])
        self.assertNotIn('note', poll['looks'][0])
        self.assertNotIn('price', poll['looks'][0]['items'][0])
        self.assertEqual(self.client.get('/api/studio/feed').json()['looks'], [])
        self.assertTrue(all(x['share'] is None for x in self.client.get('/api/studio/looks', headers=A).json()['looks']))
        url = '/api/studio/polls/' + poll['token']
        for choice in [0, 0, 1]:
            result = self.client.post(url + '/vote', headers=B, json={'choice': choice}).json()
        self.assertEqual(result['counts'], [0, 1])
        self.assertEqual(result['total'], 1)
        self.assertEqual(result['myVote'], 1)
        self.assertEqual(self.client.post(url + '/vote', headers=B, json={'choice': 2}).status_code, 400)
        self.save('one', title='changed')
        self.client.delete('/api/studio/looks/two', headers=A)
        self.assertEqual(self.client.get(url, headers=B).json()['looks'][0]['title'], BODY['title'])
        self.assertEqual(self.client.get('/api/studio/polls', headers=B).json()['polls'], [])
        self.assertEqual(self.client.delete(url, headers=B).status_code, 403)
        self.assertEqual(self.client.delete(url, headers=A).status_code, 200)
        self.assertEqual(self.client.get(url, headers=B).status_code, 404)

    def test_friend_poll_expires_after_seven_days_and_disappears_from_history(self):
        self.save('one')
        self.save('two')
        poll = self.client.post('/api/studio/polls', headers=A, json={'lookIds': ['one', 'two']}).json()
        self.assertEqual(datetime.fromisoformat(poll['expiresAt']) - datetime.fromisoformat(poll['createdAt']), timedelta(days=7))
        with style_studio.db() as conn:
            conn.execute('UPDATE polls SET created_at=? WHERE token=?', ((datetime.now(timezone.utc) - timedelta(days=7, seconds=1)).isoformat(), poll['token']))
        self.assertEqual(self.client.get('/api/studio/polls', headers=A).json()['polls'], [])
        url = '/api/studio/polls/' + poll['token']
        self.assertEqual(self.client.get(url, headers=B).status_code, 404)
        self.assertEqual(self.client.post(url + '/vote', headers=B, json={'choice': 0}).status_code, 404)

    def test_friend_poll_rejects_foreign_duplicate_and_missing_styles(self):
        self.save('one')
        self.save('two')
        for ids, headers, status in [(['one', 'two'], B, 404), (['one', 'one'], A, 400), (['one', 'missing'], A, 404), (['one'], A, 422)]:
            self.assertEqual(self.client.post('/api/studio/polls', headers=headers, json={'lookIds': ids}).status_code, status)

    def test_notifications_paginate_all_events_and_count_unread_globally(self):
        import hashlib
        owner_a = hashlib.sha256(A['X-Studio-Owner'].encode()).hexdigest()
        owner_b = hashlib.sha256(B['X-Studio-Owner'].encode()).hexdigest()
        with style_studio.db() as conn:
            conn.executemany('INSERT INTO notifications(id,owner,actor,kind,look_id,created_at) VALUES(?,?,?,?,?,?)',
                             [(f'event-{i}', owner_a, owner_b, 'follow', None, '2026-10-03T00:00:00Z') for i in range(105)])
        events = []
        for offset in range(0, 105, 30):
            page = self.client.get(f'/api/studio/notifications?offset={offset}&limit=30', headers=A).json()
            self.assertEqual(page['unread'], 105)
            self.assertEqual(page['hasMore'], offset + 30 < 105)
            events.extend(x['id'] for x in page['notifications'])
        self.assertEqual(len(events), 105)
        self.assertEqual(len(set(events)), 105)
        self.assertEqual(events[0], 'event-104')
        self.assertEqual(self.client.get('/api/studio/notifications', headers=B).json()['notifications'], [])
        self.client.post('/api/studio/notifications/read', headers=A, json={'ids': events[:30]})
        self.assertEqual(self.client.get('/api/studio/notifications?limit=1', headers=A).json()['unread'], 75)

    def test_social_relationships_notifications_and_read_ownership(self):
        alice = self.client.put('/api/studio/profile', headers=A, json={'author': 'alice', 'avatar': '/prototype-assets/styleY2k.webp'}).json()
        self.client.put('/api/studio/profile', headers=B, json={'author': 'bob'})
        original = self.save('original', privacy='public')
        self.client.put('/api/studio/state', headers=B, json={'follows': [alice['creatorId'], 'sample:off.duty']})
        self.client.post('/api/studio/shared/' + original['share'] + '/reaction', headers=B, json={'kind': 'like', 'value': '1'})
        self.client.post('/api/studio/shared/' + original['share'] + '/reaction', headers=B, json={'kind': 'like', 'value': '1'})
        restyle = BODY | {'origin': {'id': original['share'], 'title': 'original', 'author': 'alice'}}
        self.client.put('/api/studio/looks/restyle', headers=B, json=restyle)
        self.assertEqual(len(self.client.get('/api/studio/notifications', headers=A).json()['notifications']), 2)
        for _ in range(2):
            self.client.put('/api/studio/looks/restyle', headers=B, json=restyle | {'privacy': 'public'})
        result = self.client.get('/api/studio/notifications', headers=A).json()
        self.assertEqual(result['unread'], 3)
        self.assertEqual({x['kind'] for x in result['notifications']}, {'like', 'follow', 'restyle'})
        self.assertTrue(all(x['actor']['author'] == 'bob' for x in result['notifications']))
        event = next(x for x in result['notifications'] if x['kind'] == 'restyle')
        self.assertEqual(event['look']['id'], 'restyle')
        self.assertTrue(self.client.get('/api/studio/feed', headers=B).json()['looks'][-1]['myLike'])
        self.client.post('/api/studio/notifications/read', headers=B, json={'ids': [x['id'] for x in result['notifications']]})
        self.assertEqual(self.client.get('/api/studio/notifications', headers=A).json()['unread'], 3)
        self.client.post('/api/studio/notifications/read', headers=A, json={'ids': [x['id'] for x in result['notifications']]})
        self.assertEqual(self.client.get('/api/studio/notifications', headers=A).json()['unread'], 0)
        own = self.client.get('/api/studio/social', headers=A).json()
        self.assertEqual(own['followers'], 1)
        self.assertEqual(own['followerPeople'][0]['author'], 'bob')
        self.assertEqual(self.client.get('/api/studio/social', headers=B).json()['following'], 2)
        self.client.put('/api/studio/looks/restyle', headers=B, json=restyle | {'privacy': 'private'})
        event = next(x for x in self.client.get('/api/studio/notifications', headers=A).json()['notifications'] if x['kind'] == 'restyle')
        self.assertIsNone(event['look'])
        self.client.put('/api/studio/state', headers=B, json={'follows': []})
        self.assertEqual(self.client.get('/api/studio/social', headers=A).json()['followers'], 0)

    def test_sample_likes_persist_and_toggle_without_duplicate_counts(self):
        url = '/api/studio/samples/editorial-v4-0/reaction'
        for _ in range(2): self.assertEqual(self.client.post(url, headers=A, json={'value': '1'}).status_code, 200)
        sample = self.client.get('/api/studio/sample-reactions', headers=A).json()['looks'][0]
        self.assertTrue(sample['myLike'])
        self.assertEqual(sample['stats']['likes'], 1)
        self.assertFalse(self.client.get('/api/studio/sample-reactions', headers=B).json()['looks'][0]['myLike'])
        self.client.post(url, headers=A, json={'value': ''})
        self.assertEqual(self.client.get('/api/studio/sample-reactions', headers=A).json()['looks'][0]['stats']['likes'], 0)
        self.assertEqual(self.client.post('/api/studio/samples/editorial-v4-99/reaction', headers=A, json={'value': '1'}).status_code, 404)

    def test_profile_does_not_expose_private_posts_or_invalid_avatar(self):
        profile = self.client.put('/api/studio/profile', headers=A, json={'author': 'alice'}).json()
        self.save('private')
        self.save('link', privacy='link')
        public = self.client.get('/api/studio/profiles/' + profile['creatorId']).json()
        self.assertEqual(public['looks'], [])
        self.assertEqual(public['author'], 'alice')
        self.assertEqual(self.client.put('/api/studio/profile', headers=A, json={'avatar': 'javascript:alert(1)'}).status_code, 400)

if __name__ == '__main__':
    unittest.main()
