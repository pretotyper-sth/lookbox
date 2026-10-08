export const INKS = ['#292824','#ffffff','#d7fa3a','#ff713e','#ff8fbe','#7cbaff','#8866e7','#27886c'];
export const FONTS = { sans:'Pretendard, sans-serif', bold:'Arial Black, Pretendard, sans-serif', serif:'Georgia, serif', mono:'Courier New, monospace', hand:'cursive' };
export const EMOJI_PACKS = {
  '표정':['🙂','🙃','😎','🤩','🥹','😭','😤','🫠','🫶','🤍','🖤','💚','💘','💅','👀','🫡','🤭','😮‍💨','🤠','😈','👽','👻','💀','🤖'],
  '무드':['✨','⭐','🌟','💫','⚡','🔥','💥','🌈','☀️','🌙','☁️','❄️','🫧','💧','🪩','🎧','🎵','📷','📼','💿','🕯️','🪄','🔮','🧿'],
  '패션':['👕','👔','🧥','👖','👗','👚','🩳','🧦','👟','👠','🥾','🥿','👜','👛','🎒','👝','🕶️','👓','🧢','👒','💍','🎀','🪡','🧵'],
  '작은 것들':['🍒','🍓','🍋','🍊','🥑','🍉','🍑','🍌','🍇','🍄','🌷','🌻','🌼','🌸','🍀','🌿','🌵','🪴','🦋','🐈','🐶','🦢','🪿','🐚'],
  '주말':['☕','🍵','🥐','🥯','🍰','🧁','🍩','🍪','🍕','🍜','🧋','🍷','🍸','🛹','🎸','🎹','📚','🖊️','💌','✈️','🗽','🏖️','🏙️','🛋️'],
  '표시':['✦','✳','✹','✺','♡','♥','★','☆','↗','↙','→','←','↑','↓','↔','↝','〰','✓','✕','＋','⊙','◎','✿','❀'],
};
export const WORDS = ['10:24','SATURDAY','after hours','오후 3시','오늘','맑음','도쿄','서울','주말','@home','COFFEE FIRST','ON REPEAT','00:00','DAY OFF','archive 26','see you','↗ THIS','♡ this fit','2026.10.02','REC ●','camera roll','BLUE','PINK','walk with me','안녕','어쩌다 보니','오늘도 데님','잠깐 외출','착장 기록','어제의 나','LOOK 01','LOOK 02','✶','~ mood ~','slow morning','late night','nothing special','still here','with friends','off the record','MY STYLE','OFF DUTY','NOT BORING','OUTFIT CHECK','SAME CLOTHES','DIFFERENT MOOD','NO RULES','LOOK AT THIS','THAT FIT','STAY WEIRD','WORN AGAIN','MAIN CHARACTER','LOW KEY','HIGH KEY','REAL LIFE','IN MY ERA','KEEP IT REAL','GOOD ENOUGH','MOOD 001','ARCHIVE','오늘 좀 괜찮음','내 맘대로','꾸안꾸 아님 꾸꾸','옷장은 그대로','기분은 새롭게','이 조합 저장','입고 싶은 날','이게 내 취향','새 옷 아님','룩의 완성은 나','일단 입어','이 정도면 됐지','주말 모드','출근도 내 방식','또 입어도 좋아','친구야 골라줘'];
export const MEMES = [
 ['옷장 앞의 나','옷은 많은데','입을 옷이 없네','paper'],['월요일 vs 주말','월요일의 나','주말의 나','sage'],['내적 갈등','꾸안꾸 하려다가','꾸꾸꾸가 되어버림','sand'],['취향 발견','처음엔 별로였는데','계속 생각나는 룩','pink'],['재발견','새로 산 거 아님','또 입는 거 맞음','lime'],['친구에게 투표','A가 더 나아?','B가 더 나아?','paper'],['오늘의 주인공','오늘의 코디','주인공은 나','ink'],['내 옷장 아카이브','입었던 옷','다시 입는 기분','blue'],['현실 코디','저장한 코디 100개','오늘 입은 옷은 또 이거','sage'],['취향 선언','남들이 뭐래도','이게 내 취향','paper'],['주말 에너지','약속 취소됐지만','코디는 살려야지','sand'],['그냥 마음에 듦','이유는 없고','그냥 좋음','pink'],
];
export const id = () => crypto.randomUUID();
export const normalizeLayers = layers => (layers||[]).map((x,i)=>({id:x.id||id(),type:x.type||'text',x:50,y:30,rotation:0,opacity:1,z:20+i,...x}));
export function giphyId(value) {
  try { const u=new URL(value); if(!/^(?:www\.)?giphy\.com$/.test(u.hostname))return null; const path=u.pathname.split('/').filter(Boolean); if(!['gifs','stickers','embed'].includes(path[0]))return null; const part=path[1]||''; const last=part.split('-').pop(); return /^[A-Za-z0-9]{4,100}$/.test(last)?last:null; } catch{return null;}
}
export function imageLink(value) {
  try {const u=new URL(value.trim());if(u.protocol!=='https:')throw new Error();return u.href;}catch{throw new Error('https로 시작하는 이미지 주소 또는 GIPHY 링크를 넣어 주세요.');}
}
export async function importFile(file) {
  if(!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type))throw new Error('PNG, JPG, WebP, AVIF, GIF 이미지를 골라 주세요.');
  if(file.type==='image/gif'){if(file.size>3000000)throw new Error('GIF는 3MB 이하로 골라 주세요.');return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
  const bitmap=await createImageBitmap(file);const scale=Math.min(1,1000/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  return canvas.toDataURL('image/webp',.85);
}
export function strokeLayer(points, color, width, brush) {
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const x0=Math.max(0,Math.min(...xs)-2),y0=Math.max(0,Math.min(...ys)-2),w=Math.max(4,Math.max(...xs)-x0+2),h=Math.max(4,Math.max(...ys)-y0+2);
  return {id:id(),type:'stroke',points:points.map(p=>[(p[0]-x0)/w*100,(p[1]-y0)/h*100]),x:x0+w/2,y:y0+h/2,scale:w,ratio:w/(h*1.25),width,color,brush,rotation:0,opacity:brush==='highlighter'?.4:1,z:60};
}
export function memeLayers(template) {
 const [label,top,bottom]=template;
 return [{id:id(),type:'text',text:top,x:50,y:17,size:25,color:'#ffffff',font:'bold',textStyle:'outline',rotation:-2,z:70},{id:id(),type:'text',text:bottom,x:50,y:84,size:25,color:'#ffffff',font:'bold',textStyle:'outline',rotation:2,z:71},{id:id(),type:'image',img:'/studio-assets/cutout-12-0.svg',label,scale:30,x:50,y:51,rotation:0,z:30}];
}
