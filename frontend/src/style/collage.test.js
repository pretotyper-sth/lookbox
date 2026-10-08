import test from 'node:test';
import assert from 'node:assert/strict';
import { giphyId, imageLink, strokeLayer, normalizeLayers, memeLayers } from './collage.js';
import { CUTOUTS } from './sticker-catalog.js';
test('GIPHY imports accept provider links and reject disguised domains and executable URLs',()=>{
 assert.equal(giphyId('https://giphy.com/gifs/happy-cat-AbC123'),'AbC123');
 assert.equal(giphyId('https://giphy.com/embed/AbC123'),'AbC123');
 assert.equal(giphyId('https://giphy.com.evil.test/gifs/AbC123'),null);
 assert.throws(()=>imageLink('javascript:alert(1)'));
});
test('pen bounds preserve the original canvas positions through layer normalization',()=>{
 const original=[[20,30],[40,50],[70,40]];const layer=strokeLayer(original,'#292824',1,'pen');
 const h=layer.scale/(layer.ratio*1.25);
 const restored=layer.points.map(p=>[layer.x-layer.scale/2+p[0]*layer.scale/100,layer.y-h/2+p[1]*h/100]);
 restored.forEach((p,i)=>p.forEach((x,j)=>assert.ok(Math.abs(x-original[i][j])<.0001)));
 assert.equal(normalizeLayers([{text:'legacy',x:20,y:20}])[0].type,'text');
});
test('built-in assets have unique references and meme captions stay independently editable',()=>{
 assert.equal(CUTOUTS.length,84);assert.equal(new Set(CUTOUTS.map(x=>x.img)).size,84);
 const layers=memeLayers(['내 밈','위 문구','아래 문구','lime']);
 assert.equal(layers[0].text,'위 문구');assert.equal(layers[1].text,'아래 문구');assert.notEqual(layers[0].id,layers[1].id);
});
