import {zipSync,unzipSync,strToU8,strFromU8,type Zippable} from 'fflate';
import {parseProject,type Project} from './model.ts';
import {encodeProject,registerAsset,cachedAsset,hydrateProject,type AssetRecord} from './assets.ts';
type Manifest={format:'tsuzuri-project';version:2;project:Project;assets:{id:string;file:string;type:string}[]};
const extensions:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/avif':'avif','audio/wav':'wav','audio/wave':'wav','audio/x-wav':'wav','audio/mpeg':'mp3','audio/mp3':'mp3'};
export async function createProjectPackage(project:Project,getAsset?:(id:string)=>Promise<AssetRecord>):Promise<Uint8Array>{
 const encoded=await encodeProject(project);const sources=new Map<string,AssetRecord>(encoded.assets.map(record=>[record.id,record]));
 const refs=new Set<string>();for(const scene of encoded.project.scenes){if(scene.image)refs.add(scene.image.slice(6));for(const voice of scene.voices)refs.add(voice.data.slice(6));if(scene.bgm?.mode==='track')refs.add(scene.bgm.track.data.slice(6));}
 const manifest:Manifest={format:'tsuzuri-project',version:2,project:encoded.project,assets:[]};const files:Zippable={};
 for(const id of refs){const record=sources.get(id)??cachedAsset(id)??(getAsset?await getAsset(id):undefined);if(!record)throw new Error('保存する素材が見つかりません。');const type=record.blob.type;const extension=extensions[type];if(!extension)throw new Error('未対応の素材形式です。');const file=`assets/${id}.${extension}`;manifest.assets.push({id,file,type});files[file]=[new Uint8Array(await record.blob.arrayBuffer()),{level:0}];}
 files['scenario.json']=[strToU8(JSON.stringify(manifest)),{level:6}];return zipSync(files);
}
export async function readProjectPackage(bytes:Uint8Array):Promise<Project>{
 if(bytes.byteLength>512*1024*1024)throw new Error('プロジェクトZIPは512MB以下にしてください。');
 let total=0;const files=unzipSync(bytes,{filter:file=>{if(!/^scenario\.json$|^assets\/[a-f0-9]{64}\.[a-z0-9]+$/.test(file.name))return false;total+=file.originalSize;if(file.originalSize>25*1024*1024||total>512*1024*1024)throw new Error('プロジェクトの素材容量が上限を超えています。');return true;}});
 if(!files['scenario.json'])throw new Error('シナリオ情報が含まれていません。');
 const manifest=JSON.parse(strFromU8(files['scenario.json'])) as Manifest;
 if(manifest.format!=='tsuzuri-project'||manifest.version!==2||!Array.isArray(manifest.assets))throw new Error('対応するプロジェクトZIPではありません。');
 const project=parseProject(manifest.project,true);const assets=new Map<string,AssetRecord>();
 for(const info of manifest.assets){if(!info||typeof info.id!=='string'||!/^assets\/[a-f0-9]{64}\.[a-z0-9]+$/.test(info.file)||!extensions[info.type]||!files[info.file])throw new Error('プロジェクトの素材が不足しているか、形式が不正です。');const record=await registerAsset(new Blob([files[info.file]],{type:info.type}));if(record.id!==info.id)throw new Error('素材の内容が保存時から変わっています。');assets.set(record.id,record);}
 for(const scene of project.scenes){const references=[...(scene.image?[{source:scene.image,kind:'image/'}]:[]),...scene.voices.map(voice=>({source:voice.data,kind:'audio/'})),...(scene.bgm.mode==='track'?[{source:scene.bgm.track.data,kind:'audio/'}]:[])];for(const ref of references){const record=assets.get(ref.source.slice(6));if(!record||!record.blob.type.startsWith(ref.kind))throw new Error('参照している素材がありません。または素材の形式が不正です。');}}
 return hydrateProject(project,async id=>{const record=assets.get(id);if(!record)throw new Error('参照している素材がありません。');return record;});
}
