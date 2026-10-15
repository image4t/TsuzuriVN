import {contextBridge,ipcRenderer,webUtils} from 'electron';
import type {DesktopAPI} from '../shared/desktop.js' with {"resolution-mode":"import"};
const call=(method:string,...args:unknown[])=>ipcRenderer.invoke(`tsuzuri:${method}`,...args);
const selectedInputs=new Set<string>();
const api:DesktopAPI={
 list:()=>call('list'),load:id=>call('load',id),save:(record,assets,clear)=>call('save',record,assets,clear),remove:id=>call('remove',id),duplicate:id=>call('duplicate',id),
 openProject:()=>call('openProject'),chooseRoot:()=>call('chooseRoot'),resetRoot:()=>call('resetRoot'),settings:()=>call('settings'),theme:value=>call('theme',value),copyText:text=>call('copyText',text),reveal:id=>call('reveal',id),backup:id=>call('backup',id),restore:id=>call('restore',id),
 loadDraft:id=>call('loadDraft',id),saveDraft:(id,draft)=>call('saveDraft',id,draft),importMedia:(id,path,kind)=>call('importMedia',id,path,kind),filePath:file=>{const path=webUtils.getPathForFile(file);if(path)selectedInputs.add(path);return path;},readInput:path=>{if(!selectedInputs.has(path))return Promise.reject(new Error('ファイル選択またはドラッグ＆ドロップで指定してください。'));return call('readInput',path);},exportFile:(name,bytes)=>call('exportFile',name,bytes),
 onFlush:handler=>{const listener=async(_event:Electron.IpcRendererEvent,token:string)=>{try{await handler();ipcRenderer.send('tsuzuri:flushed',token,null);}catch(e){ipcRenderer.send('tsuzuri:flushed',token,e instanceof Error?e.message:String(e));}};ipcRenderer.on('tsuzuri:flush',listener);return()=>ipcRenderer.removeListener('tsuzuri:flush',listener);},
};
contextBridge.exposeInMainWorld('tsuzuri',api);
