import {createHash} from 'node:crypto';
export const hash=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
export const ID=/^[a-f0-9]{64}$/;
export const PROJECT_ID=/^[a-f0-9-]{36}$/;
export const formats:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/avif':'avif','audio/wav':'wav','audio/wave':'wav','audio/x-wav':'wav','audio/mpeg':'mp3','audio/mp3':'mp3'};
export const mimes:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',avif:'image/avif',wav:'audio/wav',mp3:'audio/mpeg'};
export function validateDraft(value:any){
 if(!value||value.version!==1||typeof value.source!=='string'||!Array.isArray(value.lines)||!Array.isArray(value.speakers)||value.speakers.some((s:unknown)=>typeof s!=='string')||!['input','assign'].includes(value.stage))throw new Error('下書き形式が不正です。');
 const ids=new Set<number>();for(const line of value.lines){if(!line||!Number.isInteger(line.id)||ids.has(line.id)||!Number.isInteger(line.lineNumber)||typeof line.text!=='string'||typeof line.separator!=='string'||typeof line.dialogue!=='boolean'||!(line.speaker===null||typeof line.speaker==='string'))throw new Error('下書きの行情報が不正です。');ids.add(line.id);}
}
export type AssetInfo={file:string;type:string;size:number};
export type Document={format:'tsuzuri-folder';version:1;id:string;createdAt:number;updatedAt:number;project:any;assets:Record<string,AssetInfo>};
export function validateProject(p:any):Set<string>{
 if(!p||p.version!==1||typeof p.title!=='string'||!Array.isArray(p.scenes)||p.scenes.length>100000)throw new Error('シナリオ形式が正しくありません。');
 const refs=new Set<string>(),ids=new Set<string>();
 const ref=(value:unknown,kind:string)=>{if(typeof value!=='string'||!/^asset:[a-f0-9]{64}$/.test(value))throw new Error(`${kind}の素材参照が不正です。`);refs.add(value.slice(6));};
 for(const s of p.scenes){
  if(!s||typeof s.id!=='string'||!s.id||ids.has(s.id)||typeof s.text!=='string'||typeof s.speaker!=='string'||!['inherit','custom','none'].includes(s.imageMode)||!Array.isArray(s.voices))throw new Error('シーン情報またはシーンIDが不正・重複しています。');
  ids.add(s.id);if(s.image!==null)ref(s.image,'画像');if(s.imageMode==='custom'&&!s.image)throw new Error('画像が指定されていません。');
  const voice=(v:any)=>{if(!v||typeof v.id!=='string'||typeof v.name!=='string')throw new Error('音声情報が不正です。');ref(v.data,'音声');};
  s.voices.forEach(voice);if(!s.bgm||!['inherit','stop','track'].includes(s.bgm.mode))throw new Error('BGM設定が不正です。');if(s.bgm.mode==='track')voice(s.bgm.track);
 }
 if(!p.audioSettings||![p.audioSettings.voiceVolume,p.audioSettings.bgmVolume].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1))throw new Error('音量設定が不正です。');
 if(!p.speakerColors||typeof p.speakerColors!=='object'||Object.values(p.speakerColors).some(c=>typeof c!=='string'||!/^#[a-f0-9]{6}$/i.test(c)))throw new Error('文字色設定が不正です。');
 return refs;
}
export function validateDocument(d:any):asserts d is Document{
 if(!d||d.format!=='tsuzuri-folder'||d.version!==1||!PROJECT_ID.test(d.id)||!Number.isFinite(d.createdAt)||!Number.isFinite(d.updatedAt)||!d.assets||typeof d.assets!=='object')throw new Error('対応する作品フォルダではありません。');
 const refs=validateProject(d.project);
 for(const [id,a] of Object.entries(d.assets) as [string,AssetInfo][]){if(!ID.test(id)||!a||!formats[a.type]||a.file!==`assets/${id}.${formats[a.type]}`||!Number.isSafeInteger(a.size)||a.size<=0||a.size>25*1024*1024)throw new Error('素材一覧のパス・形式が不正です。');}
 for(const id of refs)if(!Object.hasOwn(d.assets,id))throw new Error('参照素材の情報が不足しています。');
 for(const s of d.project.scenes){if(s.image&&!d.assets[s.image.slice(6)].type.startsWith('image/'))throw new Error('背景画像の形式が不正です。');for(const v of [...s.voices,...(s.bgm.mode==='track'?[s.bgm.track]:[])])if(!d.assets[v.data.slice(6)].type.startsWith('audio/'))throw new Error('音声の形式が不正です。');}
}
