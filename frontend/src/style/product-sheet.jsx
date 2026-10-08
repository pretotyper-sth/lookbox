import React, { useState } from 'react';
import { StudioSheet } from './social.jsx';
import { outfitPrice } from '../look-layout.js';
const { Icon }=window;
export default function ProductSheet({look,collections,onSaveItem,onClose}) {
 const [selected,setSelected]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const items=(look.items||[]).filter((item,i,all)=>all.findIndex(x=>x.id===item.id)===i);
 const saved=item=>collections.some(x=>x.type==='item'&&x.item.id===item.id);
 const save=async item=>{setError('');setBusy(true);try{await onSaveItem(item);}catch(e){setError(e.message);}finally{setBusy(false);}};
 const fields=selected?[['종류',selected.category],['색상',selected.color],['사이즈',selected.size],['소재',selected.material],['구매처',selected.store],['기록한 가격',selected.price?outfitPrice(selected.price):''],['메모',selected.note]].filter(([,value])=>value):[];
 return <StudioSheet open title="피드 아이템" description={`${look.author||'작성자'}님이 이 피드에 담은 아이템 정보예요.`} desktopMaxW={520} bodyStyle={items.length?{height:'80dvh',boxSizing:'border-box'}:undefined} zIndex={155} dismissOnScrim onClose={onClose}>
  <section className="rc-feed-products" role="dialog" aria-label="피드 아이템 정보">
   {selected?<><button className="rc-product-back" onClick={()=>{setSelected(null);setError('');}}><span aria-hidden="true">←</span> 아이템 목록</button><div className="rc-product-detail-image">{selected.img?<img src={selected.img} alt={selected.name}/>:<Icon name="hanger" size={42}/>}</div>{selected.brand&&<p className="rc-product-brand">{selected.brand}</p>}<h3>{selected.name||'이름 없는 아이템'}</h3><dl className="rc-product-fields">{fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{selected.url?.startsWith('https://')&&<a className="rc-product-source" href={selected.url} target="_blank" rel="noreferrer">작성자가 등록한 아이템 링크 ↗</a>}<button className="rc-product-material-button" disabled={busy||saved(selected)} onClick={()=>save(selected)}>{busy?'담는 중…':saved(selected)?'만들기 재료에 담김':'만들기 재료로 담기'}</button><p className="rc-product-material-help">만들기 → 옷장 → 만들기 재료에서 사용할 수 있어요.<br/>옷장과 저장한 룩에는 추가되지 않아요.</p></>:<><p className="rc-product-count">아이템 {items.length}개</p><div className="rc-product-list">{items.map(item=><button key={item.id} aria-label={`${item.name||'아이템'} 상세 정보 보기`} onClick={()=>{setSelected(item);setError('');}}><span className="rc-product-list-image">{item.img?<img src={item.img} alt="" loading="lazy"/>:<Icon name="hanger" size={25}/>}</span><span className="rc-product-list-copy">{item.brand&&<small>{item.brand}</small>}<strong>{item.name||'이름 없는 아이템'}</strong><span>{item.price?outfitPrice(item.price):item.category}</span>{saved(item)&&<em>만들기 재료에 담김</em>}</span><span className="rc-product-chevron" aria-hidden="true">›</span></button>)}</div>{!items.length&&<p className="rc-creator-empty">작성자가 등록한 아이템 정보가 없어요.</p>}</>}
   {error&&<p className="rc-error" role="alert">{error}</p>}
  </section>
 </StudioSheet>;
}
