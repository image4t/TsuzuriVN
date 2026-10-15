import type {DesktopAPI} from '../shared/desktop';
declare global{interface Window{tsuzuri?:DesktopAPI;}}
export const desktop=typeof window==='undefined'?undefined:window.tsuzuri;
export function requireDesktop(){if(!desktop)throw new Error('このバージョンはTsuzuriVNデスクトップアプリで起動してください。旧ブラウザ版の作品はZIPを書き出して移行できます。');return desktop;}
export let activeProjectId='';
export function activateProject(id:string){activeProjectId=id;}
const flushers=new Map<string,()=>Promise<void>>();
export function registerFlusher(key:string,handler:()=>Promise<void>){flushers.set(key,handler);return()=>{if(flushers.get(key)===handler)flushers.delete(key);};}
desktop?.onFlush(async()=>{for(const handler of [...flushers.values()].reverse())await handler();});
export async function nativeMedia(file:File,kind:'image'|'audio'){
 const api=requireDesktop();const path=api.filePath(file);if(!path)return null;
 return api.importMedia(activeProjectId,path,kind);
}
export async function readInputBytes(file:File):Promise<Uint8Array>{const path=desktop?.filePath(file);return path?requireDesktop().readInput(path):new Uint8Array(await file.arrayBuffer());}
export async function readInputText(file:File){return new TextDecoder('utf-8',{fatal:true}).decode(await readInputBytes(file));}
