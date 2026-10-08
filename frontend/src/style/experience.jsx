import React, { useEffect, useRef, useState } from 'react';
import { SAMPLE_LOOKS, newLook, outfitLook, remix, canRemix, safeDraft, uid, api, readDraft, writeDraft, clearDraft } from './model.js';
import './experience.css';
import Editor from './story-editor.jsx';
import ProductSheet from './product-sheet.jsx';
import ShareSheet from './share-sheet.jsx';
import CreatorProfile from './creator-profile.jsx';
import {identity,useSocialProfile,NotificationMenu,NotificationPage,RestyleIcon,socialChanged,StudioSheet} from './social.jsx';
import {FriendVote} from './friend-vote.jsx';
export {SharedVotePage} from './friend-vote.jsx';
import { StyleCanvas } from './collage-canvas.jsx';
export { StyleCanvas } from './collage-canvas.jsx';
const { Btn, Icon, Wordmark, EmptyState } = window;
window.RC_LEGACY_LOOKBOOK ||= window.LookbookScreen;

const PRIVACY = { private: '나만 보기', link: '링크 받은 사람', public: '피드에 공개' };
const EMPTY = { collections: [], diary: [], follows: [], hidden: [] };
const thumb = (item) => ({ id: item.id, name: item.name, category: item.category, img: item.img || '', brand: item.brand || '', price: item.price || '', color: item.color || '', size: item.size || '', material: item.material || '', store: item.store || '', note: item.note || '', url: item.url || '', kind: 'owned' });

function ErrorLine({ error }) { return error ? <p className="rc-error" role="alert">{error}</p>:null; }
function Action({ children, onClick, active=false, disabled=false }) { return <button className={'rc-action'+(active?' active':'')} type="button" disabled={disabled} onClick={onClick}>{children}</button>; }

function PostActions({look,onLike,onBookmark,onCreate,onItems,onShare,saved=false}) {
 return <div className="rc-post-actions"><div><button aria-label={look.myLike?'좋아요 취소':'좋아요'} aria-pressed={!!look.myLike} onClick={onLike}><Icon name="heart" size={24} fill={look.myLike?'#e44d64':'none'}/></button><button aria-label={saved?'피드 저장 취소':'피드 저장'} aria-pressed={saved} onClick={onBookmark}><Icon name="bookmark" size={23} fill={saved?'currentColor':'none'}/></button>{onItems&&<button aria-label={`${look.title} 아이템 목록 보기`} title="아이템 목록" onClick={onItems}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r=".8"/><circle cx="4" cy="12" r=".8"/><circle cx="4" cy="18" r=".8"/></svg></button>}{onShare&&<button aria-label={`${look.title} 공유하기`} title="공유하기" onClick={onShare}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m21 3-7 18-4-7-7-4 18-7ZM10 14l11-11"/></svg></button>}</div>{onCreate&&<button className="rc-remix-icon" aria-label="리스타일하기" title="리스타일 · 내 스타일로 꾸미기" onClick={onCreate}><RestyleIcon/></button>}</div>;
}

function LookCard({look,onOpen,onCreate,onLike,onBookmark,onItems,onShare,saved=false}) {
 return <article className="rc-look-card"><button className="rc-card-image" onClick={onOpen} aria-label={`${look.title} 보기`}><StyleCanvas look={look}/></button><PostActions look={look} onLike={onLike} onBookmark={onBookmark} onCreate={onCreate} onItems={onItems} onShare={onShare} saved={saved}/><div className="rc-post-caption">{(look.stats?.likes||0)>0&&<b>좋아요 {look.stats.likes}개</b>}<p><strong>{look.author}</strong> {look.note||look.title}</p>{look.origin&&<small>↻ {look.origin.author}의 스타일을 리스타일</small>}</div></article>;
}

function PostDate({value}) {
 const date=new Date(value),elapsed=Math.max(0,Date.now()-date.getTime());
 if(!value||Number.isNaN(date.getTime()))return null;
 const minutes=Math.floor(elapsed/60000),hours=Math.floor(elapsed/3600000),days=Math.floor(elapsed/86400000);
 const label=minutes<1?'방금':hours<1?`${minutes}분`:days<1?`${hours}시간`:days<7?`${days}일`:days<30?`${Math.floor(days/7)}주`:days<365?`${Math.floor(days/30)}개월`:`${Math.floor(days/365)}년`;
 return <time className="rc-post-date" dateTime={date.toISOString()} title={date.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}>· {label}</time>;
}

function MyStyleCard({look,onOpen,onShare,onMore}) {
 return <article className="rc-look-card rc-my-style-card"><button className="rc-card-image" onClick={onOpen} aria-label={`${look.title} 편집`}><StyleCanvas look={look} showCredits={false}/></button><div className="rc-my-card-footer"><div><h3>{look.title}</h3><p>{PRIVACY[look.privacy]}</p></div><div className="rc-my-card-buttons"><button aria-label={`${look.title} 공유 설정`} title="공유 설정" onClick={onShare}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V3m-4 4 4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg></button><button aria-label={`${look.title} 관리`} title="스타일 관리" onClick={onMore}><Icon name="more" size={21}/></button></div></div></article>;
}

function SharedContent({ token, initialLook, owned=[], onRemix, onSaveItem, onFollow, followed=false, onHide }) {
  const [look,setLook]=useState(initialLook?.sample?initialLook:null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const load=async()=>{setError('');try{setLook(initialLook?.sample?{...initialLook,...(await api('/sample-reactions')).looks.find(x=>x.id===initialLook.id)}:await api(`/shared/${token}`));}catch(e){setError(e.message);}};
  useEffect(()=>{if(initialLook?.sample){let active=true;api('/sample-reactions').then(x=>{if(active)setLook({...initialLook,...x.looks.find(r=>r.id===initialLook.id)});}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};}let alive=true;api(`/shared/${token}`).then(data=>{if(alive)setLook(data);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[token,initialLook]);
  const react=async(kind,value)=>{setBusy(true);try{await api(initialLook?.sample?`/samples/${initialLook.id}/reaction`:`/shared/${token}/reaction`,{method:'POST',body:JSON.stringify({kind,value})});await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
  if(!look)return <div className="rc-shared-loading"><ErrorLine error={error}/>{!error&&<p>스타일을 불러오는 중…</p>}</div>;
  return <div className="rc-shared-content"><div className="rc-shared-grid"><div className="rc-shared-art"><StyleCanvas look={look} showCredits={false}/></div><div className="rc-shared-info"><header className="rc-shared-heading"><p className="rc-eyebrow">{[look.mood,look.occasion].filter(Boolean).join(' · ')}</p>{!look.note&&<h2>{look.title}</h2>}<p className="rc-muted">{look.author}의 스타일</p></header>{look.note&&<p className="rc-note">{look.note}</p>}{look.origin&&<p className="rc-origin">원작: {look.origin.author} · {look.origin.title}</p>}
    <div className="rc-shared-social"><Action active={look.myLike} disabled={busy} onClick={()=>react('like',look.myLike?'':'1')}>{look.myLike?'♥':'♡'} 좋아요 {look.stats?.likes||0}</Action>{onFollow&&<Action active={followed} onClick={()=>onFollow(look.sample?`sample:${look.author}`:look.creatorId)}>{followed?'팔로잉':'팔로우'}</Action>}{onHide&&<Action onClick={()=>onHide(look.id)}>게시물 숨기기</Action>}</div>
    {canRemix(look)?<Btn full icon="pencil" onClick={()=>onRemix(remix(look,owned))}>내 옷으로 리스타일</Btn>:<p className="rc-muted">작성자가 리스타일을 허용하지 않았어요.</p>}
    {look.items.length>0&&<section className="rc-shared-wardrobe"><h3>이 룩의 아이템 <small>{look.items.length}</small></h3><div className="rc-shared-items">{look.items.map(it=><div key={it.id}><img src={it.img} alt={it.name}/><div className="rc-shared-item-copy">{it.brand&&<small>{it.brand}</small>}<span>{it.name}</span></div>{onSaveItem&&<Action onClick={()=>onSaveItem(it)}>재료로 담기</Action>}</div>)}</div>{onSaveItem&&<p className="rc-shared-item-help">담은 아이템은 만들기 재료에서 사용할 수 있어요.</p>}</section>}</div></div>
    {look.comparison&&<section className="rc-section"><h3>어떤 코디가 더 좋아요?</h3><div className="rc-compare">{[['A',look],['B',{...look.comparison,decorations:look.comparison.decorations||[],photo:'',title:look.comparison.title}]].map(([key,x])=><div key={key}><StyleCanvas look={x}/><Action active={look.myVote===key} disabled={busy} onClick={()=>react('vote',key)}>{key} 선택 · {look.stats[key]}표</Action></div>)}</div></section>}
    <ErrorLine error={error}/><footer className="rc-shared-credits"><a href="/asset-credits.html" target="_blank" rel="noreferrer">스티커 출처</a>{(look.decorations||[]).some(x=>x.type==='giphy')&&<a href="https://giphy.com/" target="_blank" rel="noreferrer">Powered by GIPHY</a>}</footer>
  </div>;
}

export function StyleExperience({ ctx }) {
  const [section,setSection]=useState('발견'),[looks,setLooks]=useState([]),[feed,setFeed]=useState([]),[sampleReactions,setSampleReactions]=useState([]),[state,setState]=useState(EMPTY),[loading,setLoading]=useState(true),[error,setError]=useState(''),[editor,setEditor]=useState(()=>window.RC_PENDING_STYLE||null),[sharing,setSharing]=useState(null),[detail,setDetail]=useState(()=>SAMPLE_LOOKS.find(x=>x.id===new URLSearchParams(location.search).get('post'))||null),[message,setMessage]=useState('');
  const [productLook,setProductLook]=useState(null),[feedSharing,setFeedSharing]=useState(null),[feedFilter,setFeedFilter]=useState('all');
  const [profile,setProfile]=useState(null),[managing,setManaging]=useState(null),[voting,setVoting]=useState(null),[draft,setDraft]=useState(readDraft),[detailProfile,setDetailProfile]=useState(null);
  const {data:social}=useSocialProfile(ctx.prefs);
  const me={...identity(ctx.prefs),avatar:social?.avatar||''};
  const scrollRef=useRef(null);
  useEffect(()=>{scrollRef.current?.scrollTo({top:0});},[section,feedFilter]);
  const notify=text=>{setMessage(text);};
  useEffect(()=>{if(!message)return;const t=setTimeout(()=>setMessage(''),3200);return()=>clearTimeout(t);},[message]);
  const load=async()=>{setLoading(true);setError('');try{const [a,b,c,d]=await Promise.all([api('/looks'),api('/feed'),api('/state'),api('/sample-reactions')]);setLooks(a.looks);setFeed(b.looks);setState({...EMPTY,...c});setSampleReactions(d.looks);}catch(e){setError(e.message);}finally{setLoading(false);}};
  useEffect(()=>{load();window.RC_PENDING_STYLE=null;const handler=()=>{setEditor(window.RC_PENDING_STYLE);window.RC_PENDING_STYLE=null;};window.addEventListener('rc-style-open',handler);return()=>window.removeEventListener('rc-style-open',handler);},[]);
  useEffect(()=>{const update=()=>api('/state').then(x=>setState({...EMPTY,...x})).catch(e=>setError(e.message));window.addEventListener('rc-style-material-update',update);return()=>window.removeEventListener('rc-style-material-update',update);},[]);
  useEffect(()=>{const refresh=()=>Promise.all([api('/feed'),api('/looks'),api('/state')]).then(([a,b,c])=>{setFeed(a.looks);setLooks(b.looks);setState({...EMPTY,...c});}).catch(e=>setError(e.message));window.addEventListener('rc-social-update',refresh);return()=>window.removeEventListener('rc-social-update',refresh);},[]);
  const save=async (look,{editing=false}={})=>{const next=await api(`/looks/${look.id}`,{method:'PUT',body:JSON.stringify({...look,privacy:look.privacy||'public',author:me.author})});socialChanged();setLooks(list=>[next,...list.filter(x=>x.id!==next.id)]);const f=await api('/feed').catch(()=>null);if(f)setFeed(f.looks);setSection('내 스타일');notify(editing?'수정했어요':next.privacy==='public'?'피드에 게시했어요':'공개 범위를 저장했어요');return next;};
  const commit=async next=>{const persisted=await api('/state',{method:'PUT',body:JSON.stringify(next)});setState({...EMPTY,...persisted});socialChanged();return persisted;};
  const bookmark=async look=>{const exists=state.collections.some(x=>x.type==='look'&&x.look.id===look.id);try{await commit({...state,collections:exists?state.collections.filter(x=>!(x.type==='look'&&x.look.id===look.id)):[{id:uid(),type:'look',look},...state.collections]});notify(exists?'피드 저장을 취소했어요':'저장했어요');}catch(e){setError(e.message);}};
  const saveItem=async (item,{quiet=false}={})=>{if(state.collections.some(x=>x.type==='item'&&x.item.id===item.id)){notify('이미 만들기 재료에 담은 아이템이에요');return;}try{await commit({...state,collections:[{id:uid(),type:'item',item:{...item,kind:'inspiration'}},...state.collections]});if(!quiet)notify('만들기 재료에 담았어요');}catch(e){setError(e.message);throw e;}};
  const follow=async id=>{try{await commit({...state,follows:state.follows.includes(id)?state.follows.filter(x=>x!==id):[...state.follows,id]});}catch(e){setError(e.message);}};
  const create=look=>{setEditor(look);setDetail(null);setDetailProfile(null);};
  const closeDetail=()=>{setDetail(null);if(detailProfile)setProfile(detailProfile);setDetailProfile(null);};
  const beginRemix=look=>create(remix(look,ctx.items||[]));
  const deleteLook=async look=>{if(!window.confirm('이 스타일을 삭제할까요? 공유 링크도 종료돼요.'))return;try{await api(`/looks/${look.id}`,{method:'DELETE'});setLooks(list=>list.filter(x=>x.id!==look.id));setFeed(list=>list.filter(x=>x.id!==look.id));socialChanged();notify('스타일을 삭제했어요');}catch(e){setError(e.message);}};
  const likePost=async look=>{try{await api(look.sample?`/samples/${look.id}/reaction`:`/shared/${look.share}/reaction`,{method:'POST',body:JSON.stringify({kind:'like',value:look.myLike?'':'1'})});if(look.sample){setSampleReactions((await api('/sample-reactions')).looks);}else{const updated=await api(`/shared/${look.share}`);setFeed(list=>list.map(x=>x.id===look.id?{...x,myLike:updated.myLike,stats:updated.stats}:x));}socialChanged();}catch(e){setError(e.message);}};
  const openLook=look=>setDetail(look);
  const allFeed=[...SAMPLE_LOOKS.map(x=>({...x,...sampleReactions.find(r=>r.id===x.id)})),...feed];
  const followId=look=>look.sample?`sample:${look.author}`:look.creatorId;

  const visibleFeed=allFeed.filter(x=>!state.hidden.includes(x.id)&&(feedFilter==='all'||state.follows.includes(followId(x))));
  useEffect(()=>{if(section==='발견')Promise.all([api('/feed'),api('/state')]).then(([data,current])=>{setFeed(data.looks);setState({...EMPTY,...current});}).catch(e=>setError(e.message));},[section,feedFilter]);
  const library=looks;
  const savedLooks=state.collections.filter(x=>x.type==='look');

  const discardDraft=()=>{clearDraft();setDraft(null);setEditor(null);notify('작업을 폐기했어요');};
  return <div ref={scrollRef} className={`rc-experience rc-feed ${section==='발견'?'rc-feed-social':'rc-feed-library'} ${!loading&&((section==='영감'&&!savedLooks.length)||(section==='내 스타일'&&!library.length)||(section==='발견'&&!visibleFeed.length))?'rc-saved-empty':''}`}><div className="rc-feed-layout">
    <div className="rc-page-head"><div className="rc-feed-heading">{section!=='발견'&&<button className="rc-feed-head-icon" aria-label="피드로 돌아가기" onClick={()=>setSection('발견')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14 5-7 7 7 7"/></svg></button>}<h1>{section==='발견'?'피드':({발견:'피드','내 스타일':'내 피드',영감:'저장한 피드',알림:'알림'})[section]}</h1></div><div className="rc-feed-head-actions"><NotificationMenu onNavigate={()=>setSection('알림')}/><button className="rc-feed-head-icon" aria-label="피드 만들기" title="피드 만들기" onClick={()=>create(newLook())}><Icon name="plus" size={25}/></button><button className="rc-feed-head-icon" aria-label="내 피드" title="내 피드" aria-pressed={section==='내 스타일'} onClick={()=>setSection(section==='내 스타일'?'발견':'내 스타일')}><Icon name="layers" size={24}/></button></div></div>

    <div className="rc-feed-main"><ErrorLine error={error}/>{error&&<Action onClick={load}>다시 불러오기</Action>}
    {section==='내 스타일'&&<>{draft&&<div className="rc-draft-resume"><p>작성 중인 스타일이 있어요.</p><div><Action onClick={()=>create(draft)}>이어 만들기 →</Action><Action onClick={discardDraft}>폐기</Action></div></div>}
      <div className="rc-between rc-section-title"><h2>내가 만든 피드 <small>{library.length}</small></h2><div className="rc-personal-shortcuts"><button className="rc-saved-shortcut" aria-label="내 공개 프로필 보기" title="내 공개 프로필" onClick={()=>setProfile({own:true,...me})}><Icon name="user" size={20}/></button><button className="rc-saved-shortcut" aria-label="저장한 피드 보기" onClick={()=>setSection('영감')}><Icon name="bookmark" size={20}/></button></div></div>
      {loading?<p className="rc-muted">내 피드를 불러오는 중…</p>:library.length?<div className="rc-look-grid">{library.map(look=><MyStyleCard key={look.id} look={look} onOpen={()=>create(look)} onShare={()=>setSharing(look)} onMore={()=>setManaging(look)}/>)}</div>:<div className="rc-saved-empty-state"><EmptyState icon="layers" title="아직 만든 피드가 없어요" wide={window.innerWidth>=760} padTop={false} hintHidden action={<Btn full size="lg" icon="plus" onClick={()=>create(newLook())}>피드 만들기</Btn>}>내 옷과 이미지로 나만의 피드를 만들어 보세요.</EmptyState></div>}

    </>}
    {(section==='발견')&&<>

      <nav className="rc-gallery-nav" aria-label="피드 탐색"><div>{[['all','전체'],['following','팔로잉']].map(([id,label])=><button key={id} aria-pressed={feedFilter===id} onClick={()=>setFeedFilter(id)}>{label}</button>)}</div><p>저장하고, 내 옷으로 리스타일</p></nav>
      <div className="rc-stream">{visibleFeed.map(look=><article className="rc-post" key={look.id}>
        <header className="rc-post-head"><button className="rc-post-person" aria-label={`${look.author} 프로필 보기`} onClick={()=>setProfile({author:look.author,avatar:look.avatar,sample:look.sample,creatorId:look.creatorId,own:!look.sample&&look.creatorId===social?.creatorId})}><span className="rc-post-avatar">{look.avatar?<img src={look.avatar} alt=""/>:<Icon name="user" size={20}/>}</span><span className="rc-post-identity"><span>{look.author}</span><PostDate value={look.createdAt}/></span></button><button type="button" className="rc-post-follow" aria-pressed={state.follows.includes(look.sample?`sample:${look.author}`:look.creatorId)} aria-label={`${look.author} ${state.follows.includes(look.sample?`sample:${look.author}`:look.creatorId)?'언팔로우':'팔로우'}`} title={state.follows.includes(look.sample?`sample:${look.author}`:look.creatorId)?'팔로우 해제':'팔로우'} onClick={()=>follow(look.sample?`sample:${look.author}`:look.creatorId)}>{state.follows.includes(look.sample?`sample:${look.author}`:look.creatorId)?'팔로잉':'팔로우'}</button></header>
        <div className="rc-post-art" onDoubleClick={()=>likePost(look)}><StyleCanvas look={look} showCredits={false}/><button className="rc-post-expand" aria-label={`${look.title} 크게 보기`} onClick={()=>openLook(look)}><Icon name="expand" size={18}/><span>크게 보기</span></button></div>
        <PostActions look={look} onShare={()=>setFeedSharing(look)} onItems={()=>setProductLook(look)} onLike={()=>likePost(look)} onBookmark={()=>bookmark(look)} saved={state.collections.some(x=>x.type==='look'&&x.look.id===look.id)} onCreate={canRemix(look)?()=>beginRemix(look):undefined}/>
        <div className="rc-post-caption">{(look.stats?.likes||0)>0&&<b>좋아요 {look.stats?.likes||0}개</b>}<p><strong>{look.author}</strong> {look.note||look.title}</p></div>

      </article>)}</div>{visibleFeed.length===0&&<div className="rc-saved-empty-state"><EmptyState icon="feed" title={feedFilter==='following'?'팔로잉한 사람의 피드가 없어요':'아직 공개된 피드가 없어요'} wide={window.innerWidth>=760} padTop={false} hintHidden action={feedFilter==='following'?<Btn full size="lg" onClick={()=>setFeedFilter('all')}>전체 피드 둘러보기</Btn>:<Btn full size="lg" icon="plus" onClick={()=>create(newLook())}>피드 만들기</Btn>}>{feedFilter==='following'?'전체 피드에서 취향이 맞는 사람을 찾아보세요.':'첫 피드를 만들어 공유해 보세요.'}</EmptyState></div>}</>}
    {section==='발견'&&visibleFeed.length>0&&<footer className="rc-feed-end">{visibleFeed.some(look=>look.origin)&&<div className="rc-feed-origins">{visibleFeed.filter(look=>look.origin).map(look=><button key={look.id} onClick={()=>openLook(look)} aria-label={`${look.author}의 ${look.title} 출처 보기`}>{look.author} · ↻ {look.origin.author}의 스타일을 리스타일</button>)}</div>}{visibleFeed.some(look=>(look.decorations||[]).some(d=>d.img?.startsWith('/studio-assets/openmoji-')||d.type==='giphy'))&&<div className="rc-feed-credits">{visibleFeed.some(look=>(look.decorations||[]).some(d=>d.img?.startsWith('/studio-assets/openmoji-')))&&<a href="/asset-credits.html" target="_blank" rel="noreferrer" aria-label="OpenMoji 스티커 출처 및 라이선스">스티커 출처</a>}{visibleFeed.some(look=>(look.decorations||[]).some(d=>d.type==='giphy'))&&<a href="https://giphy.com/" target="_blank" rel="noreferrer">Powered by GIPHY</a>}</div>}<p>여기까지 둘러봤어요</p><button onClick={()=>scrollRef.current?.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}>맨 위로 <span aria-hidden="true">↑</span></button></footer>}

    {section==='알림'&&<NotificationPage onOpen={setDetail} onProfile={setProfile}/>}
    {section==='영감'&&<>{loading?<p className="rc-muted">저장한 피드를 불러오는 중…</p>:savedLooks.length?<><div className="rc-between rc-section-title"><h2>저장한 피드</h2><Action onClick={()=>setSection('내 스타일')}>← 내 피드</Action></div><div className="rc-look-grid">{savedLooks.map(x=>{const look=allFeed.find(post=>post.id===x.look.id)||x.look;return <LookCard key={x.id} look={look} onShare={()=>setFeedSharing(look)} onItems={()=>setProductLook(look)} onOpen={()=>openLook(look)} onLike={()=>likePost(look)} onCreate={canRemix(look)?()=>beginRemix(look):undefined} saved onBookmark={()=>bookmark(look)}/>;})}</div></>:<div className="rc-saved-empty-state"><EmptyState icon="bookmark" title="아직 저장한 피드가 없어요" wide={window.innerWidth>=760} padTop={false} hintHidden action={<Btn full size="lg" onClick={()=>setSection('발견')}>피드 둘러보기</Btn>}>마음에 드는 피드의 저장 버튼을 눌러보세요.</EmptyState></div>}</>}
    </div></div>
    {managing&&<StudioSheet open centered title="스타일 관리" desktopMaxW={420} zIndex={130} onClose={()=>setManaging(null)}><div className="rc-style-manage"><button className="lb-navitem" onClick={()=>{create({...safeDraft(managing),id:uid(),title:`${managing.title} · 새 버전`,createdAt:new Date().toISOString()});setManaging(null);}}><Icon name="copy" size={19}/>복제해서 만들기</button><button className="lb-navitem rc-manage-delete" onClick={()=>{deleteLook(managing);setManaging(null);}}><Icon name="trash" size={19}/>삭제</button>{(managing.decorations||[]).some(x=>x.img?.startsWith('/studio-assets/openmoji-'))&&<p className="rc-manage-credits">스티커: <a href="https://openmoji.org/" target="_blank" rel="noreferrer">OpenMoji</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></p>}{(managing.decorations||[]).some(x=>x.type==='giphy')&&<p className="rc-manage-credits"><a href="https://giphy.com/" target="_blank" rel="noreferrer">Powered by GIPHY</a></p>}</div></StudioSheet>}
    {profile&&<StudioSheet open centered desktopMaxW={780} zIndex={130} onClose={()=>setProfile(null)}><CreatorProfile person={profile} owned={ctx.items||[]} onVisibilityChange={ctx.setItemVisibility} onClose={()=>setProfile(null)} onSaveItem={saveItem} onEdit={look=>{setProfile(null);create(looks.find(x=>x.id===look.id)||look);}} onOpen={look=>{setDetailProfile(profile);setProfile(null);openLook(look);}}/></StudioSheet>}
    {productLook&&<ProductSheet look={productLook} collections={state.collections} onSaveItem={saveItem} onClose={()=>setProductLook(null)}/>}
    {editor&&<Editor key={editor.id} initial={editor} editingExisting={looks.some(x=>x.id===editor.id)} owned={ctx.items||[]} collections={state.collections} onClose={()=>{setEditor(null);setDraft(readDraft());}} onSave={async look=>{const existing=looks.some(x=>x.id===look.id);const next=await save({...look,privacy:look.privacy||'public'},{editing:existing});if(!existing)setDraft(null);return next;}}/>}
    {feedSharing&&<ShareSheet key={feedSharing.id} look={feedSharing} onSave={looks.some(x=>x.id===feedSharing.id)?next=>save({...looks.find(x=>x.id===next.id),privacy:next.privacy}):undefined} onClose={()=>setFeedSharing(null)}/>}
    {sharing&&<ShareSheet key={sharing.id} look={sharing} onVote={()=>{setVoting(sharing);setSharing(null);}} onSave={save} onClose={()=>setSharing(null)}/>}
    {voting&&<FriendVote looks={looks} initial={voting} onClose={()=>setVoting(null)}/>}
    {detail&&<StudioSheet open centered desktopMaxW={960} zIndex={140} onClose={closeDetail}><div className="rc-detail"><div className="rc-dialog-head"><h2>스타일 구경하기</h2><button aria-label="스타일 상세 닫기" onClick={closeDetail}><Icon name="x" size={20}/></button></div><SharedContent token={detail.share} initialLook={detail} owned={ctx.items||[]} onRemix={create} onSaveItem={saveItem} onFollow={follow} followed={state.follows.includes(followId(detail))} onHide={async id=>{try{await commit({...state,hidden:[...state.hidden,id]});setDetail(null);notify('이 게시물을 숨겼어요');}catch(e){setError(e.message);}}}/></div></StudioSheet>}
    {message&&<div className="rc-toast" role="status">{message}</div>}
  </div>;
}

export function SharedStylePage() {
  const token=new URLSearchParams(location.search).get('style');
  const [message,setMessage]=useState('');
  const start=look=>{writeDraft(safeDraft(look));location.href='/?screen=feed&ws=empty&saved=empty&resume=1';};
  return <div className="rc-shared-page"><header><Wordmark size={24}/><a href="/?screen=feed&ws=empty&saved=empty">내 스타일 만들기</a></header><p className="rc-local-note">로컬 공유 체험 · 로그인 없이 스타일을 구경할 수 있어요</p><SharedContent token={token} onRemix={start} onSaveItem={async item=>{try{const state=await api('/state');if(!state.collections.some(x=>x.type==='item'&&x.item.id===item.id)){await api('/state',{method:'PUT',body:JSON.stringify({...state,collections:[{id:uid(),type:'item',item:{...item,kind:'inspiration'}},...state.collections]})});}setMessage('저장했어요');}catch(e){setMessage(e.message);}}}/>{message&&<p role="status">{message}</p>}</div>;
}

window.LookbookScreen=window.RC_LEGACY_LOOKBOOK;
window.FeedScreen=StyleExperience;
window.StyleCustomizeButton=function StyleCustomizeButton({ outfit, items, ctx }) {return <Btn variant="soft" onClick={()=>{window.RC_PENDING_STYLE=outfitLook(outfit,items.map(it=>({...thumb(it),kind:ctx.items.some(x=>x.id===it.id)?'owned':'considering'})));ctx.go('feed');window.dispatchEvent(new Event('rc-style-open'));}}>이 코디로 내 스타일 만들기</Btn>;};
if(new URLSearchParams(location.search).get('resume')==='1'&&readDraft())window.RC_PENDING_STYLE=readDraft();
