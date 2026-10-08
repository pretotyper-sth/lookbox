import React, {useEffect, useState} from 'react';
import {api} from './model.js';
import {StyleCanvas} from './collage-canvas.jsx';
import './friend-vote.css';
const {Btn,Icon,Wordmark}=window;
import {StudioSheet} from './social.jsx';
const urlFor=token=>`${location.origin}/?vote=${token}`;

function VoteExpiry({poll,now=Date.now()}) {
 const expires=new Date(poll.expiresAt);
 if(Number.isNaN(expires.getTime()))return null;
 const days=Math.ceil((expires.getTime()-now)/86400000);
 const date=expires.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
 return <span className="rc-vote-expiry"><span>{days<=0?'종료됨':days===1?'24시간 내 종료':`${days}일 남음`}</span><time dateTime={poll.expiresAt} title={`${date} (한국 시간)`}>{date} 종료</time></span>;
}

function VoteLink({poll}) {
 const [message,setMessage]=useState('');
 const send=async()=>{try{await navigator.clipboard.writeText(urlFor(poll.token));setMessage('링크를 복사했어요');}catch{setMessage('아래 링크를 복사해 주세요');}};
 return <div className="rc-vote-link"><Btn full onClick={send}>{message||'투표 링크 복사'}</Btn><a href={urlFor(poll.token)} target="_blank" rel="noreferrer">투표 화면 · 결과 보기 ↗</a><input aria-label="투표 링크" readOnly value={urlFor(poll.token)} onFocus={e=>e.target.select()}/></div>;
}

function VoteCredits({looks}) {
 const layers=looks.flatMap(x=>x.decorations||[]),moji=layers.some(x=>x.img?.startsWith('/studio-assets/openmoji-')),gif=layers.some(x=>x.type==='giphy');
 return moji||gif?<details className="rc-vote-note"><summary>스티커·GIF 출처</summary>{moji&&<p><a href="https://openmoji.org/" target="_blank" rel="noreferrer">OpenMoji</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></p>}{gif&&<a href="https://giphy.com/" target="_blank" rel="noreferrer">Powered by GIPHY</a>}</details>:null;
}

export function FriendVote({looks,initial,onClose}) {
 const [selected,setSelected]=useState(initial?[initial.id]:[]),[poll,setPoll]=useState(null),[recent,setRecent]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
 const activeRecent=recent.filter(x=>new Date(x.expiresAt).getTime()>now);
 useEffect(()=>{if(poll&&new Date(poll.expiresAt).getTime()<=now){setPoll(null);setError('기간이 지나 종료된 투표예요.');}},[poll,now]);
 useEffect(()=>{api('/polls').then(x=>setRecent(x.polls)).catch(e=>setError(e.message));},[]);
 const toggle=id=>{setError('');setSelected(xs=>xs.includes(id)?xs.filter(x=>x!==id):xs.length<4?[...xs,id]:xs);};
 const create=async()=>{setBusy(true);setError('');try{const next=await api('/polls',{method:'POST',body:JSON.stringify({lookIds:selected})});setPoll(next);setRecent(xs=>[next,...xs]);}catch(e){setError(e.message);}finally{setBusy(false);}};
 const close=async()=>{setBusy(true);try{await api(`/polls/${poll.token}`,{method:'DELETE'});setRecent(xs=>xs.filter(x=>x.token!==poll.token));setPoll(null);}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <StudioSheet open centered title="코디 투표" description={poll?undefined:<>코디 2~4개를 골라 링크로 보내세요.<br/>투표는 만든 날부터 7일 후 사라져요.</>} desktopMaxW={640} zIndex={155} onClose={onClose}><section className="rc-vote-create" role="dialog" aria-label="친구에게 코디 투표">{poll?<><h3>{poll.question}</h3><VoteExpiry poll={poll} now={now}/><div className="rc-vote-preview">{poll.looks.map((look,i)=><div key={i}><StyleCanvas look={look} showCredits={false}/><span>{String.fromCharCode(65+i)} · {poll.counts[i]}표</span></div>)}</div><VoteLink poll={poll}/><VoteCredits looks={poll.looks}/><div className="rc-vote-secondary"><button onClick={()=>{setPoll(null);setError('');}}>다른 투표 만들기</button><button disabled={busy} onClick={close}>이 투표 종료</button></div></>:<><div className="rc-vote-picker">{looks.map(look=>{const index=selected.indexOf(look.id);return <button key={look.id} aria-label={`${look.title} 투표 후보`} aria-pressed={index>=0} disabled={index<0&&selected.length>=4} onClick={()=>toggle(look.id)}><StyleCanvas look={look} showCredits={false}/><span className="rc-vote-letter">{index>=0?String.fromCharCode(65+index):'+'}</span><span className="rc-vote-title">{look.title}</span></button>;})}</div>{looks.length<2&&<p className="rc-muted">스타일을 두 개 이상 저장하면 투표를 만들 수 있어요.</p>}<Btn full disabled={busy||selected.length<2} onClick={create}>{busy?'만드는 중…':`투표 링크 만들기${selected.length?` · ${selected.length}개`:''}`}</Btn>{activeRecent.length>0&&<section className="rc-vote-history" aria-label="내가 만든 투표"><header><h3>진행 중인 투표 <small>{activeRecent.length}</small></h3><p>만든 날부터 7일 후 자동 종료</p></header>{activeRecent.map(x=><button className="rc-vote-history-card" key={x.token} aria-label={`${x.question} 투표 결과 보기`} onClick={async()=>{setError('');try{setPoll(await api(`/polls/${x.token}`));}catch(e){setError(e.message);}}}><span className="rc-vote-history-images">{x.looks.slice(0,2).map((look,i)=><StyleCanvas key={i} look={look} showCredits={false}/>)}</span><span className="rc-vote-history-copy"><strong>{x.question}</strong><small>{x.looks.length}개 코디 · {x.total}표</small><VoteExpiry poll={x} now={now}/></span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>)}</section>}</>}{error&&<p className="rc-error" role="alert">{error}</p>}</section></StudioSheet>;
}

export function SharedVotePage() {
 const token=new URLSearchParams(location.search).get('vote');
 const [poll,setPoll]=useState(null),[chosen,setChosen]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{api(`/polls/${token}`).then(x=>{setPoll(x);setChosen(x.myVote);}).catch(e=>setError(e.message));},[token]);
 const vote=async()=>{setBusy(true);setError('');try{setPoll(await api(`/polls/${token}/vote`,{method:'POST',body:JSON.stringify({choice:chosen})}));}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <div className="rc-vote-page"><header><Wordmark size={22}/><a href="/?screen=feed&ws=empty&saved=empty">피드 보기</a></header>{poll?<><p className="rc-vote-kicker">PICK MY FIT</p><h1>{poll.question}</h1><VoteExpiry poll={poll}/><p className="rc-muted">{poll.myVote===null?'마음에 드는 코디를 골라 주세요.':'투표했어요. 다른 코디로 바꿔도 돼요.'}</p><div className="rc-vote-choices">{poll.looks.map((look,i)=><button key={i} aria-label={`${String.fromCharCode(65+i)} ${look.title}`} aria-pressed={chosen===i} onClick={()=>setChosen(i)}><StyleCanvas look={look} showCredits={false}/><span className="rc-vote-choice-caption"><b>{String.fromCharCode(65+i)}</b><span>{look.title}</span>{chosen===i&&<Icon name="check" size={17}/>}</span>{poll.myVote!==null&&<span className="rc-vote-result"><span style={{width:`${poll.total?poll.counts[i]/poll.total*100:0}%`}}/><b>{poll.counts[i]}표 · {poll.total?Math.round(poll.counts[i]/poll.total*100):0}%</b></span>}</button>)}</div><Btn full disabled={chosen===null||busy||chosen===poll.myVote} onClick={vote}>{busy?'투표하는 중…':poll.myVote===null?'이 코디에 한 표':'선택 바꾸기'}</Btn><p className="rc-vote-note" role="status">{poll.total}명 참여 · 이 브라우저에서 한 표</p><button className="rc-vote-refresh" disabled={busy} onClick={async()=>{try{setPoll(await api(`/polls/${token}`));}catch(e){setError(e.message);}}}>결과 새로고침</button><VoteCredits looks={poll.looks}/></>:!error&&<p>투표를 불러오는 중…</p>}{error&&<p className="rc-error" role="alert">{error}</p>}</div>;
}
