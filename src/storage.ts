import {parseProject,type Project} from './model';
import type {BulkDraft} from './bulk';
import {encodeProject,cachedAsset,releaseAssetsExcept,mapMedia,type AssetRecord} from './assets';
import {requireDesktop,activateProject,activeProjectId} from './desktop';
import type {DesktopRecord} from '../shared/desktop';
export type SavedScenario={id:string;project:Project;createdAt:number;updatedAt:number;coverUrl?:string;folder?:string;warning?:string;migrationWarning?:boolean};
const owners=new Map<string,string>();const written=new Map<string,Set<string>>();let writes=Promise.resolve();
function refs(project:Project){const ids=new Set<string>();for(const s of project.scenes){if(s.image?.startsWith('asset:'))ids.add(s.image.slice(6));for(const v of s.voices)if(v.data.startsWith('asset:'))ids.add(v.data.slice(6));if(s.bgm.mode==='track'&&s.bgm.track.data.startsWith('asset:'))ids.add(s.bgm.track.data.slice(6));}return ids;}
function remember(record:DesktopRecord):SavedScenario{const project=parseProject(record.project,true);for(const id of refs(project))owners.set(id,record.id);written.set(record.id,refs(project));const image=project.scenes.find(s=>s.image)?.image;return {...record,project,coverUrl:image?`tsuzuri-media://${record.id}/${image.slice(6)}`:undefined};}
export function newScenario(project:Project):SavedScenario{const now=Date.now();return {id:crypto.randomUUID(),project,createdAt:now,updatedAt:now};}
export async function listScenarios(){return (await requireDesktop().list()).map(remember);}
export async function loadScenario(id:string):Promise<SavedScenario>{const record=remember(await requireDesktop().load(id));activateProject(id);const project=await mapMedia(record.project,async source=>source.startsWith('asset:')?`tsuzuri-media://${id}/${source.slice(6)}`:source);releaseAssetsExcept(new Set());return {...record,project};}
export function saveScenario(record:SavedScenario,additional:AssetRecord[]=[],clearDraft=false):Promise<void>{
 const snapshot=structuredClone(record);
 const operation=writes.catch(()=>{}).then(async()=>{const encoded=await encodeProject(snapshot.project);const material=new Map([...encoded.assets,...additional].map(a=>[a.id,a]));const known=written.get(record.id)??new Set<string>();const assets=[];
 for(const id of refs(encoded.project)){if(known.has(id))continue;const asset=material.get(id)??cachedAsset(id);if(asset)assets.push({id,type:asset.blob.type,bytes:new Uint8Array(await asset.blob.arrayBuffer())});else if(owners.has(id)&&owners.get(id)!==record.id){const loaded=await loadAsset(id);assets.push({id,type:loaded.blob.type,bytes:new Uint8Array(await loaded.blob.arrayBuffer())});}}
 const saved=await requireDesktop().save({...snapshot,project:encoded.project},assets,clearDraft);remember(saved);
 });writes=operation;return operation;
}
export async function saveProject(id:string,project:Project,clearDraft=false){await saveScenario({id,project,createdAt:Date.now(),updatedAt:Date.now()},[],clearDraft);}
export async function deleteScenario(id:string){await writes.catch(()=>{});await requireDesktop().remove(id);written.delete(id);}
export async function loadAsset(id:string):Promise<AssetRecord>{const cached=cachedAsset(id);if(cached)return cached;const owner=owners.get(id)??activeProjectId;if(!owner)throw new Error('素材の作品が開かれていません。');const response=await fetch(`tsuzuri-media://${owner}/${id}`);if(!response.ok)throw new Error('素材が見つかりません。バックアップを確認してください。');const record={id,blob:await response.blob()};return record;}
export async function loadDraft(id:string){return await requireDesktop().loadDraft(id) as BulkDraft|undefined;}
export async function saveDraft(id:string,draft:BulkDraft){await requireDesktop().saveDraft(id,draft);}
export async function pruneAssets(){} // Desktop snapshots retain media for safe recovery.
