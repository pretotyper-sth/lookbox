import React, {useCallback, useEffect, useRef, useState} from 'react';
import {api, SAMPLE_LOOKS, hashtagKey, cleanHashtag, lookHashtags} from './model.js';
import {StyleCanvas} from './collage-canvas.jsx';
import './feed-search.css';
const {Icon, Btn, EmptyState} = window;
const cache = new Map();
export const invalidateSearch = () => cache.clear();
async function suggestions(query) {
  const now=Date.now(),previous=cache.get(query);
  if(previous&&now-previous.at<20000)return previous.data;
  const data=await api('/search?q='+encodeURIComponent(query));
  if(cache.size>30)cache.delete(cache.keys().next().value);
  cache.set(query,{at:now,data});return data;
}
function mergedSuggestions(data, query) {
  const key=hashtagKey(query), tags=new Map((data.tags||[]).map(x=>[x.tag,{...x}]));
  for(const look of SAMPLE_LOOKS)for(const tag of lookHashtags(look))if(tag.startsWith(key)){const row=tags.get(tag)||{tag,count:0};row.count++;tags.set(tag,row);}
  const samples=[...new Map(SAMPLE_LOOKS.filter(x=>hashtagKey(x.author).includes(key)).map(x=>[x.author,{author:x.author,avatar:x.avatar,sample:true}])).values()];
  return {tags:[...tags.values()].sort((a,b)=>Number(b.tag===key)-Number(a.tag===key)||b.count-a.count||a.tag.localeCompare(b.tag)).slice(0,12),profiles:query.startsWith('#')?[]:[...(data.profiles||[]),...samples].slice(0,16)};
}
export function PostTags({look,onTag}) {
  const tags=lookHashtags(look);
  return tags.length?<div className="rc-post-tags">{tags.map(tag=><button key={tag} onClick={()=>onTag(tag)}>#{tag}</button>)}</div>:null;
}
export function CaptionText({text}) {
  return String(text||'');
}
export function HashtagInput({look,onChange}) {
  const [value,setValue]=useState(''),[rows,setRows]=useState([]),[error,setError]=useState(''),[active,setActive]=useState(-1);
  const input=useRef(null), composing=useRef(false),tags=lookHashtags(look),tagSignature=JSON.stringify(tags);
  useEffect(()=>{
    let alive=true;setRows([]);setActive(-1);
    if(!cleanHashtag(value))return;
    const timer=setTimeout(()=>suggestions(value).then(data=>{if(alive)setRows(mergedSuggestions(data,value).tags.filter(x=>!JSON.parse(tagSignature).includes(x.tag)));}).catch(()=>{}),250);
    return()=>{alive=false;clearTimeout(timer);};
  },[value,tagSignature]);
  const add=(raw=value)=>{
    const tag=cleanHashtag(raw);if(!tag){if(raw.trim())setError('한글·영문·숫자·밑줄로 24자까지 입력해 주세요.');return;}
    if(!tags.includes(tag)&&tags.length>=10){setError('해시태그는 10개까지 넣을 수 있어요.');return;}
    onChange({...look,hashtags:[...new Set([...(look.hashtags||[]),tag])]});setValue('');setRows([]);setError('');input.current?.focus();
  };
  return <section className="rc-tag-editor" aria-label="해시태그 입력"><label htmlFor="rc-hashtag-input">해시태그 <small>{tags.length}/10</small></label><div className="rc-tag-entry"><span aria-hidden="true">#</span><input ref={input} id="rc-hashtag-input" value={value} maxLength={26} placeholder="데일리룩, 출근룩" autoComplete="off" aria-label="해시태그" role="combobox" aria-expanded={rows.length>0} aria-controls="rc-tag-suggestions" aria-autocomplete="list" aria-activedescendant={active>=0?`rc-tag-option-${active}`:undefined} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} onChange={e=>{setValue(e.target.value);setError('');}} onKeyDown={e=>{if(e.isComposing||composing.current)return;if(e.key==='ArrowDown'&&rows.length){e.preventDefault();setActive(n=>Math.min(n+1,rows.length-1));}else if(e.key==='ArrowUp'){e.preventDefault();setActive(n=>Math.max(0,n-1));}else if(['Enter',',',' '].includes(e.key)){e.preventDefault();add(active>=0?rows[active].tag:value);}else if(e.key==='Escape'){setRows([]);}}} onBlur={e=>{if(!e.relatedTarget?.closest('.rc-tag-editor')&&value.trim())add();}}/><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>add()} disabled={!value.trim()}>추가</button></div>{rows.length>0&&<ul id="rc-tag-suggestions" role="listbox" className="rc-tag-suggestions">{rows.map((row,i)=><li key={row.tag} role="option" id={`rc-tag-option-${i}`} aria-selected={active===i}><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>add(row.tag)}><span>#{row.tag}</span><small>피드 {row.count}개</small></button></li>)}</ul>}{tags.length>0&&<div className="rc-tag-chips">{tags.map(tag=><button type="button" key={tag} aria-label={`#${tag} 삭제`} onClick={()=>onChange({...look,hashtags:(look.hashtags||[]).filter(x=>cleanHashtag(x)!==tag)})}>#{tag}<Icon name="x" size={12}/></button>)}</div>}<small className="rc-tag-help">검색에서 찾기 쉽도록 태그를 넣어 주세요.</small>{error&&<p className="rc-error" role="alert">{error}</p>}</section>;
}
const recentKey=()=>`rc_feed_search_${localStorage.getItem('rc_studio_owner')||'guest'}`;
function readRecent(){try{return JSON.parse(localStorage.getItem(recentKey())||'[]').slice(0,10);}catch{return [];}}
export default function FeedSearch({initialTag='',onProfile,onOpen,hidden=[]}) {
  const [query,setQuery]=useState(initialTag?'#'+initialTag:''),[tab,setTab]=useState('all'),[tag,setTag]=useState(initialTag),[data,setData]=useState({tags:[],profiles:[]}),[posts,setPosts]=useState([]),[cursor,setCursor]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[recent,setRecent]=useState(readRecent),[retry,setRetry]=useState(0);
  const request=useRef(0),input=useRef(null);
  useEffect(()=>{if(!initialTag)input.current?.focus();},[initialTag]);
  useEffect(()=>{
    if(tag)return;
    let alive=true;setBusy(true);setError('');setData(mergedSuggestions({},query));
    const timer=setTimeout(()=>suggestions(query).then(next=>{if(alive){setData(mergedSuggestions(next,query));setBusy(false);}}).catch(e=>{if(alive){setError(e.message);setData(mergedSuggestions({},query));setBusy(false);}}),query?250:0);
    return()=>{alive=false;clearTimeout(timer);};
  },[query,tag,retry]);
  const remember=(value,kind)=>{const next=[{value,kind},...recent.filter(x=>x.value!==value||x.kind!==kind)].slice(0,10);setRecent(next);try{localStorage.setItem(recentKey(),JSON.stringify(next));}catch{}};
  const removeRecent=value=>{const next=recent.filter(x=>x!==value);setRecent(next);try{localStorage.setItem(recentKey(),JSON.stringify(next));}catch{}};
  const pickTag=value=>{remember(value,'tag');setTag(value);setQuery('#'+value);};
  const loadPosts=useCallback(async(nextCursor,signal)=>{
    const ticket=++request.current;setBusy(true);setError('');
    try{const next=await api('/search?'+new URLSearchParams({tag,...(nextCursor?{cursor:nextCursor}:{})}),{signal});if(!signal?.aborted&&ticket===request.current){setPosts(list=>nextCursor?[...list,...next.looks]:next.looks);setCursor(next.nextCursor);}}
    catch(e){if(!signal?.aborted&&ticket===request.current)setError(e.message);}finally{if(!signal?.aborted&&ticket===request.current)setBusy(false);}
  },[tag]);
  useEffect(()=>{if(!tag)return;const controller=new AbortController();setPosts([]);setCursor(null);loadPosts(null,controller.signal);return()=>controller.abort();},[tag,loadPosts]);
  const samples=tag?SAMPLE_LOOKS.filter(x=>lookHashtags(x).includes(tag)):[];
  const visible=[...posts,...samples].filter(x=>!hidden.includes(x.id)).sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0));
  const openPerson=person=>{remember(person.author,'profile');onProfile(person);};
  return <section className="rc-search-page" aria-label="피드 검색"><form className="rc-search-field" onSubmit={e=>{e.preventDefault();if(query.startsWith('#')&&cleanHashtag(query))pickTag(cleanHashtag(query));else if(query.trim())remember(query.trim(),'query');}}><Icon name="search" size={20}/><input ref={input} type="search" value={query} maxLength={80} placeholder="프로필명, 해시태그 검색" aria-label="프로필명 또는 해시태그 검색" onChange={e=>{setQuery(e.target.value);setTag('');}}/>{query&&<button type="button" aria-label="검색어 지우기" onClick={()=>{setQuery('');setTag('');input.current?.focus();}}><Icon name="x" size={18}/></button>}</form>{tag?<><div className="rc-search-tag-head"><button onClick={()=>{setTag('');}} aria-label="검색 목록으로 돌아가기"><Icon name="chevL" size={18}/></button><div><h2>#{tag}</h2><p>태그가 포함된 피드 · 최신순</p></div></div>{visible.length>0&&<div className="rc-search-grid">{visible.map(look=><button key={look.id} aria-label={`${look.author}의 ${look.note||look.title} 보기`} onClick={()=>onOpen(look)}><StyleCanvas look={look} showCredits={false}/></button>)}</div>}{!busy&&!error&&!visible.length&&<EmptyState icon="feed" title="아직 이 태그의 피드가 없어요" hintHidden>다른 해시태그로 찾아보세요.</EmptyState>}{cursor&&<Btn full variant="secondary" disabled={busy} onClick={()=>loadPosts(cursor)}>더 보기</Btn>}</>:<><nav className="rc-search-tabs" aria-label="검색 분류">{[['all','전체'],['profiles','계정'],['tags','해시태그']].map(([value,label])=><button key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}</button>)}</nav>{!query&&recent.length>0&&<div className="rc-search-recent"><header><h2>최근 검색</h2><button onClick={()=>{setRecent([]);localStorage.removeItem(recentKey());}}>모두 지우기</button></header>{recent.map((row,i)=><div key={i}><button onClick={()=>{if(row.kind==='tag')pickTag(row.value);else setQuery(row.value);}}><Icon name="search" size={17}/>{row.kind==='tag'?'#':''}{row.value}</button><button aria-label={`${row.value} 최근 검색 삭제`} onClick={()=>removeRecent(row)}><Icon name="x" size={16}/></button></div>)}</div>}{query&&tab!=='tags'&&data.profiles.length>0&&<div className="rc-search-list"><h2>계정</h2>{data.profiles.map(person=><button className="rc-search-person" key={person.creatorId||person.author} onClick={()=>openPerson(person)}><span className="rc-post-avatar">{person.avatar?<img src={person.avatar} alt=""/>:<Icon name="user" size={20}/>}</span><span><b>{person.author}</b><small>공개 프로필 보기</small></span><Icon name="chevR" size={16}/></button>)}</div>}{tab!=='profiles'&&data.tags.length>0&&<div className="rc-search-list"><h2>{query?'해시태그':'둘러볼 해시태그'}</h2>{data.tags.map(row=><button className="rc-search-tag-row" key={row.tag} onClick={()=>pickTag(row.tag)}><span className="rc-search-hash">#</span><span><b>#{row.tag}</b><small>피드 {row.count}개</small></span><Icon name="chevR" size={16}/></button>)}</div>}{query&&!busy&&!error&&!(tab==='profiles'?data.profiles.length:tab==='tags'?data.tags.length:data.profiles.length+data.tags.length)&&<EmptyState icon="search" title="검색 결과가 없어요" hintHidden>프로필명이나 다른 해시태그로 찾아보세요.</EmptyState>}</>}{busy&&<p className="rc-search-status" role="status">불러오는 중…</p>}{error&&<div className="rc-search-status"><p className="rc-error" role="alert">{error}</p><button onClick={()=>tag?loadPosts(cursor):setRetry(n=>n+1)}>다시 시도</button></div>}</section>;
}
