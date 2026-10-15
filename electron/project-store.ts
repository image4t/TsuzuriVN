import * as fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import type {BinaryAsset,DesktopRecord,DesktopSettings} from '../shared/desktop.js';
import {hash,formats,mimes,ID,PROJECT_ID,validateDocument,validateProject,validateDraft,type Document,type AssetInfo} from './validation.js';

const clone=<T>(v:T):T=>structuredClone(v);
export async function atomicJSON(file:string,value:unknown,validate:(value:any)=>void=()=>{},beforeReplace?:()=>void){
 const text=JSON.stringify(value,null,2);validate(JSON.parse(text));
 await fs.mkdir(path.dirname(file),{recursive:true});
 const temporary=`${file}.${randomUUID()}.tmp`;
 try{
  const handle=await fs.open(temporary,'wx');try{await handle.writeFile(text,'utf8');await handle.sync();}finally{await handle.close();}
  validate(JSON.parse(await fs.readFile(temporary,'utf8')));beforeReplace?.();await fs.rename(temporary,file);
 }finally{await fs.unlink(temporary).catch(()=>{});}
}
export class ProjectStore{
 private folders=new Map<string,string>();private queues=new Map<string,Promise<unknown>>();private documents=new Map<string,Document>();private verified=new Map<string,string>();
 private settingsFile:string;private config:DesktopSettings;
 constructor(userData:string,private defaultRoot:string,private beforeReplace?:()=>void,private legacyRoot?:string){this.settingsFile=path.join(userData,'settings.json');this.config={root:defaultRoot,defaultRoot,rootMode:'default',theme:'light',recent:[]};}
 private queue<T>(key:string,action:()=>Promise<T>):Promise<T>{const result=(this.queues.get(key)??Promise.resolve()).catch(()=>{}).then(action);this.queues.set(key,result);return result;}
 async init(){
  try{const config=JSON.parse(await fs.readFile(this.settingsFile,'utf8'));if(typeof config.root!=='string'||!path.isAbsolute(config.root)||!Array.isArray(config.recent))throw new Error('設定ファイルが壊れています。');const useDefault=config.rootMode==='default'||!config.rootMode&&!!this.legacyRoot&&path.resolve(config.root).toLowerCase()===path.resolve(this.legacyRoot).toLowerCase();this.config={...this.config,...config,defaultRoot:this.defaultRoot,root:useDefault?this.defaultRoot:config.root,rootMode:useDefault?'default':'custom'};}
  catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('アプリ設定を読み込めません。userDataのsettings.jsonを確認してください。');}
  try{await fs.mkdir(this.config.root,{recursive:true});}catch{this.config.storageWarning='保存先を作成できません。アクセス権を確認するか、設定から別のフォルダを選んでください。';}return this.settings();
 }
 settings(){return clone(this.config);}
 async updateSettings(change:Partial<DesktopSettings>){return this.queue('settings',async()=>{const next={...this.config,...change};if(change.root){await fs.mkdir(next.root,{recursive:true});const probe=path.join(next.root,`.tsuzuri-write-${randomUUID()}.tmp`);try{const file=await fs.open(probe,'wx');await file.close();}finally{await fs.unlink(probe).catch(()=>{});}delete next.storageWarning;}await atomicJSON(this.settingsFile,next);this.config=next;return this.settings();});}
 private folder(id:string){if(!PROJECT_ID.test(id)||!this.folders.has(id))throw new Error('この作品フォルダは開かれていません。');return this.folders.get(id)!;}
 private async document(folder:string):Promise<{doc:Document;warning?:string}>{
  const read=async(file:string)=>{const value=JSON.parse(await fs.readFile(file,'utf8'));validateDocument(value);return value;};
  try{const doc=await read(path.join(folder,'scenario.json'));this.documents.set(folder,doc);return {doc};}
  catch(primary){try{const doc=await read(path.join(folder,'scenario.json.bak'));this.documents.set(folder,doc);return {doc,warning:'scenario.jsonを読めないため、直前の正常なバックアップを開きました。保存すると復旧します。'};}catch{throw new Error(`作品を読み込めません: ${folder}\nscenario.jsonとscenario.json.bakを確認してください。`,{cause:primary});}}
 }
 private record(doc:Document,folder:string,warning?:string):DesktopRecord{return {id:doc.id,project:doc.project,createdAt:doc.createdAt,updatedAt:doc.updatedAt,folder,warning};}
 private async remember(doc:Document,folder:string){this.folders.set(doc.id,folder);return this.queue('settings',async()=>{const next={...this.config,recent:[{id:doc.id,folder,title:doc.project.title},...this.config.recent.filter(r=>r.id!==doc.id)].slice(0,200)};await atomicJSON(this.settingsFile,next);this.config=next;});}
 async open(folder:string){folder=await fs.realpath(folder);const {doc,warning}=await this.document(folder);await this.remember(doc,folder);return this.record(doc,folder,warning);}
 async list(){
  const candidates=new Set(this.config.recent.map(r=>r.folder));
  for(const root of new Set([this.config.root,...(this.legacyRoot?[this.legacyRoot]:[])])){try{for(const entry of await fs.readdir(root,{withFileTypes:true}))if(entry.isDirectory()&&entry.name!=='.trash')candidates.add(path.join(root,entry.name));}catch{/* Keep the settings UI accessible even when the chosen drive is unavailable. */}}
  const result:DesktopRecord[]=[];const ids=new Set<string>();
  for(const folder of candidates){try{const actual=await fs.realpath(folder);const {doc,warning}=await this.document(actual);if(ids.has(doc.id))continue;ids.add(doc.id);this.folders.set(doc.id,actual);result.push(this.record(doc,actual,warning));}catch{/* Missing recent folders stay in settings so disconnected drives can be reattached. */}}
  return result.sort((a,b)=>b.updatedAt-a.updatedAt);
 }
 async load(id:string){await this.queues.get(id)?.catch(()=>{});const folder=this.folder(id);const {doc,warning}=await this.document(folder);let missing=0;for(const a of Object.values(doc.assets)){try{const actual=await this.checkedAssetPath(folder,a.file);if((await fs.stat(actual)).size!==a.size)missing++;}catch{missing++;}}
  await this.remember(doc,folder);return this.record(doc,folder,[warning,missing?`${missing}個の素材が見つからないか、サイズが変わっています。バックアップから復旧するか素材を差し替えてください。`:undefined].filter(Boolean).join('\n')||undefined);
 }
 private async checkedAssetPath(folder:string,file:string){
  const actual=await fs.realpath(path.join(folder,file));const relative=path.relative(folder,actual);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('作品フォルダ外の素材は参照できません。');return actual;
 }
 async asset(id:string,assetId:string){if(!ID.test(assetId))throw new Error('素材IDが不正です。');const folder=this.folder(id);const doc=this.documents.get(folder)??(await this.document(folder)).doc;const asset=doc.assets[assetId];if(!asset)throw new Error('素材が見つかりません。');const file=await this.checkedAssetPath(folder,asset.file);const stat=await fs.stat(file);if(!stat.isFile()||stat.size!==asset.size)throw new Error('素材ファイルのサイズが変わっています。');const token=`${stat.mtimeMs}:${stat.size}`;if(this.verified.get(file)!==token){const digest=createHash('sha256');for await(const chunk of createReadStream(file))digest.update(chunk);if(digest.digest('hex')!==assetId)throw new Error('素材ファイルの内容が変わっています。');this.verified.set(file,token);}return {path:file,type:asset.type};}
 private async putAsset(folder:string,asset:BinaryAsset):Promise<AssetInfo>{
  if(!ID.test(asset.id)||!formats[asset.type]||!(asset.bytes instanceof Uint8Array)||!asset.bytes.length||asset.bytes.length>25*1024*1024||hash(asset.bytes)!==asset.id)throw new Error('素材の形式・容量・ハッシュが不正です。');
  const info={file:`assets/${asset.id}.${formats[asset.type]}`,type:asset.type,size:asset.bytes.length};
  await fs.mkdir(path.join(folder,'assets'),{recursive:true});const target=path.join(folder,info.file);
  try{const existing=await fs.readFile(await this.checkedAssetPath(folder,info.file));if(hash(existing)===asset.id)return info;throw new Error('保存済み素材の内容が変わっています。');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const temporary=`${target}.${randomUUID()}.tmp`;try{const file=await fs.open(temporary,'wx');try{await file.writeFile(asset.bytes);await file.sync();}finally{await file.close();}await fs.rename(temporary,target);}finally{await fs.unlink(temporary).catch(()=>{});}return info;
 }
 async save(record:DesktopRecord,assets:BinaryAsset[]=[],clearDraft=false){
  // Clone before queueing: callers cannot mutate a queued snapshot.
  const snapshot=clone(record),material=clone(assets);validateProject(snapshot.project);
  if(!PROJECT_ID.test(snapshot.id))throw new Error('作品IDが不正です。');
  return this.queue(snapshot.id,async()=>{
   const existing=this.folders.has(snapshot.id);const folder=existing?this.folder(snapshot.id):path.join(this.config.root,`${String((snapshot.project as any).title).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,60)||'無題の物語'}_${snapshot.id}`);
   let previous:Document|undefined;if(existing)previous=(await this.document(folder)).doc;
   else {await fs.mkdir(folder,{recursive:true});try{await fs.access(path.join(folder,'scenario.json'));throw new Error('保存先には既に作品があります。');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
   const infos:Record<string,AssetInfo>={...previous?.assets};
   for(const asset of material)infos[asset.id]=await this.putAsset(folder,asset);
   const refs=validateProject(snapshot.project);for(const id of refs)if(!infos[id])throw new Error(`保存する素材がありません: ${id}`);
   // Retain unreferenced assets for previous snapshots and backups; never auto-delete media.
   const doc:Document={format:'tsuzuri-folder',version:1,id:snapshot.id,createdAt:previous?.createdAt??snapshot.createdAt,updatedAt:Date.now(),project:snapshot.project,assets:infos};validateDocument(doc);
   if(previous)await atomicJSON(path.join(folder,'scenario.json.bak'),previous,validateDocument);
   await atomicJSON(path.join(folder,'scenario.json'),doc,validateDocument,this.beforeReplace);
   if(clearDraft)await fs.unlink(path.join(folder,'drafts','bulk.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});
   this.documents.set(folder,doc);this.folders.set(doc.id,folder);await this.remember(doc,folder);return this.record(doc,folder);
  });
 }
 async loadDraft(id:string){await this.queues.get(id)?.catch(()=>{});const file=path.join(this.folder(id),'drafts','bulk.json');const read=async(file:string)=>{const value=JSON.parse(await fs.readFile(file,'utf8'));validateDraft(value);return value;};try{return await read(file);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return undefined;try{return await read(`${file}.bak`);}catch{throw new Error('下書きとバックアップを読み込めません。');}}}
 async saveDraft(id:string,draft:unknown){const snapshot=clone(draft);return this.queue(id,async()=>{
  const file=path.join(this.folder(id),'drafts','bulk.json');
  const valid=validateDraft;valid(snapshot);
  let previous:unknown;
  try{previous=JSON.parse(await fs.readFile(file,'utf8'));valid(previous);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT'){try{previous=JSON.parse(await fs.readFile(`${file}.bak`,'utf8'));valid(previous);}catch{throw new Error('下書きとバックアップが破損しています。元ファイルを別に保管してから再試行してください。');}}}
  if(previous)await atomicJSON(`${file}.bak`,previous,valid);
  await atomicJSON(file,snapshot,valid,this.beforeReplace);
 });}

 async importMedia(id:string,file:string,kind:'image'|'audio'){
  if(!path.isAbsolute(file))throw new Error('フルパスを指定してください。');file=await fs.realpath(file);
  const type=mimes[path.extname(file).slice(1).toLowerCase()];if(!type?.startsWith(`${kind}/`))throw new Error('対応する画像またはWAV / MP3を指定してください。');
  const stat=await fs.stat(file);if(!stat.isFile()||!stat.size||stat.size>25*1024*1024)throw new Error('素材は空でない25MB以下のファイルを指定してください。');
  const header=Buffer.alloc(64);const handle=await fs.open(file,'r');try{await handle.read(header,0,header.length,0);}finally{await handle.close();}
  const start=header.toString('ascii');const extension=formats[type];const valid=extension==='png'?header.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):extension==='jpg'?header[0]===255&&header[1]===216&&header[2]===255:extension==='webp'?start.startsWith('RIFF')&&start.slice(8,12)==='WEBP':extension==='gif'?/^GIF8[79]a/.test(start):extension==='avif'?start.slice(4,8)==='ftyp'&&/avif|avis/.test(start):extension==='wav'?start.startsWith('RIFF')&&start.slice(8,12)==='WAVE':extension==='mp3'?start.startsWith('ID3')||header[0]===255&&(header[1]&224)===224:false;
  if(!valid)throw new Error('素材の内容が拡張子と一致しないか、データが破損しています。');
  // Hash and copy in the main process; binary media never crosses IPC on this path.
  const digest=createHash('sha256');for await(const chunk of createReadStream(file))digest.update(chunk);const assetId=digest.digest('hex');
  return this.queue(id,async()=>{const folder=this.folder(id);const {doc}=await this.document(folder);const info={file:`assets/${assetId}.${formats[type]}`,type,size:stat.size};
   await fs.mkdir(path.join(folder,'assets'),{recursive:true});const target=path.join(folder,info.file);
   try{await fs.access(target);}catch{const temp=`${target}.${randomUUID()}.tmp`;try{await fs.copyFile(file,temp);const verify=createHash('sha256');for await(const chunk of createReadStream(temp))verify.update(chunk);if(verify.digest('hex')!==assetId)throw new Error('読み込み中に素材が変更されました。');await fs.rename(temp,target);}finally{await fs.unlink(temp).catch(()=>{});}}
   doc.assets[assetId]=info;await atomicJSON(path.join(folder,'scenario.json.bak'),(await this.document(folder)).doc,validateDocument);await atomicJSON(path.join(folder,'scenario.json'),doc,validateDocument,this.beforeReplace);this.documents.set(folder,doc);
   return {id:assetId,name:path.basename(file),url:`tsuzuri-media://${id}/${assetId}`};
  });
 }
 async backup(id:string){return this.queue(id,async()=>{const folder=this.folder(id);const {doc}=await this.document(folder);const destination=path.join(folder,'backups',`${new Date().toISOString().replace(/[:.]/g,'-')}_${randomUUID().slice(0,8)}`);await fs.mkdir(destination,{recursive:true});
  for(const info of Object.values(doc.assets)){const source=await this.checkedAssetPath(folder,info.file);await fs.mkdir(path.join(destination,'assets'),{recursive:true});await fs.copyFile(source,path.join(destination,info.file));}
  const draft=path.join(folder,'drafts','bulk.json');try{await fs.mkdir(path.join(destination,'drafts'),{recursive:true});await fs.copyFile(draft,path.join(destination,'drafts','bulk.json'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  await atomicJSON(path.join(destination,'scenario.json'),doc,validateDocument);return destination;
 });}
 async duplicate(id:string){return this.queue(id,async()=>{
  const folder=this.folder(id);const {doc}=await this.document(folder);const copy=clone(doc);copy.id=randomUUID();copy.createdAt=copy.updatedAt=Date.now();copy.project.title=`${copy.project.title||'無題の物語'}（コピー）`;copy.assets={};
  const destination=path.join(this.config.root,`コピー_${copy.id}`);await fs.mkdir(path.join(destination,'assets'),{recursive:true});
  for(const assetId of validateProject(copy.project)){const info=doc.assets[assetId];await fs.copyFile(await this.checkedAssetPath(folder,info.file),path.join(destination,info.file));copy.assets[assetId]=info;}
  try{await fs.mkdir(path.join(destination,'drafts'),{recursive:true});await fs.copyFile(path.join(folder,'drafts','bulk.json'),path.join(destination,'drafts','bulk.json'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  await atomicJSON(path.join(destination,'scenario.json'),copy,validateDocument,this.beforeReplace);await this.remember(copy,destination);return this.record(copy,destination);
 });}
 async restore(id:string){return this.queue(id,async()=>{const folder=this.folder(id);const value=JSON.parse(await fs.readFile(path.join(folder,'scenario.json.bak'),'utf8'));validateDocument(value);if(value.id!==id)throw new Error('バックアップの作品IDが一致しません。');await atomicJSON(path.join(folder,'scenario.json'),value,validateDocument,this.beforeReplace);this.documents.set(folder,value);return this.record(value,folder);});}
 async remove(id:string){return this.queue(id,async()=>{const folder=this.folder(id);const {doc}=await this.document(folder);if(doc.id!==id)throw new Error('作品IDが一致しません。');const trash=path.join(path.dirname(folder),'.trash');await fs.mkdir(trash,{recursive:true});await fs.rename(folder,path.join(trash,`${id}_${Date.now()}_${randomUUID().slice(0,8)}`));this.folders.delete(id);await this.queue('settings',async()=>{const next={...this.config,recent:this.config.recent.filter(r=>r.id!==id)};await atomicJSON(this.settingsFile,next);this.config=next;});});}
 getFolder(id?:string){return id?this.folder(id):this.config.root;}
 async drain(){await Promise.allSettled([...this.queues.values()]);}
}
