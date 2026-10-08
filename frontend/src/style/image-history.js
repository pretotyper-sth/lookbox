const DB='rc-style-images';
function openHistory() {
 return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore('history');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
}
export async function readImageHistory() {
 const db=await openHistory();
 return new Promise((resolve,reject)=>{const tx=db.transaction('history','readonly'),req=tx.objectStore('history').get('images');tx.oncomplete=()=>{db.close();resolve(req.result||[]);};tx.onerror=()=>{db.close();reject(tx.error);};});
}
let pending=Promise.resolve();
export function rememberImages(images) {
 const save=async()=>{
  const previous=await readImageHistory();
  const combined=[...images.map(({img,label,ratio,source})=>({type:'image',img,label,ratio,source})),...previous];
  const seen=new Set();
  const next=combined.filter(x=>{if(seen.has(x.img))return false;seen.add(x.img);return true;}).slice(0,60);
  const db=await openHistory();
  await new Promise((resolve,reject)=>{const tx=db.transaction('history','readwrite');tx.objectStore('history').put(next,'images');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error);};});
  return next;
 };
 pending=pending.catch(()=>{}).then(save);
 return pending;
}
