import React, { useRef, useState } from 'react';
import { BACKGROUNDS } from './model.js';
import { outfitPrice } from '../look-layout.js';
import { FONTS, strokeLayer } from './collage.js';

export function LayerArt({ layer }) {
  if(layer.type==='giphy')return <iframe title={layer.label||'GIPHY GIF'} src={`https://giphy.com/embed/${layer.giphyId}`} allowFullScreen loading="lazy" tabIndex={-1} sandbox="allow-scripts allow-same-origin allow-popups"/>;
  if(layer.type==='image')return <img src={layer.img} alt={layer.label||'콜라주 이미지'} draggable="false" loading="lazy"/>;
  if(layer.type==='stroke'){
    const ratio=layer.ratio||1;
    const points=(layer.points||[]).map(p=>`${p[0]},${p[1]/ratio}`).join(' ');
    return <svg viewBox={`0 0 100 ${100/ratio}`} aria-label="펜으로 그린 낙서"><polyline points={points} fill="none" stroke={layer.color||'#292824'} strokeWidth={(layer.width||1)*100/(layer.scale||100)} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={layer.brush==='dotted'?'1 6':undefined}/></svg>;
  }
  return <span className={`rc-layer-text rc-text-${layer.textStyle||'plain'}`} style={{fontFamily:FONTS[layer.font]||FONTS.sans,fontSize:`${(layer.size||26)/4}cqw`,fontWeight:layer.bold===false?400:layer.bold||layer.font==='bold'?800:undefined,fontStyle:layer.italic?'italic':'normal',color:layer.color||'inherit',background:layer.textStyle==='label'?(layer.bg||'#d7fa3a'):undefined}}>{layer.text}</span>;
}

export function StyleCanvas({ look, editing=false, selected, onSelect, onEmptyPointerDown, onMove, onGesture, stageRef, pen, onStroke, showCredits=true, editingText, onTextChange, onTextEdit, onTextDone }) {
  const drag=useRef(null),stroke=useRef([]),dragged=useRef(false);
  const [drawing,setDrawing]=useState([]);
  const gesture=(e,id,x,y,kind,layer)=>{
    if(!editing||pen||e.target.closest('textarea'))return;dragged.current=false;onSelect?.(kind==='layer'?`layer:${id}`:id);
    const prev=drag.current;
    if(prev?.id===id){prev.pointers.set(e.pointerId,[e.clientX,e.clientY]);if(prev.pointers.size===2){const [a,b]=[...prev.pointers.values()];prev.mode='pinch';prev.distance=Math.hypot(b[0]-a[0],b[1]-a[1]);prev.angle=Math.atan2(b[1]-a[1],b[0]-a[0]);}e.currentTarget.setPointerCapture(e.pointerId);return;}
    onGesture?.();const rect=e.currentTarget.closest('.rc-canvas').getBoundingClientRect(),cx=rect.left+x/100*rect.width,cy=rect.top+y/100*rect.height;
    drag.current={id,x:e.clientX,y:e.clientY,ox:x,oy:y,rect,kind,cx,cy,mode:e.target.closest('.rc-transform-handle')?'transform':'move',field:layer.type==='text'||(!layer.type&&kind==='layer')?'size':'scale',base:layer.type==='text'||(!layer.type&&kind==='layer')?(layer.size||26):(layer.scale||28),rotation:layer.rotation||0,distance:Math.hypot(e.clientX-cx,e.clientY-cy),angle:Math.atan2(e.clientY-cy,e.clientX-cx),pointers:new Map([[e.pointerId,[e.clientX,e.clientY]]])};e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move=e=>{
    const d=drag.current;if(!d)return;if(d.mode!=='move'||Math.hypot(e.clientX-d.x,e.clientY-d.y)>4)dragged.current=true;d.pointers.set(e.pointerId,[e.clientX,e.clientY]);
    if(d.mode!=='move'){
      let distance=Math.hypot(e.clientX-d.cx,e.clientY-d.cy),angle=Math.atan2(e.clientY-d.cy,e.clientX-d.cx);
      if(d.mode==='pinch'){if(d.pointers.size!==2)return;const [a,b]=[...d.pointers.values()];distance=Math.hypot(b[0]-a[0],b[1]-a[1]);angle=Math.atan2(b[1]-a[1],b[0]-a[0]);}
      const rotation=((d.rotation+(angle-d.angle)*180/Math.PI+540)%360)-180;
      onMove?.(d.id,{[d.field]:Math.max(d.field==='size'?12:8,Math.min(d.field==='size'?70:110,d.base*distance/Math.max(d.distance,1))),rotation},d.kind);return;
    }
    onMove?.(d.id,{x:Math.max(0,Math.min(100,d.ox+(e.clientX-d.x)/d.rect.width*100)),y:Math.max(0,Math.min(100,d.oy+(e.clientY-d.y)/d.rect.height*100))},d.kind);
  };
  const end=()=>{drag.current=null;};
  const handle=(layer,kind)=><span className="rc-transform-handle" role="button" tabIndex={0} aria-label="크기·회전 조절" onKeyDown={e=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();onGesture?.();const field=layer.type==='text'?'size':'scale';onMove?.(layer.id,e.key==='ArrowLeft'||e.key==='ArrowRight'?{rotation:Math.max(-180,Math.min(180,(layer.rotation||0)+(e.key==='ArrowRight'?5:-5)))}:{[field]:Math.max(field==='size'?12:8,Math.min(field==='size'?70:110,(layer[field]||28)+(e.key==='ArrowUp'?2:-2)))},kind);}}>↗</span>;
  const point=e=>{const r=e.currentTarget.getBoundingClientRect();return [Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100)),Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100))];};
  return <div ref={stageRef} className={'rc-canvas'+(editing?' rc-editable':'')+(look.background==='ink'?' rc-dark':'')} style={{background:BACKGROUNDS[look.background]||BACKGROUNDS.ivory,color:look.background==='ink'?'#F7F5F0':'var(--ink)'}} onPointerDown={e=>{if(editing&&e.target===e.currentTarget)onEmptyPointerDown?.();}}>
    {look.photo&&look.includePhoto&&<img className="rc-canvas-photo" src={look.photo} alt="공유에 포함한 착장 사진"/>}
    {[...look.items].sort((a,b)=>a.z-b.z).map(it=>{const Tag=editing?'button':'div';return <Tag key={it.id} type={editing?'button':undefined} className={'rc-garment'+(selected===it.id?' selected':'')} aria-label={`${it.name}${editing?' 선택하고 이동':''}`} style={{left:`${it.x}%`,top:`${it.y}%`,width:`${it.scale}%`,transform:`translate(-50%,-50%) rotate(${it.rotation||0}deg)`,zIndex:it.z||0}} onClick={()=>editing&&onSelect?.(it.id)} onPointerDown={e=>gesture(e,it.id,it.x,it.y,'item',it)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>{it.img?<img src={it.img} alt={it.name} draggable="false"/>:<span className="rc-missing">{it.name}</span>}{it.showInfo&&<span className="rc-product-info">{it.brand&&<strong>{it.brand}</strong>}<span>{it.name}</span>{it.price&&<b>{outfitPrice(it.price)}</b>}</span>}{editing&&selected===it.id&&handle(it,'item')}</Tag>;})}
    {(look.decorations||[]).map((l,i)=>{const key=l.id||String(i),isText=!l.type||l.type==='text';return <div key={key} role={editing?'button':undefined} tabIndex={editing?0:undefined} aria-label={editing?`${l.text||l.label||'낙서'} 장식 선택`:undefined} className={'rc-collage-layer'+(selected===`layer:${key}`?' selected':'')+` rc-motion-${l.motion||'none'}`} style={{left:`${l.x}%`,top:`${l.y}%`,width:isText?'max-content':`${l.scale||28}%`,maxWidth:isText?'94%':undefined,aspectRatio:!isText?(l.ratio||(l.type==='giphy'?1.3:1)):undefined,transform:`translate(-50%,-50%) rotate(${l.rotation||0}deg)`,zIndex:l.z??40+i,opacity:l.opacity??1}} onDoubleClick={()=>editing&&isText&&onTextEdit?.(`layer:${key}`)} onClick={()=>{if(!editing)return;if(dragged.current){dragged.current=false;return;}if(isText)onTextEdit?.(`layer:${key}`);else onSelect?.(`layer:${key}`);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.(`layer:${key}`);}}} onPointerDown={e=>gesture(e,key,l.x,l.y,'layer',l)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>{editing&&editingText===`layer:${key}`?<textarea autoFocus className="rc-inline-text" aria-label="캔버스 텍스트 입력" placeholder="텍스트 입력" value={l.text} maxLength={180} rows={Math.max(1,(l.text||'').split('\n').length)} style={{fontFamily:FONTS[l.font]||FONTS.sans,fontSize:`${(l.size||26)/4}cqw`,fontWeight:l.bold===false?400:l.bold||l.font==='bold'?800:400,fontStyle:l.italic?'italic':'normal',color:l.color||'#292824'}} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'||(e.key==='Enter'&&(e.metaKey||e.ctrlKey))){e.preventDefault();onTextDone?.();}}} onChange={e=>onTextChange?.(`layer:${key}`,e.target.value)}/>:<LayerArt layer={l}/>} {editing&&selected===`layer:${key}`&&editingText!==`layer:${key}`&&handle(l,'layer')}</div>;})}
    {showCredits&&(look.decorations||[]).some(x=>x.type==='giphy')&&<div className="rc-canvas-credits">{(look.decorations||[]).some(x=>x.type==='giphy')&&<a href="https://giphy.com/" target="_blank" rel="noreferrer">Powered by GIPHY</a>}</div>}
    {editing&&pen&&<svg className="rc-pen-overlay" viewBox="0 0 100 125" aria-label="캔버스에 펜으로 그리기" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);stroke.current=[point(e)];setDrawing(stroke.current);}} onPointerMove={e=>{if(!stroke.current.length||stroke.current.length>=800)return;stroke.current=[...stroke.current,point(e)];setDrawing(stroke.current);}} onPointerUp={()=>{if(stroke.current.length){const pts=stroke.current.length===1?[...stroke.current,...stroke.current]:stroke.current;onStroke(strokeLayer(pts,pen.color,pen.width,pen.brush));}stroke.current=[];setDrawing([]);}} onPointerCancel={()=>{stroke.current=[];setDrawing([]);}}><polyline points={drawing.map(p=>`${p[0]},${p[1]*1.25}`).join(' ')} fill="none" stroke={pen.color} strokeWidth={pen.width} strokeLinecap="round" strokeLinejoin="round" opacity={pen.brush==='highlighter'?.4:1} strokeDasharray={pen.brush==='dotted'?'1 6':undefined}/></svg>}
  </div>;
}
