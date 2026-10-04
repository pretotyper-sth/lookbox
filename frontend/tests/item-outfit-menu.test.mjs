import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/proto/09-app.jsx',import.meta.url),'utf8');
const settingsChunk=source.slice(source.indexOf('function coordinateLookSettings'),source.indexOf('function wardrobeSigOf'));
const coordinateLookSettings=new Function(settingsChunk+';return coordinateLookSettings;')();
const chunk=source.slice(source.indexOf('  const [pickSheet, setPickSheet]'),source.indexOf('  // 쇼핑몰 구매내역',source.indexOf('  const [pickSheet, setPickSheet]')));
function harness(modelLook=true){
 let state=null,resolve,options,requests=0,looks=0;
 const outfits={};
 const deps={useState:()=>[null,value=>{state=typeof value==='function'?value(state):value;}],useRef:value=>({current:value}),authUid:'account-a',dailyCount:4,preferredDailyStyle:'minimal',preferredStyles:['minimal','casual'],wishCount:1,prefs:{modelLook,personalModelLook:true,avatar:'face.png'},coordinateLookSettings,removeSheet:{open:true},LB_DATA:{OUTFIT_BY_ID:outfits,WISH_STAGE:{},LOOK_STAGE:{}},liveJSON:async(url,opts)=>{requests++;options=opts;return new Promise(r=>{resolve=r;});},liveRememberItem:()=>{},stampOutfitStyle:()=>{},coordProfile:()=>({height:'178',weight:'72',personal_model_look:true}),reloadBilling:()=>{},showToast:()=>{},applyModelLooks:async list=>{looks++;list[0].lookImg='ai.png';}};
 const setup=new Function('deps',`const {${Object.keys(deps).join(',')}}=deps;${chunk};return {requestPickedOutfits,closePickSheet};`)(deps);
 return {...setup,state:()=>state,options:()=>options,finish:payload=>resolve(payload),requests:()=>requests,looks:()=>looks};
}
test('item recommendations use the same mood, body and image settings with a required item',async()=>{
 const h=harness();const running=h.requestPickedOutfits(['shirt'],{inlineItemId:'shirt'});
 const body=JSON.parse(h.options().body);assert.deepEqual(body.include_item_ids,['shirt']);assert.deepEqual(body.styles,['minimal','casual']);assert.equal(body.model_look,true);assert.equal(body.personal_model_look,true);assert.equal(body.height,'178');
 h.options().onOutfit({outfit:{id:'look',itemIds:['shirt','pants']},items:[]});assert.equal(h.state().outfits.length,1);assert.equal(h.state().outfits[0].lookImg,undefined);assert.equal(h.state().loading,true);
 h.options().onLook({id:'look',lookImg:'ai.png'});assert.equal(h.state().outfits[0].lookImg,'ai.png');h.finish({outfits:[{id:'look',itemIds:['shirt','pants'],lookImg:'ai.png'}],items:[]});await running;assert.equal(h.state().outfits[0].lookImg,'ai.png');assert.equal(h.looks(),0);
});
test('closing the menu does not cancel generation or reopen it, and completed results are reused',async()=>{
 const h=harness();const running=h.requestPickedOutfits(['shirt'],{inlineItemId:'shirt'});h.closePickSheet();
 h.options().onOutfit({outfit:{id:'look',itemIds:['shirt','pants']}});assert.equal(h.state(),null);
 h.options().onLook({id:'look',lookImg:'ai.png'});h.finish({outfits:[{id:'look',itemIds:['shirt','pants'],lookImg:'ai.png'}]});await running;assert.equal(h.state(),null);
 await h.requestPickedOutfits(['shirt'],{inlineItemId:'shirt'});assert.equal(h.requests(),1);assert.equal(h.state().outfits[0].lookImg,'ai.png');
});
test('reopening a running item request avoids duplicate requests and disabling AI avoids generation',async()=>{
 const h=harness(false);const running=h.requestPickedOutfits(['shirt'],{inlineItemId:'shirt'});h.closePickSheet();await h.requestPickedOutfits(['shirt'],{inlineItemId:'shirt'});assert.equal(h.requests(),1);
 h.finish({outfits:[{id:'look',itemIds:['shirt','pants']}]});await running;assert.equal(h.looks(),0);assert.equal(h.state().loading,false);
});
test('recommendation remains inside the item menu and supports the existing save action',()=>{
 const shared=readFileSync(new URL('../src/proto/02-shared.jsx',import.meta.url),'utf8');const card=readFileSync(new URL('../src/proto/05-screens-cde.jsx',import.meta.url),'utf8');const today=readFileSync(new URL('../src/proto/06-today.jsx',import.meta.url),'utf8');
 assert.ok(shared.includes('recommendation || <>'));assert.ok(shared.includes('이 옷으로 코디 추천받기'));assert.ok(shared.includes('icon="imageEdit"'));assert.ok(card.includes('if (embedded) return body'));assert.ok(card.includes('onSave && onSave(o.id)'));assert.ok(source.includes('pickSheet && !pickSheet.inlineItemId'));assert.ok(today.includes('infoRight={59} infoSize={24} infoBottom={7}'));assert.ok(today.includes('useModelLook ? "product" : "sparkle"'));assert.ok(card.includes('AI 생성 상품 포함'));
});

test('skeletons only fill missing requested cards and additions retain the previous count', async()=>{
 const h=harness(false); const task=h.requestPickedOutfits(['shirt']);assert.equal(h.state().targetCount,4);
 const rows=Array.from({length:4},(_,i)=>({id:'look'+i,itemIds:['shirt','pants'+i]}));
 rows.forEach(outfit=>h.options().onOutfit({outfit}));assert.equal(Math.max(0,h.state().targetCount-h.state().outfits.length),0);
 h.finish({outfits:rows});await task;const extra=h.requestPickedOutfits(['shirt'],{append:true});assert.equal(h.state().targetCount,6);h.finish({outfits:[]});await extra;
 const modal=readFileSync(new URL('../src/proto/05-screens-cde.jsx',import.meta.url),'utf8');assert.ok(modal.includes('Math.max(0, targetCount - outfits.length)'));assert.ok(!modal.includes('first ? 4 : 2'));
});
test('incompatible selections identify the items to remove while valid selections remain allowed',()=>{
 const helper=source.slice(source.indexOf('function pickedOutfitGuide'),source.indexOf('window.pickedOutfitGuide'));
 const guide=new Function(helper+';return pickedOutfitGuide;')();
 const item=(category,name)=>({category,name});
 assert.equal(guide([item('상의','티'),item('하의','청바지'),item('신발','스니커')]),'');
 assert.match(guide([item('아우터','코트'),item('outer','재킷')]),/아우터 2개 중 1개.*코트 · 재킷/);
 assert.match(guide([item('원피스','드레스'),item('하의','바지')]),/상의·하의·스커트/);
 assert.match(guide([item('스커트','치마'),item('하의','바지')]),/하의와 스커트/);
 assert.match(guide(Array.from({length:8},(_,i)=>item('소품','벨트'+i))),/2개를 선택 해제/);
 const wardrobe=readFileSync(new URL('../src/proto/04-screens-ab.jsx',import.meta.url),'utf8');assert.ok(wardrobe.includes('>코디</Btn>'));assert.ok(!wardrobe.includes('moreOpen'));assert.ok(wardrobe.includes('선택 수정하기'));
});
