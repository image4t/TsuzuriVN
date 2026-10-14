import {parseProject,type Project} from './model';
import type {BulkDraft} from './bulk';
import {encodeProject,hydrateProject,cacheAsset,cachedAsset,assetUrl,isAssetRef,type AssetRecord} from './assets';
export type SavedScenario={id:string;project:Project;createdAt:number;updatedAt:number;coverUrl?:string;migrationWarning?:boolean};
const persisted=new Set<string>();
let pruneTimer:ReturnType<typeof setTimeout>|undefined;
function assetIds(project:Project):Set<string>{const ids=new Set<string>();for(const s of project.scenes){if(s.image?.startsWith('asset:'))ids.add(s.image.slice(6));for(const v of s.voices??[])if(v.data.startsWith('asset:'))ids.add(v.data.slice(6));if(s.bgm?.mode==='track'&&s.bgm.track.data.startsWith('asset:'))ids.add(s.bgm.track.data.slice(6));}return ids;}
function schedulePrune(){if(pruneTimer)clearTimeout(pruneTimer);pruneTimer=setTimeout(()=>{void pruneAssets().catch(()=>{});},2000);}
export async function pruneAssets():Promise<void>{const db=await open();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['scenarios','assets'],'readwrite');const r=tx.objectStore('scenarios').getAll();r.onsuccess=()=>{const used=new Set<string>();for(const record of r.result as SavedScenario[])for(const id of assetIds(record.project))used.add(id);const cursor=tx.objectStore('assets').openKeyCursor();cursor.onsuccess=()=>{const current=cursor.result;if(!current)return;const id=String(current.primaryKey);if(!used.has(id)){tx.objectStore('assets').delete(id);persisted.delete(id);}current.continue();};};tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};});}
export function newScenario(project:Project):SavedScenario {const now=Date.now();return {id:crypto.randomUUID(),project,createdAt:now,updatedAt:now};}
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
 const r=indexedDB.open('tsuzuri-studio',4);
 r.onupgradeneeded=event=>{
  persisted.clear();
  const db=r.result;const store=db.objectStoreNames.contains('scenarios')?r.transaction!.objectStore('scenarios'):db.createObjectStore('scenarios',{keyPath:'id'});
  if(!db.objectStoreNames.contains('drafts'))db.createObjectStore('drafts');
  if(!db.objectStoreNames.contains('assets'))db.createObjectStore('assets',{keyPath:'id'});
  if(event.oldVersion<2&&db.objectStoreNames.contains('projects')){
   const old=r.transaction!.objectStore('projects');const request=old.get('current');
   request.onsuccess=()=>{if(request.result){store.put(newScenario(request.result));old.delete('current');}};
  }
 };
 r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>reject(r.error);
 r.onblocked=()=>reject(new Error('別のタブを閉じてから再読み込みしてください。'));
});}
export async function listScenarios():Promise<SavedScenario[]>{const db=await open();const list=await new Promise<SavedScenario[]>((resolve,reject)=>{
 const tx=db.transaction('scenarios','readonly');const r=tx.objectStore('scenarios').getAll();
 tx.oncomplete=()=>{db.close();resolve((r.result as SavedScenario[]).sort((a,b)=>b.updatedAt-a.updatedAt));};
 tx.onabort=()=>{db.close();reject(tx.error);};
});const result:SavedScenario[]=[];for(const original of list){let record=original;const hasEmbedded=record.project.scenes.some(s=>s.image?.startsWith('data:')||s.voices?.some(v=>v.data.startsWith('data:'))||s.bgm?.mode==='track'&&s.bgm.track.data.startsWith('data:'));if(hasEmbedded){try{const normalized={...record,project:parseProject(record.project,true)};const encoded=await encodeProject(normalized.project);await saveScenario({...normalized,project:encoded.project},encoded.assets);record={...normalized,project:encoded.project};}catch{record={...original,migrationWarning:true};}}const cover=record.project.scenes.find(s=>s.image)?.image;result.push({...record,coverUrl:cover?(isAssetRef(cover)?assetUrl(await loadAsset(cover.slice(6))):cover):undefined});}return result;}
async function write(action:(store:IDBObjectStore)=>void):Promise<void>{const db=await open();return new Promise((resolve,reject)=>{
 const tx=db.transaction(['scenarios','drafts','assets'],'readwrite');
 tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};
 try{action(tx.objectStore('scenarios'));}catch(error){tx.abort();db.close();reject(error);}
});}
function saveAssets(store:IDBObjectStore,assets:AssetRecord[]){const assetStore=store.transaction.objectStore('assets');for(const record of assets){if(persisted.has(record.id))continue;const r=assetStore.get(record.id);r.onsuccess=()=>{if(!r.result)try{assetStore.put(record);}catch{store.transaction.abort();}};}}
export async function saveScenario(record:SavedScenario,additional:AssetRecord[]=[]):Promise<void>{const encoded=await encodeProject(record.project);const assets=[...encoded.assets,...additional];await write(store=>{saveAssets(store,assets);store.put({id:record.id,project:encoded.project,createdAt:record.createdAt,updatedAt:record.updatedAt});});assets.forEach(a=>persisted.add(a.id));}
export async function deleteScenario(id:string):Promise<void>{await write(store=>{store.delete(id);store.transaction.objectStore('drafts').delete(id);});await pruneAssets();}
export async function saveProject(id:string,project:Project,clearDraft=false):Promise<void>{const encoded=await encodeProject(project);let resourcesChanged=false;await write(store=>{
 saveAssets(store,encoded.assets);const request=store.get(id);request.onsuccess=()=>{if(!request.result){store.transaction.abort();return;}const old=assetIds(request.result.project);const next=assetIds(encoded.project);resourcesChanged=old.size!==next.size||[...old].some(id=>!next.has(id));try{store.put({...request.result,project:encoded.project,updatedAt:Date.now()});if(clearDraft)store.transaction.objectStore('drafts').delete(id);}catch{store.transaction.abort();}};
});encoded.assets.forEach(a=>persisted.add(a.id));if(resourcesChanged)schedulePrune();}
export async function loadAsset(id:string):Promise<AssetRecord>{const cached=cachedAsset(id);if(cached)return cached;const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('assets','readonly');const r=tx.objectStore('assets').get(id);tx.oncomplete=()=>{db.close();if(!r.result){reject(new Error('素材データが見つかりません。'));return;}cacheAsset(r.result);persisted.add(id);resolve(r.result);};tx.onabort=()=>{db.close();reject(tx.error);};});}
export async function loadScenario(id:string):Promise<SavedScenario>{const db=await open();const record=await new Promise<SavedScenario>((resolve,reject)=>{const tx=db.transaction('scenarios','readonly');const r=tx.objectStore('scenarios').get(id);tx.oncomplete=()=>{db.close();r.result?resolve(r.result):reject(new Error('シナリオが見つかりません。'));};tx.onabort=()=>{db.close();reject(tx.error);};});return {...record,project:await hydrateProject(parseProject(record.project,true),loadAsset)};}
export async function loadDraft(id:string):Promise<BulkDraft|undefined>{const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readonly');const r=tx.objectStore('drafts').get(id);tx.oncomplete=()=>{db.close();resolve(r.result);};tx.onabort=()=>{db.close();reject(tx.error);};});}
export async function saveDraft(id:string,draft:BulkDraft):Promise<void>{await write(store=>{store.transaction.objectStore('drafts').put(draft,id);});}
