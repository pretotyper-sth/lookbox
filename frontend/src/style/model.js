import FEED_SOURCES from '../../public/studio-assets/feed-samples/sources.json';
import { FONTS } from './collage.js';
import { outfitPrice, editorialSlots } from '../look-layout.js';
export const BACKGROUNDS = { ivory: '#EFEDE8', paper: '#FBFAF7', sage: '#E1E7DF', sand: '#E4D8C7', ink: '#343531', lime: '#D7FA3A', pink: '#F3BBD0', blue: '#C4D5EB', lavender: '#D4CBED' };
export const MOODS = ['데일리', '미니멀', '캐주얼', '클래식', '스트리트'];
export const OCCASIONS = ['일상', '출근', '주말', '데이트', '여행'];
export const STICKERS = ['✦', '♡', '〰', '✳', '오늘의 취향', 'MY STYLE'];
export const uid = () => crypto.randomUUID();
const item = (id, name, category, file) => ({ id: `sample-${id}`, name, category, img: `/prototype-assets/${file}.webp`, kind: 'sample' });
export const SAMPLE_ITEMS = [
  item('shirt', '블루 셔츠', '상의', 'lookAnchorShirt'), item('blue', '블루 데님', '하의', 'lookDenimBlue'),
  item('samba', '스니커즈', '신발', 'lookSamba'), item('bag', '브라운 숄더백', '가방', 'lookBagBrown'),
  item('wide', '와이드 데님', '하의', 'lookDenimWide'), item('nb', '그레이 스니커즈', '신발', 'lookNb993'),
  item('glasses', '선글라스', '소품', 'lookSunglasses'), item('cardigan', '가디건', '아우터', 'lookCardigan'),
  item('black', '블랙 데님', '하의', 'lookDenimBlack'), item('boots', '앵클 부츠', '신발', 'lookBoots'),
];
SAMPLE_ITEMS.push(...Object.values(FEED_SOURCES).flatMap(x=>x.items).filter((it,i,all)=>all.findIndex(x=>x.id===it.id)===i));
export function arrange(items) {
  const spots = [[32, 36, 45], [68, 40, 43], [32, 76, 32], [72, 76, 27], [52, 62, 22], [78, 22, 19]];
  return items.map((it, i) => { const [x, y, scale] = spots[i % spots.length]; return { ...it, x: it.x ?? x, y: it.y ?? y, scale: it.scale ?? scale, rotation: it.rotation ?? 0, z: it.z ?? i }; });
}
export function newLook(items = SAMPLE_ITEMS.slice(0, 4)) {
  return { id: uid(), title: '나의 피드', note: '', author: '나', mood: '캐주얼', occasion: '일상', background: 'ivory', items: arrange(items), decorations: [], privacy: 'public', photo: '', includePhoto: false, allowRemix: true, origin: null, comparison: null, createdAt: new Date().toISOString() };
}
const editorial = [
 {title:'금요일은 좀 늦게 들어감',author:'off.duty',set:'stripe',bg:'paper'},
 {title:'검정. 오늘은 이것만.',author:'noir.zip',set:'black',bg:'ink'},
 {title:'가을 옷장 정리. 가격까지 적어 두니까 다음 쇼핑할 때 편하다.',author:'pocket.mp3',set:'weekend',bg:'sage'},
 {title:'셔츠는 크게, 주말은 느리게.',author:'soft.flash',set:'stripe-woman',bg:'pink'},
 {title:'이 바지 또 입음. 마음에 드는 조합은 굳이 바꿀 필요 없으니까.',author:'denim.00',set:'stripe',bg:'blue'},
 {title:'늦었는데 신발은 골라야 됨',author:'late.archive',set:'weekend',bg:'lime'},
 {title:'요즘 손이 가는 세 가지. 옷장에 있는 것만으로.',author:'home.21',set:'black',bg:'paper'},
 {title:'같은 셔츠 다른 느낌. 둘 다 내 옷장에서 시작함.',author:'three.fits',set:'stripe',bg:'sand'},
];
const sampleProductNotes = {
 1: [
  {color:'블랙',size:'M',material:'니트',store:'COS 매장',note:'조금 여유 있게 입으려고 한 사이즈 크게 골랐어요.'},
  {name:'하의',brand:'',price:''},
  {color:'블랙',size:'260',note:'가격은 기억이 안 나서 적지 않았어요.'},
 ],
 2: [
  {color:'베이지',size:'2',material:'코튼',store:'브랜드 온라인 스토어',note:'구매 당시 기록한 가격이에요. 안에 니트도 입을 수 있는 여유 있는 핏.'},
  {color:'카키',size:'2',store:'브랜드 온라인 스토어',note:'밑단을 한 번 접어서 입었어요.'},
  {brand:'',price:'128,000',note:'세일할 때 산 가격만 기록해 뒀어요.'},
 ],
 4: [
  {color:'라이트 블루',size:'2',note:'브랜드와 사이즈만 적어 둔 셔츠. 가격은 미기입.'},
  {color:'인디고',size:'30',material:'데님',note:'195,000원에 구매. 거의 매일 입는 바지.'},
  {name:'신발',brand:'',price:''},
 ],
 5: [
  {color:'베이지',size:'2',price:'',note:'가격 없이 색상과 사이즈만 남겼어요.'},
  {},
  {name:'로퍼',brand:'',price:'',size:'260'},
 ],
 6: [
  {color:'블랙',size:'M',store:'COS 매장'},
  {name:'하의',brand:'',price:''},
  {brand:'킨치',size:'260',price:''},
 ],
 7: [
  {name:'상의',brand:'',price:''},
  {name:'하의',brand:'',price:''},
  {name:'신발',brand:'',price:''},
 ],
};
export const SAMPLE_LOOKS = editorial.map((e,n)=>{
 const source=FEED_SOURCES[e.set],photo=source.photo,ink=e.bg==='ink'?'#ffffff':'#292824';
 const image=(key,img,x,y,scale,rotation=0)=>({id:`photo-${n}-${key}`,type:'image',img,label:'AI 착장',x,y,scale,ratio:.8,rotation,z:2});
 const text=(value,x,y,size,font='bold',rotation=0)=>({id:`text-${n}-${value}`,type:'text',text:value,x,y,size,font,color:ink,textStyle:'plain',rotation,z:20});
 const itemAt=(i,x,y,scale,showInfo=false,rotation=0)=>({...source.items[i],...sampleProductNotes[n]?.[i],id:`sample-post-${n}-${source.items[i].id}`,x,y,scale,showInfo,rotation,z:6+i});
 const layouts=[
  {items:[],decorations:[image('main',photo,50,49,88,-2),text('FRIDAY',50,9,40),text('out of office ♡',72,89,17,'hand',-7)]},
  {items:[itemAt(0,82,25,25,true),itemAt(1,82,52,24,true),itemAt(2,82,80,24,true)],decorations:[image('main',photo,34,50,60),text('NO SIGNAL',50,8,29,'mono'),text('OFFLINE UNTIL MONDAY',50,91,12,'mono')]},
  {items:[itemAt(0,29,42,51,true,-4),itemAt(1,73,45,42,true,3),itemAt(2,66,80,35,true)],decorations:[text('CLOSET RECEIPT',50,9,27,'mono'),text('있는 옷으로 가을 준비',50,16,15,'hand'),text('구매가 기록 / 02',22,88,12,'mono')]},
  {items:[],decorations:[image('main',photo,50,50,87,3),text('soft flash',50,10,33,'serif',-5),text('take it slow',25,87,18,'hand',-6)]},
  {items:[itemAt(0,82,35,26,true),itemAt(1,82,62,26,true),itemAt(2,82,85,23)],decorations:[text('ON REPEAT',50,9,33),text('01 / SAME JEANS',50,17,12,'mono'),image('main',photo,34,53,60,-3)]},
  {items:[itemAt(0,17,72,25,false,-10),itemAt(2,80,79,27,false,8)],decorations:[image('main',photo,51,49,74,7),text('21:09',25,12,48,'mono',-5),text('RUNNING LATE',56,89,21,'bold',-5)]},
  {items:[itemAt(0,30,36,51,true,-5),itemAt(1,74,42,43,true,5),itemAt(2,48,78,43,true,-4)],decorations:[text('THE REGULARS',50,9,30),text('new clothes? maybe next month.',50,89,13,'hand')]},
  {items:[itemAt(0,20,84,24),itemAt(1,50,84,24),itemAt(2,80,84,24)],decorations:[image('a',photo,27,45,43,-3),image('b',FEED_SOURCES['stripe-woman'].photo,73,45,43,3),text('SAME CLOSET',50,9,30,'mono'),text('different mood.',50,15,17,'hand')]},
 ];
 return {...newLook(),id:`editorial-v4-${n}`,title:e.title,author:e.author,avatar:photo,sample:true,createdAt:new Date(Date.parse('2026-10-01T12:00:00+09:00')-n*86400000).toISOString(),background:e.bg,note:'',...layouts[n]};
});
export function outfitLook(outfit, items) {
 const look=newLook(items),photo=outfit.lookImg;
 const slots=editorialSlots(items)||{};
 look.items=look.items.map(it=>{const s=slots[it.id];return s?{...it,x:(s.x0+s.x1)/2,y:(s.y0+s.y1)/2,scale:Math.min(s.x1-s.x0,(s.y1-s.y0)*1.25),z:s.z,showInfo:true}:it;});
 if(photo){const columns=items.length>3?2:1,rows=Math.ceil(items.length/columns),gap=70/Math.max(1,rows);look.items=look.items.map((it,i)=>({...it,x:columns===1?82:70+(i%2)*20,y:17+gap/2+Math.floor(i/columns)*gap,scale:Math.min(columns===1?23:18,gap*.9),z:6+i}));look.decorations=[{id:uid(),type:'image',img:photo,label:'AI 착장',x:columns===1?34:30,y:48,scale:columns===1?61:54,ratio:.8,z:1}];}
 return {...look,title:outfit.label||'오늘 입을 코디'};
}
export function remix(look, owned = []) {
  const used = new Set();
  let matched = 0;
  const items = look.items.map(it => {
    const replacement = owned.find(x => x.category === it.category && !used.has(x.id));
    if (replacement) { used.add(replacement.id); matched++; return { ...it, ...replacement, kind: 'owned', x: it.x, y: it.y, scale: it.scale, rotation: it.rotation, z: it.z }; }
    return { ...it, kind: it.kind === 'sample' ? 'sample' : 'inspiration' };
  });
  return { ...newLook(items), title: '나의 피드', note: '', background: look.background, mood: look.mood, occasion: look.occasion, decorations: look.decorations || [], origin: { id: look.share || look.id, title: look.title, author: look.author, sample: !!look.sample }, matched };
}
export const canRemix = look => look.sample || look.allowRemix;
export const safeDraft = look => ({ ...look, privacy: 'private', share: null, includePhoto: false });
export function publicSummary(look) {
  return { title: look.title, note: look.note, author: look.author, mood: look.mood, occasion: look.occasion, background: look.background, items: look.items, decorations: look.decorations, origin: look.origin, comparison: look.comparison, allowRemix: look.allowRemix, photo: look.includePhoto ? look.photo : '' };
}
export function readDraft() { try { return JSON.parse(localStorage.getItem('rc_style_draft') || 'null'); } catch { return null; } }
export function writeDraft(look) { localStorage.setItem('rc_style_draft', JSON.stringify(look)); }
export function clearDraft() { localStorage.removeItem('rc_style_draft'); }
export async function api(path, init = {}) {
  let key = localStorage.getItem('rc_studio_owner');
  if (!key) { key = uid() + uid(); localStorage.setItem('rc_studio_owner', key); }
  let res;
  try { res = await fetch(`/api/studio${path}`, { ...init, headers: { 'Content-Type': 'application/json', 'X-Studio-Owner': key, ...(init.headers || {}) } }); }
  catch { throw new Error('로컬 저장 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.error || '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
  return data;
}
export async function photoData(file) {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일을 골라 주세요.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width * scale; canvas.height = bitmap.height * scale;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const data = canvas.toDataURL('image/jpeg', 0.8);
  if (data.length > 1600000) throw new Error('더 작은 사진을 골라 주세요.');
  return data;
}
export async function styleImageBlob(look) {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 1250;
  const c = canvas.getContext('2d'); c.fillStyle = BACKGROUNDS[look.background]; c.fillRect(0, 0, 1000, 1250);
  async function draw(src, x, y, width, rotation = 0) {
    if (!src) return;
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = src;
    await img.decode();
    const ratio = Math.min(width / img.naturalWidth, width / img.naturalHeight);
    const height = img.naturalHeight * ratio; width = img.naturalWidth * ratio;
    c.save(); c.translate(x, y); c.rotate(rotation * Math.PI / 180); c.drawImage(img, -width / 2, -height / 2, width, height); c.restore();
  }
  if (look.includePhoto && look.photo) { const img=new Image();img.crossOrigin='anonymous';img.src=look.photo;await img.decode();const ratio=Math.max(1000/img.naturalWidth,1250/img.naturalHeight);c.globalAlpha=.28;c.drawImage(img,(1000-img.naturalWidth*ratio)/2,(1250-img.naturalHeight*ratio)/2,img.naturalWidth*ratio,img.naturalHeight*ratio);c.globalAlpha=1; }
  const entries=[...look.items.map(x=>({...x,entry:'item'})),...(look.decorations||[]).map(x=>({...x,entry:'layer'}))].sort((a,b)=>(a.z??(a.entry==='item'?0:40))-(b.z??(b.entry==='item'?0:40)));
  for(const it of entries){
    c.save();c.globalAlpha=it.opacity??1;
    if(it.entry==='item'){
      c.globalCompositeOperation=look.background==='ink'?'source-over':'multiply';await draw(it.img,it.x*10,it.y*12.5,it.scale*10,it.rotation);c.globalCompositeOperation='source-over';
      if(it.showInfo){const img=new Image();img.crossOrigin='anonymous';img.src=it.img;await img.decode();const h=img.naturalHeight*Math.min(it.scale*10/img.naturalWidth,it.scale*10/img.naturalHeight);c.translate(it.x*10,it.y*12.5);c.rotate((it.rotation||0)*Math.PI/180);const lines=[it.brand,it.name,it.price?outfitPrice(it.price):''].filter(Boolean);c.font='500 18px Pretendard, sans-serif';const w=Math.min(350,Math.max(...lines.map(t=>c.measureText(t).width))+24);c.fillStyle='#FBFAF7';c.fillRect(-w/2,h/2-8,w,lines.length*21+9);c.fillStyle='#1A1A1A';c.textAlign='center';lines.forEach((t,i)=>c.fillText(t,0,h/2+10+i*21,w-16));}
      c.restore();continue;
    }
    c.translate(it.x*10,it.y*12.5);c.rotate((it.rotation||0)*Math.PI/180);
    const w=(it.scale||28)*10,h=w/(it.ratio||(it.type==='giphy'?1.3:1));
    if(it.type==='image'||it.type==='giphy'){
      const img=new Image();img.crossOrigin='anonymous';img.src=it.type==='giphy'?`https://media.giphy.com/media/${encodeURIComponent(it.giphyId)}/giphy_s.gif`:it.img;
      try{await img.decode();const fit=Math.min(w/img.naturalWidth,h/img.naturalHeight);c.drawImage(img,-img.naturalWidth*fit/2,-img.naturalHeight*fit/2,img.naturalWidth*fit,img.naturalHeight*fit);}catch{c.restore();throw new Error(it.type==='giphy'?'GIF 이미지를 불러오지 못했어요. 다시 시도해 주세요.':'원본 서버에서 이미지 내보내기를 허용하지 않아요. 해당 이미지를 파일로 업로드해 주세요.');}
    }else if(it.type==='stroke'){
      c.strokeStyle=it.color||'#292824';c.lineWidth=(it.width||1)*10;c.lineCap='round';c.lineJoin='round';if(it.brush==='dotted')c.setLineDash([c.lineWidth, c.lineWidth*3]);c.beginPath();(it.points||[]).forEach((point,i)=>{const x=(point[0]/100-.5)*w,y=(point[1]/100-.5)*h;if(i===0)c.moveTo(x,y);else c.lineTo(x,y);});c.stroke();
    }else{
      const size=(it.size||26)*2.5;c.font=`${it.italic?'italic ':''}${it.bold===false?'400':it.bold||it.font==='bold'?'800':'600'} ${size}px ${FONTS[it.font]||FONTS.sans}`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=it.color||(look.background==='ink'?'#F7F5F0':'#1A1A1A');
      const lines=[];for(const line of String(it.text||'').split('\n')){let row='';for(const char of line){if(c.measureText(row+char).width>920&&row){lines.push(row);row=char;}else row+=char;}lines.push(row);}
      lines.forEach((line,i)=>{const y=(i-(lines.length-1)/2)*size*1.1;if(it.textStyle==='label'){const tw=c.measureText(line).width;c.save();c.fillStyle=it.bg||'#d7fa3a';c.fillRect(-tw/2-size*.35,y-size*.6,tw+size*.7,size*1.2);c.restore();}if(it.textStyle==='outline'){c.strokeStyle='#292824';c.lineWidth=size*.08;c.strokeText(line,0,y);}if(it.textStyle==='shadow'){c.shadowColor='#ff713e';c.shadowOffsetX=size*.06;c.shadowOffsetY=size*.08;}c.fillText(line,0,y);});
    }
    c.restore();
  }
  c.fillStyle=look.background==='ink'?'#F7F5F0':'#1A1A1A';c.textBaseline='alphabetic';

  if((look.decorations||[]).some(x=>x.type==='giphy')){c.textAlign='left';c.font='12px sans-serif';c.fillText('Powered by GIPHY',45,1214);}
  c.textAlign = 'right'; c.font = '18px Pretendard, sans-serif'; c.fillText('RealCloset', 955, 1200);
  if((look.decorations||[]).some(x=>x.img?.startsWith('/studio-assets/openmoji-'))){c.textAlign='left';c.font='12px sans-serif';c.fillText('OpenMoji · CC BY-SA 4.0 · openmoji.org',45,1232);}
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('이미지를 만들지 못했어요. 다시 시도해 주세요.')),'image/png'));
}
export async function exportImage(look) {
  const blob=await styleImageBlob(look),url=URL.createObjectURL(blob),a=document.createElement('a');a.download=`${look.title}.png`;a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
