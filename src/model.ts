import {desktop,nativeMedia} from './desktop';
import {registerAsset,assetUrl,isAssetRef} from './assets.ts';
export type Voice = {id:string;name:string;data:string};
export type Bgm = {mode:'inherit'}|{mode:'stop'}|{mode:'track';track:Voice};
export type AudioSettings = {voiceVolume:number;bgmVolume:number};
export type SpeakerColors = Record<string,string>;
export const DEFAULT_TEXT_COLOR='#f3f4f5';
export function speakerColor(colors:SpeakerColors|undefined,speaker:string):string{
 const key=speaker.trim()?speaker:'';
 return colors&&Object.hasOwn(colors,key)?colors[key]:DEFAULT_TEXT_COLOR;
}
export const defaultAudioSettings = ():AudioSettings=>({voiceVolume:1,bgmVolume:.5});
export type ImageMode='inherit'|'custom'|'none';
export type Background={image:string;name:string};
export type Scene = {id:string; text:string; speaker:string; image:string|null; imageName:string;imageMode:ImageMode;voices:Voice[];bgm:Bgm};
export type Project = {version:1; title:string; scenes:Scene[]; typewriter:boolean;audioSettings:AudioSettings;speakerColors:SpeakerColors};
export const scene = (data:Partial<Scene> = {}):Scene => ({id:crypto.randomUUID(),text:'',speaker:'',image:null,imageName:'',voices:[],bgm:{mode:'inherit'},imageMode:data.imageMode??(data.image?'custom':'inherit'),...data});
export const sceneAfter = (_previous:Scene|undefined,data:Partial<Scene> = {}):Scene => scene(data);
export function resolveBackgrounds(scenes:Scene[]):(Background|null)[]{
 let background:Background|null=null;
 return scenes.map(s=>{const mode=s.imageMode??(s.image?'custom':'inherit');if(mode==='none')background=null;else if(mode==='custom')background=s.image?{image:s.image,name:s.imageName}:null;return background;});
}
export function resolveBackground(scenes:Scene[],index:number):Background|null{
 if(index<0||index>=scenes.length)return null;
 for(let i=index;i>=0;i--){const s=scenes[i];const mode=s.imageMode??(s.image?'custom':'inherit');if(mode==='none')return null;if(mode==='custom')return s.image?{image:s.image,name:s.imageName}:null;}
 return null;
}
export const emptyProject = ():Project => ({version:1,title:'無題の物語',scenes:[],typewriter:false,audioSettings:defaultAudioSettings(),speakerColors:{}});
export function resolveBgm(scenes:Scene[],index:number):Voice|null{
 if(index<0||index>=scenes.length)return null;
 let track:Voice|null=null;
 for(let i=0;i<=index;i++){const bgm=scenes[i].bgm;if(bgm?.mode==='track')track=bgm.track;else if(bgm?.mode==='stop')track=null;}
 return track;
}
function parseAudio(value:unknown,allowAssets=false):Voice{
 if(!value||typeof value!=='object')throw new Error('音声の形式が正しくありません。');
 const audio=value as Record<string,unknown>;
 if(typeof audio.name!=='string'||typeof audio.data!=='string'||(!/^data:audio\/(wav|wave|x-wav|mpeg|mp3);base64,[A-Za-z0-9+/=\s]+$/.test(audio.data)&&!(allowAssets&&isAssetRef(audio.data))))throw new Error('音声にはWAVまたはMP3の埋め込みデータを指定してください。');
 return {id:crypto.randomUUID(),name:audio.name,data:audio.data};
}
export function splitText(text:string):Scene[] {return text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split(/\n[\t ]*\n+/).map(t=>t.trim()).filter(Boolean).map(text=>scene({text}));}
export function parseProject(value:unknown,allowAssets=false):Project {
 if(!value || typeof value!=='object') throw new Error('シナリオ形式が正しくありません。');
 const p=value as Record<string,unknown>;
 if(p.version!==1 || typeof p.title!=='string' || !Array.isArray(p.scenes)) throw new Error('対応するシナリオJSONではありません（version: 1）。');
 const ids=new Set<string>();
 const scenes=p.scenes.map((s:unknown)=>{
  if(!s || typeof s!=='object') throw new Error('シーン形式が正しくありません。');
  const v=s as Record<string,unknown>;
  if(typeof v.text!=='string' || typeof v.speaker!=='string' || (v.image!==null && (typeof v.image!=='string' || (!/^data:image\/(png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/=\s]+$/.test(v.image)&&!(allowAssets&&isAssetRef(v.image)))))) throw new Error('シーンの本文・話者・画像形式が正しくありません。');
  const imageMode=v.imageMode===undefined?(v.image?'custom':'inherit'):v.imageMode;
  if(!['inherit','custom','none'].includes(imageMode as string)||imageMode==='custom'&&!v.image)throw new Error('背景画像の設定が正しくありません。');
  if(v.voices!==undefined&&!Array.isArray(v.voices))throw new Error('ボイスの形式が正しくありません。');
  const voices=(v.voices??[]) as unknown[];
  const parsedVoices=voices.map(value=>parseAudio(value,allowAssets));
  let bgm:Bgm={mode:'inherit'};
  if(v.bgm!==undefined){
   if(!v.bgm||typeof v.bgm!=='object')throw new Error('BGMの形式が正しくありません。');
   const setting=v.bgm as Record<string,unknown>;
   if(setting.mode==='track')bgm={mode:'track',track:parseAudio(setting.track,allowAssets)};
   else if(setting.mode==='stop'||setting.mode==='inherit')bgm={mode:setting.mode};
   else throw new Error('BGMの設定が正しくありません。');
  }
  const id=typeof v.id==='string'&&v.id?v.id:crypto.randomUUID();if(ids.has(id))throw new Error('シーンIDが重複しています。');ids.add(id);
  return scene({id,text:v.text,speaker:v.speaker,image:imageMode==='custom'?v.image as string:null,imageName:imageMode==='custom'&&typeof v.imageName==='string'?v.imageName:'',imageMode:imageMode as ImageMode,voices:parsedVoices,bgm});
 });
 let audioSettings=defaultAudioSettings();
 if(p.audioSettings!==undefined){
  if(!p.audioSettings||typeof p.audioSettings!=='object')throw new Error('音量設定が正しくありません。');
  const settings=p.audioSettings as Record<string,unknown>;
  if(typeof settings.voiceVolume!=='number'||typeof settings.bgmVolume!=='number'||!Number.isFinite(settings.voiceVolume)||!Number.isFinite(settings.bgmVolume)||settings.voiceVolume<0||settings.voiceVolume>1||settings.bgmVolume<0||settings.bgmVolume>1)throw new Error('音量は0〜1で指定してください。');
  audioSettings={voiceVolume:settings.voiceVolume,bgmVolume:settings.bgmVolume};
 }
 let speakerColors:SpeakerColors={};
 if(p.speakerColors!==undefined){
  if(!p.speakerColors||typeof p.speakerColors!=='object'||Array.isArray(p.speakerColors))throw new Error('話者の文字色設定が正しくありません。');
  const entries=Object.entries(p.speakerColors);
  if(entries.some(([,value])=>typeof value!=='string'||!/^#[0-9a-fA-F]{6}$/.test(value)))throw new Error('文字色は#RRGGBB形式で指定してください。');
  speakerColors=Object.fromEntries(entries.map(([key,value])=>[key,(value as string).toLowerCase()]));
 }
 return {version:1,title:p.title,scenes,typewriter:p.typewriter===true,audioSettings,speakerColors};
}
export async function readVoice(file:File):Promise<Voice>{
 if(desktop){const media=await nativeMedia(file,'audio');if(media)return {id:crypto.randomUUID(),name:media.name,data:media.url};}
 const extension=file.name.split('.').pop()?.toLowerCase();
 if(extension!=='wav'&&extension!=='mp3')throw new Error('WAVまたはMP3の音声ファイルを選択してください。');
 if(file.size>25*1024*1024)throw new Error('音声は1ファイル25MB以下にしてください。');
 if(file.size===0)throw new Error('音声ファイルが空です。');
 const normalized=new Blob([file],{type:extension==='wav'?'audio/wav':'audio/mpeg'});
 const url=URL.createObjectURL(normalized);
 try{await new Promise<void>((resolve,reject)=>{
  const audio=new Audio();const finish=(error?:Error)=>{clearTimeout(timer);audio.onloadedmetadata=null;audio.onerror=null;audio.removeAttribute('src');audio.load();error?reject(error):resolve();};
  const timer=setTimeout(()=>finish(new Error('音声の確認がタイムアウトしました。')),10000);
  audio.onloadedmetadata=()=>finish(Number.isFinite(audio.duration)&&audio.duration>0?undefined:new Error('音声の長さを読み取れませんでした。'));
  audio.onerror=()=>finish(new Error('音声データが壊れているか、このブラウザで再生できません。'));audio.preload='metadata';audio.src=url;
 });}finally{URL.revokeObjectURL(url);}
 return {id:crypto.randomUUID(),name:file.name,data:assetUrl(await registerAsset(normalized))};
}
export async function readImage(file:File):Promise<string> {
 if(desktop){const media=await nativeMedia(file,'image');if(media)return media.url;}
 if(!['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(file.type))throw new Error('PNG・JPEG・WebP・GIF・AVIF画像を選択してください。');
 if(file.size>25*1024*1024)throw new Error('画像は1枚25MB以下にしてください。');
 const url=URL.createObjectURL(file);
 try{await new Promise<void>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve();img.onerror=()=>reject(new Error('画像データが壊れています。'));img.src=url;});}finally{URL.revokeObjectURL(url);}
 return assetUrl(await registerAsset(file));
}
