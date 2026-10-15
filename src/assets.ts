import type {Project} from './model';
export type AssetRecord={id:string;blob:Blob};
export const isAssetRef=(source:string)=>/^asset:[a-f0-9]{64}$/.test(source);
const records=new Map<string,AssetRecord>();
const urls=new Map<string,string>();
const sources=new Map<string,string>();
export async function registerAsset(blob:Blob):Promise<AssetRecord>{
 const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
 const id=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
 const record=records.get(id)??{id,blob};records.set(id,record);return record;
}
export function cacheAsset(record:AssetRecord){records.set(record.id,record);}
export function cachedAsset(id:string){return records.get(id);}
export function releaseAssetsExcept(keep:Set<string>){for(const id of records.keys()){if(keep.has(id))continue;const url=urls.get(id);if(url){URL.revokeObjectURL(url);sources.delete(url);urls.delete(id);}records.delete(id);}}
export function assetUrl(record:AssetRecord):string{
 cacheAsset(record);let url=urls.get(record.id);
 if(!url){url=URL.createObjectURL(record.blob);urls.set(record.id,url);sources.set(url,record.id);}return url;
}
export async function mapMedia(project:Project,transform:(source:string)=>Promise<string>):Promise<Project>{
 const scenes=[];
 for(const scene of project.scenes){
  const image=scene.image?await transform(scene.image):null;
  const voices=[];for(const voice of scene.voices??[])voices.push({...voice,data:await transform(voice.data)});
  const bgm=scene.bgm?.mode==='track'?{...scene.bgm,track:{...scene.bgm.track,data:await transform(scene.bgm.track.data)}}:scene.bgm;
  scenes.push({...scene,image,voices,bgm});
 }return {...project,scenes};
}
export async function encodeProject(project:Project):Promise<{project:Project;assets:AssetRecord[]}>{
 const found=new Map<string,AssetRecord>();const pending=new Map<string,Promise<string>>();
 const converted=await mapMedia(project,source=>{
  const known=pending.get(source);if(known)return known;
  const promise=(async()=>{
   const local=/^tsuzuri-media:\/\/([a-f0-9-]{36})\/([a-f0-9]{64})$/.exec(source);if(local)return `asset:${local[2]}`;
   if(isAssetRef(source)){const asset=cachedAsset(source.slice(6));if(asset)found.set(asset.id,asset);return source;}
   const id=sources.get(source);if(id){const record=records.get(id)!;found.set(id,record);return `asset:${id}`;}
   if(!source.startsWith('blob:')&&!/^data:(image|audio)\/[a-z0-9-]+;base64,/.test(source))throw new Error('素材データを読み込めませんでした。');
   const record=await registerAsset(await (await fetch(source)).blob());
   if(source.startsWith('blob:')){sources.set(source,record.id);if(!urls.has(record.id))urls.set(record.id,source);}
   found.set(record.id,record);return `asset:${record.id}`;
  })();pending.set(source,promise);return promise;
 });return {project:converted,assets:[...found.values()]};
}
export async function hydrateProject(project:Project,getAsset:(id:string)=>Promise<AssetRecord>):Promise<Project>{
 return mapMedia(project,async source=>isAssetRef(source)?assetUrl(cachedAsset(source.slice(6))??await getAsset(source.slice(6))):source);
}
export async function blobDataUrl(blob:Blob):Promise<string>{
 const bytes=new Uint8Array(await blob.arrayBuffer());const parts=[];
 for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
 return `data:${blob.type};base64,${btoa(parts.join(''))}`;
}
export async function legacyProject(project:Project,getAsset:(id:string)=>Promise<AssetRecord>):Promise<Project>{
 const encoded=await encodeProject(project);const pending=new Map<string,Promise<string>>();
 return mapMedia(encoded.project,source=>{
  const cached=pending.get(source);if(cached)return cached;
  const promise=(async()=>{const id=source.slice(6);const record=cachedAsset(id)??await getAsset(id);return blobDataUrl(record.blob);})();pending.set(source,promise);return promise;
 });
}
