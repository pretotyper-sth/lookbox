import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api as studioApi, outfitLook } from './model.js';
import { createPortal } from 'react-dom';
import './closet-studio.css';

const selectionKey=it=>`${it.resource?'resource':'wardrobe'}:${it.id}`;
const materialImage=async it=>{
  if(it.img?.startsWith('data:image/'))return it;
  const response=await fetch(it.img||it.thumb);
  if(!response.ok)throw new Error('재료 이미지를 불러오지 못했어요. 다시 시도해 주세요.');
  const blob=await response.blob();
  if(blob.size>8*1024*1024)throw new Error('재료 사진은 8MB 이하로 골라 주세요.');
  const img=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('재료 이미지를 읽지 못했어요.'));reader.readAsDataURL(blob);});
  return {...it,img};
};

const { IconBtn, Icon, Btn } = window;

const request = async (path, options = {}) => {
  const res = await fetch(`/api/live/closet-jobs${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '작업을 접수하지 못했어요. 다시 시도해 주세요.');
  return data;
};
const json = body => ({ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
const active = job => ['queued','running'].includes(job.status);

window.LB_SUBMIT_ORDER_JOB = async (rows, files, requestId) => {
  const form = new FormData();
  form.append('metadata', JSON.stringify(rows));
  form.append('request_id', requestId);
  files.forEach(file => form.append('images_in', file));
  const job = await request('/import', {method:'POST',body:form});
  window.dispatchEvent(new Event('lb-closet-jobs'));
  return job;
};

function useJobs() {
  const [jobs,setJobs] = useState([]), [error,setError] = useState('');
  useEffect(() => {
    let dead=false, timer, delay=30000, generation=0;
    const load=async(ticket)=>{
      if(document.hidden)return;
      try { const data=await request(''); if(!dead&&ticket===generation){setJobs(data.jobs);setError('');delay=data.jobs.some(active)?5000:30000;} }
      catch(e){if(!dead&&ticket===generation)setError(e.message);}
    };
    const poll=async()=>{const ticket=++generation;await load(ticket);if(!dead&&ticket===generation)timer=setTimeout(poll,delay);};
    const wake=()=>{clearTimeout(timer);poll();};
    poll();
    window.addEventListener('lb-closet-jobs',wake);
    document.addEventListener('visibilitychange',wake);
    return()=>{dead=true;clearTimeout(timer);window.removeEventListener('lb-closet-jobs',wake);document.removeEventListener('visibilitychange',wake);};
  },[]);
  return {jobs,error};
}

export function ClosetJobStatus({ctx}) {
  const {jobs,error}=useJobs();
  const [expanded,setExpanded]=useState(false), [dismissed,setDismissed]=useState('');
  const seen=useRef(''),seenSaved=useRef('');
  const imports=jobs.filter(x=>x.kind==='import');
  const sig=imports.map(x=>`${x.id}:${x.processed||0}`).join('|');
  useEffect(()=>{if(sig&&seen.current!==sig){seen.current=sig;ctx.reloadImportedWardrobe().catch(()=>{});}},[sig,ctx]);
  const savedSignature=jobs.filter(x=>x.kind==='dress'&&x.saved_id).map(x=>x.saved_id).join('|');
  useEffect(()=>{if(savedSignature&&seenSaved.current!==savedSignature){seenSaved.current=savedSignature;ctx.refreshStudioLookbook().catch(()=>{});}},[savedSignature,ctx]);
  const job=imports.find(active)||imports[0];
  if(!job||dismissed===job.id)return null;
  const saved=(job.completed||[]).filter(x=>x.status==='saved').length;
  const failed=(job.completed||[]).filter(x=>x.status==='failed');
  return <div className="cs-job" role="status"><div><span className={active(job)?'cs-job-dot':''}/><strong>{active(job)?`옷장에 자동으로 담는 중 · ${job.processed||0}/${job.total}`:job.status==='failed'?'자동 담기를 완료하지 못했어요':`${saved}개를 옷장에 담았어요${failed.length?` · ${failed.length}개 실패`:''}`}</strong><button onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>진행 보기</button>{!active(job)&&<button aria-label="자동 담기 알림 닫기" onClick={()=>setDismissed(job.id)}>×</button>}</div>{expanded&&<div className="cs-job-detail"><p>{active(job)?'이제 앱을 닫아도 계속 담아요.':'추출된 옷은 옷장에서 수정하거나 삭제할 수 있어요.'}</p>{job.current&&active(job)&&<p>{job.current}</p>}{job.error&&<p>{job.error}</p>}{error&&<p>{error}</p>}{(job.completed||[]).map(x=><p key={x.index}>{x.name} · {x.status==='saved'?'담았어요':x.status==='duplicate'?'이미 옷장에 있어요':x.error}</p>)}</div>}</div>;
};

const POSES=['자연스럽게 서 있기','한 걸음 걷기','편안하게 기대기'];
const group=it=>({top:'상의',bottom:'하의',shoes:'신발',outer:'아우터',bag:'가방',accessory:'소품'}[it.category]||it.category);

export function ClosetStudio({ctx,onClose}) {
  const characterKey=`lb_closet_character_${ctx.authUid||'guest'}`;
  const initialCharacter=useRef(null);
  if(initialCharacter.current===null){try{initialCharacter.current=JSON.parse(localStorage.getItem(characterKey))||{};}catch{initialCharacter.current={};}}
  const [selected,setSelected]=useState([]),[source,setSource]=useState('옷장'),[resources,setResources]=useState([]),[search,setSearch]=useState(''),[profileOpen,setProfileOpen]=useState(false),[personal,setPersonal]=useState(!!initialCharacter.current.personal),[useFace,setUseFace]=useState(initialCharacter.current.useFace!==false),[useBody,setUseBody]=useState(initialCharacter.current.useBody!==false),[useColor,setUseColor]=useState(initialCharacter.current.useColor!==false),[pose,setPose]=useState(POSES[0]),[pending,setPending]=useState(null),[current,setCurrent]=useState(null),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false),[saving,setSaving]=useState(false),[drag,setDrag]=useState(null);
  const {jobs}=useJobs();
  useEffect(()=>{localStorage.setItem(characterKey,JSON.stringify({personal,useFace,useBody,useColor}));},[characterKey,personal,useFace,useBody,useColor]);
  const gender=/^(여|f|woman)/i.test(ctx.prefs.gender||'')?'f':'m';
  const pointer=useRef(null),stage=useRef(null),suppressClick=useRef(false);
  useEffect(()=>{const previous=document.activeElement;const close=e=>{if(e.key==='Escape'){if(profileOpen)setProfileOpen(false);else onClose();}};window.addEventListener('keydown',close);document.querySelector(profileOpen?'.cs-profile-sheet button':'[data-cs-close]')?.focus();return()=>{window.removeEventListener('keydown',close);previous?.focus();};},[onClose,profileOpen]);
  useEffect(()=>{studioApi('/state').then(x=>setResources((x.collections||[]).filter(x=>x.type==='item').map(x=>({...x.item,resource:true})))).catch(e=>setError(e.message));},[]);
  useEffect(()=>{
    if(!pending)return;
    const job=jobs.find(x=>x.id===pending);
    if(!job||active(job))return;
    setPending(null);
    if(job.status==='done'){setCurrent(job);if(!selected.length&&!job.character){const restored=job.items.map(x=>({...x,resource:String(x.id).startsWith('resource-')}));setSelected(restored);}}else setError(job.error||'착장을 만들지 못했어요.');
  },[jobs,pending,selected.length,pose]);
  const add=it=>{
    setSelected(list=>{
      if(list.some(x=>selectionKey(x)===selectionKey(it)))return list.filter(x=>selectionKey(x)!==selectionKey(it));
      const next=['상의','하의','신발','아우터'].includes(group(it))?list.filter(x=>group(x)!==group(it)):list;
      return next.length<6?[...next,it]:next;
    });setError('');
  };
  const generate=useCallback(async(pieces=selected,character=false,custom=personal)=>{
    if((!character&&pieces.length<2)||submitting||pending)return;
    setSubmitting(true);setError('');
    try {
      const prepared=await Promise.all(pieces.filter(x=>x.resource).map(materialImage));
      const job=await request(character?'/character':'/dress',json({request_id:crypto.randomUUID(),generation_revision:'personal-body2',item_ids:pieces.filter(x=>!x.resource).map(x=>x.serverId||x.id),resources:prepared.map(x=>({...x,category:({상의:'top',하의:'bottom',신발:'shoes',아우터:'outer',가방:'bag',소품:'accessory'}[group(x)]||x.category)})),gender:gender==='m'?'남성':'여성',personal:custom,face:custom&&useFace?(ctx.prefs.avatar||''):'',height:custom&&useBody?(ctx.prefs.height||''):'',weight:custom&&useBody?(ctx.prefs.weight||''):'',personal_color:custom&&useColor?(ctx.prefs.personalColor||''):'',styles:ctx.prefs.styles||[],pose}));
      setPending(job.id);window.dispatchEvent(new Event('lb-closet-jobs'));
    }catch(e){setError(e.message);}finally{setSubmitting(false);}
  },[selected,submitting,pending,ctx.prefs,pose,personal,useFace,useBody,useColor,gender]);
  const save=async()=>{
    if(!current||saving)return;setSaving(true);setError('');
    try{const saved=await request(`/${current.id}/save`,{method:'POST'});setCurrent(job=>({...job,saved_id:saved.id}));await ctx.refreshStudioLookbook();window.dispatchEvent(new Event('lb-closet-jobs'));ctx.showToast('룩북에 저장했어요');}catch(e){setError(e.message);}finally{setSaving(false);}
  };
  const share=()=>{window.RC_PENDING_STYLE=outfitLook(current.outfit,current.items);ctx.go('feed');window.dispatchEvent(new Event('rc-style-open'));onClose();};
  const materials=(source==='옷장'?ctx.items:resources).filter(x=>(x.name+' '+x.brand+' '+x.category).toLowerCase().includes(search.toLowerCase()));
  const matches=useCallback(job=>job.kind==='dress'&&job.generation_revision==='personal-body2'&&job.gender===(gender==='m'?'남성':'여성')&&!!job.personal===personal&&(!personal||(job.height===(useBody?(ctx.prefs.height||''):'')&&job.weight===(useBody?(ctx.prefs.weight||''):'')&&job.use_face===!!(useFace&&ctx.prefs.avatar)&&job.personal_color===(useColor?(ctx.prefs.personalColor||''):''))),[gender,personal,useBody,useFace,useColor,ctx.prefs.height,ctx.prefs.weight,ctx.prefs.avatar,ctx.prefs.personalColor]);
  const past=jobs.filter(x=>matches(x)&&!x.character&&x.status==='done');
  useEffect(()=>{setCurrent(null);setPending(null);setSelected([]);},[gender,personal,useFace,useBody,useColor,ctx.prefs.avatar,ctx.prefs.height,ctx.prefs.weight,ctx.prefs.personalColor]);
  useEffect(()=>{if(pending)return;const running=jobs.find(x=>matches(x)&&active(x));if(running){setPending(running.id);return;}if(!current){const latest=personal?jobs.find(x=>matches(x)&&x.character&&x.status==='done'):null;if(latest){const restored=(latest.character?[]:latest.items).map(x=>({...x,resource:String(x.id).startsWith('resource-')}));setSelected(restored);setCurrent(latest);}}},[jobs,current,pending,pose,personal,matches]);
  const pointerDown=(event,it)=>{
    if(event.button!==0||event.isPrimary===false||pending||submitting)return;
    const chosen=selected.some(x=>selectionKey(x)===selectionKey(it));
    const touch=event.pointerType==='touch';
    if(!touch||chosen){event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);}
    pointer.current={it,pieces:chosen?selected:[...selected.filter(x=>!['상의','하의','신발','아우터'].includes(group(it))||group(x)!==group(it)),it].slice(0,6),id:event.pointerId,x:event.clientX,y:event.clientY,at:Date.now(),touch,chosen};
  };
  useEffect(()=>{
    const move=e=>{
      const p=pointer.current;if(!p||p.id!==e.pointerId)return;
      const dist=Math.hypot(e.clientX-p.x,e.clientY-p.y);
      if(p.touch&&!p.chosen&&Date.now()-p.at<300){if(dist>12)pointer.current=null;return;}
      if(dist>7||p.moved){
        p.moved=true;setDrag({pieces:p.pieces,x:e.clientX,y:e.clientY});
        if(e.cancelable)e.preventDefault();
      }
    };
    const up=e=>{
      const p=pointer.current;if(!p||p.id!==e.pointerId)return;
      pointer.current=null;setDrag(null);
      if(!p.moved)return;
      suppressClick.current=true;setTimeout(()=>{suppressClick.current=false;},350);
      if(e.type==='pointercancel')return;
      const box=stage.current?.getBoundingClientRect();
      if(box&&e.clientX>=box.left&&e.clientX<=box.right&&e.clientY>=box.top&&e.clientY<=box.bottom){setSelected(p.pieces);generate(p.pieces);}
    };
    const stopScroll=e=>{if(pointer.current?.moved&&e.cancelable)e.preventDefault();};
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
    window.addEventListener('touchmove',stopScroll,{passive:false});window.addEventListener('wheel',stopScroll,{passive:false});
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);window.removeEventListener('touchmove',stopScroll);window.removeEventListener('wheel',stopScroll);};
  },[generate]);
  const image=(current&&matches(current)?current.outfit.lookImg:null)||`/studio-assets/characters/default-${gender}.png`;
  return <div className={'cs-overlay'+(drag?' cs-dragging':'')} role="region" aria-labelledby="cs-title"><header><div><h1 id="cs-title">직접 입혀보기</h1></div><IconBtn name="x" label="직접 입혀보기 닫기" onClick={onClose} data-cs-close style={{color:'var(--ink-2)',flexShrink:0}}/></header><div className="cs-layout"><section className="cs-preview"><div className={'cs-stage'+(drag?' cs-dropping':'')} ref={stage} aria-label="캐릭터에 아이템 놓기">{image?<img src={image} alt="내 착장 캐릭터"/>:<div className="cs-person"><svg viewBox="0 0 120 260" aria-hidden="true"><circle cx="60" cy="30" r="18"/><path d="M40 55Q60 47 80 55L96 126L82 131L72 92L72 147L79 245L63 245L59 163L56 245L40 245L48 147L48 92L35 131L22 126Z"/></svg><p>옷을 골라 나만의 착장을 만들어보세요</p></div>}{image&&<button type="button" className="cs-image-open" aria-label={`${current&&!current.character?'만든 착장':'캐릭터'} 크게 보기`} onClick={()=>ctx.openOutfitViewer({lookImg:image,label:current&&!current.character?'만든 착장':'내 캐릭터'},current?.items||[])}><span><Icon name="expand" size={18}/><span>크게 보기</span></span></button>}{(pending||submitting)&&<div className="cs-making" role="status">{submitting?'착장을 접수하는 중…':jobs.find(x=>x.id===pending)?.status==='queued'?'접수 완료 · 차례를 기다리는 중…':'새로운 착장을 만드는 중…'}<small>요청 후에는 앱을 닫아도 괜찮아요</small></div>}{image&&<span className="cs-ai-mark">✦ {current?.test_mode?'테스트 이미지 · 선택한 옷 미반영':'AI 생성'}</span>}</div><div className="cs-profile"><span>{personal?'내 정보 캐릭터':'기본 캐릭터'} · {gender==='m'?'남성':'여성'}</span><button onClick={()=>setProfileOpen(true)}>캐릭터 변경</button></div><div className="cs-picked">{selected.map(it=><button key={selectionKey(it)} draggable={false} onDragStart={e=>e.preventDefault()} onPointerDown={e=>pointerDown(e,it)} onClick={()=>{if(suppressClick.current)return;setSelected(list=>list.filter(x=>selectionKey(x)!==selectionKey(it)));}} aria-label={`${it.name} 빼기`}><img draggable={false} src={it.thumb||it.img} alt=""/><span>{it.name}</span>×</button>)}</div><div className="cs-controls"><label>포즈<select value={pose} onChange={e=>setPose(e.target.value)}>{POSES.map(p=><option key={p}>{p}</option>)}</select></label><span>선택 후 입히기 · 생성 시 10크레딧</span></div>{error&&<p className="cs-error" role="alert">{error}</p>}<button className="cs-primary" disabled={selected.length<2||!!pending||submitting} onClick={()=>generate()}>{pending?'착장 만드는 중':current&&!current.character?'다른 착장으로 다시 보기':'이 조합 입혀보기'}</button>{current&&!current.character&&<div className="cs-actions"><button disabled={saving||!!current.saved_id} onClick={save}>{saving?'저장 중…':current.saved_id?'룩북에 저장됨':'룩북 저장'}</button><button onClick={share}>꾸며서 피드 공유</button></div>}{past.length>0&&<div className="cs-history" aria-label="만든 착장 기록">{past.map(job=><button key={job.id} aria-label="이 착장 다시 보기" onClick={()=>{const restored=job.items.map(x=>({...x,resource:String(x.id).startsWith('resource-')}));setSelected(restored);setCurrent(job);}}><img src={job.outfit.lookImg} alt="만든 착장"/></button>)}</div>}</section><aside className="cs-materials"><div className="cs-tabs">{['옷장','만들기 재료'].map(value=><button key={value} aria-pressed={source===value} onClick={()=>setSource(value)}>{value}</button>)}</div><input aria-label="아이템 검색" value={search} onChange={e=>setSearch(e.target.value)} placeholder="이름·브랜드로 찾기"/><p className="cs-hint">옷을 고른 뒤 입혀보세요. 고른 옷을 함께 끌어놓아도 돼요.</p><div className="cs-grid">{materials.map(it=><button key={selectionKey(it)} aria-label={`${it.name} 입혀보기`} aria-pressed={selected.some(x=>selectionKey(x)===selectionKey(it))} draggable={false} onDragStart={e=>e.preventDefault()} onPointerDown={e=>pointerDown(e,it)} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}add(it);}}><img draggable={false} loading="lazy" src={it.thumb||it.img} alt=""/><small>{it.brand}</small><span>{it.name}</span></button>)}</div>{!materials.length&&<p className="cs-hint">{search?'검색 결과가 없어요.':source==='옷장'?'옷장에 아이템을 먼저 담아주세요.':'피드에서 아이템을 저장하면 여기에 모여요.'}</p>}</aside></div>{profileOpen&&<div className="cs-profile-backdrop" onClick={()=>setProfileOpen(false)}><section className="cs-profile-sheet" role="dialog" aria-modal="true" aria-labelledby="cs-profile-title" onClick={e=>e.stopPropagation()}><header><h2 id="cs-profile-title">캐릭터 변경</h2><IconBtn name="x" label="캐릭터 변경 닫기" onClick={()=>setProfileOpen(false)} style={{color:'var(--ink-2)',flexShrink:0}}/></header><Btn full variant="secondary" icon="user" style={{marginTop:20}} onClick={()=>{if(personal){setPersonal(false);setCurrent(null);}setProfileOpen(false);ctx.showToast(personal?'기본 캐릭터로 바꿨어요':'기본 캐릭터를 유지했어요');}}>{personal?'기본 캐릭터 사용하기':'기본 캐릭터 유지하기'}</Btn><div className="cs-default-hint">{!personal?'현재 사용 중 · ':''}추가 생성 없이 사용</div><p>내 정보로 캐릭터를 바꿔요</p><label><input type="checkbox" checked={!!ctx.prefs.avatar&&useFace} disabled={!ctx.prefs.avatar} onChange={e=>setUseFace(e.target.checked)}/>내 얼굴{!ctx.prefs.avatar&&<small>마이에서 사진 등록</small>}</label><label><input type="checkbox" checked={!!ctx.prefs.height&&!!ctx.prefs.weight&&useBody} disabled={!ctx.prefs.height||!ctx.prefs.weight} onChange={e=>setUseBody(e.target.checked)}/>키 · 몸무게 <small>{ctx.prefs.height&&ctx.prefs.weight?`${ctx.prefs.height}cm / ${ctx.prefs.weight}kg`:'마이에서 정보 등록'}</small></label><label><input type="checkbox" checked={!!ctx.prefs.personalColor&&useColor} disabled={!ctx.prefs.personalColor} onChange={e=>setUseColor(e.target.checked)}/>퍼스널 컬러 <small>{ctx.prefs.personalColor||'마이에서 정보 등록'}</small></label><button className="cs-settings-link" onClick={()=>{onClose();ctx.go('mypage');}}>내 정보 수정</button><button className="cs-primary" disabled={!!pending||submitting||!((useFace&&ctx.prefs.avatar)||(useBody&&ctx.prefs.height&&ctx.prefs.weight)||(useColor&&ctx.prefs.personalColor))} onClick={()=>{setPersonal(true);setProfileOpen(false);generate([],true,true);}}>내 캐릭터 만들기 · 10크레딧</button></section></div>}{drag&&createPortal(<div className="cs-drag" style={{left:drag.x,top:drag.y}} aria-hidden="true"><div className="cs-drag-items">{drag.pieces.map(it=><img key={selectionKey(it)} draggable={false} src={it.thumb||it.img} alt=""/>)}</div><span>{drag.pieces.length}개 함께 입히기</span></div>,document.body)}</div>;
};

Object.assign(window,{ClosetStudio,ClosetJobStatus});
