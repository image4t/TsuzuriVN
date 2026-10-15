import {app,BrowserWindow,protocol,net,ipcMain,dialog,shell,clipboard} from 'electron';
import path from 'node:path';
import * as fs from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {ProjectStore} from './project-store.js';

protocol.registerSchemesAsPrivileged([{scheme:'tsuzuri-app',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}},{scheme:'tsuzuri-media',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}}]);
const here=path.dirname(fileURLToPath(import.meta.url));
if(process.env.TSUZURI_TEST_USER_DATA)app.setPath('userData',process.env.TSUZURI_TEST_USER_DATA);
const lock=app.requestSingleInstanceLock();if(!lock)app.quit();
let window:BrowserWindow;let store:ProjectStore;let closing=false;let requestingClose=false;
app.on('second-instance',()=>{window?.show();window?.focus();});
function trusted(event:Electron.IpcMainInvokeEvent|Electron.IpcMainEvent){return event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame.url.startsWith('tsuzuri-app://app/');}
function handler(name:string,action:(...args:any[])=>unknown){ipcMain.handle(`tsuzuri:${name}`,async(event,...args)=>{if(!trusted(event))throw new Error('許可されていない呼び出しです。');try{return await action(...args);}catch(e){throw new Error(e instanceof Error?e.message:'ファイル操作に失敗しました。');}});}
function flushRenderer(){return new Promise<void>((resolve,reject)=>{const token=randomUUID();const timer=setTimeout(()=>done('画面から保存完了の応答がありません。'),30000);const done=(error?:string)=>{clearTimeout(timer);ipcMain.removeListener('tsuzuri:flushed',listener);error?reject(new Error(error)):resolve();};const listener=(event:Electron.IpcMainEvent,id:string,error:string|null)=>{if(trusted(event)&&id===token)done(error??undefined);};ipcMain.on('tsuzuri:flushed',listener);window.webContents.send('tsuzuri:flush',token);});}
void app.whenReady().then(async()=>{
 const installDirectory=app.isPackaged?path.dirname(app.getPath('exe')):path.resolve(here,'../..');
 const defaultRoot=process.env.TSUZURI_TEST_DOCUMENTS?path.join(process.env.TSUZURI_TEST_DOCUMENTS,'UserData'):path.join(installDirectory,'UserData');
 store=new ProjectStore(app.getPath('userData'),defaultRoot,undefined,path.join(process.env.TSUZURI_TEST_DOCUMENTS??app.getPath('documents'),'TsuzuriVN'));await store.init();
 const renderer=path.resolve(here,'../../dist');
 protocol.handle('tsuzuri-app',async request=>{
  const url=new URL(request.url);if(url.hostname!=='app')return new Response('Forbidden',{status:403});
  const file=path.resolve(renderer,decodeURIComponent(url.pathname).replace(/^\//,''));const relative=path.relative(renderer,file);if(relative.startsWith('..')||path.isAbsolute(relative))return new Response('Forbidden',{status:403});
  try{const response=await net.fetch(pathToFileURL(file).toString());const headers=new Headers(response.headers);headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: tsuzuri-media:; media-src 'self' blob: data: tsuzuri-media:; connect-src 'self' blob: data: tsuzuri-media:; object-src 'none'; frame-src 'none'; base-uri 'none'");return new Response(response.body,{status:response.status,headers});}catch{return new Response('Not found',{status:404});}
 });
 protocol.handle('tsuzuri-media',async request=>{
  try{const url=new URL(request.url);const assetId=url.pathname.slice(1);const asset=await store.asset(url.hostname,assetId);const response=await net.fetch(pathToFileURL(asset.path).toString(),{headers:request.headers});const headers=new Headers(response.headers);headers.set('Content-Type',asset.type);headers.set('Access-Control-Allow-Origin','tsuzuri-app://app');headers.set('Cache-Control','no-store');return new Response(response.body,{status:response.status,headers});}catch{return new Response('Media missing',{status:404});}
 });
 handler('list',()=>store.list());handler('load',id=>store.load(id));handler('save',(record,assets,clear)=>store.save(record,assets,clear));handler('remove',id=>store.remove(id));handler('duplicate',id=>store.duplicate(id));
 handler('settings',()=>store.settings());handler('theme',value=>{if(!['light','dark'].includes(value))throw new Error('テーマが不正です。');return store.updateSettings({theme:value});});
 handler('copyText',text=>{if(typeof text!=='string'||text.length>25*1024*1024)throw new Error('コピーする本文が不正または長すぎます。');clipboard.writeText(text);});
 handler('chooseRoot',async()=>{const chosen=await dialog.showOpenDialog(window,{title:'プロジェクト・リソースの保存先',defaultPath:store.settings().root,properties:['openDirectory','createDirectory']});if(chosen.canceled)return store.settings();const root=await fs.realpath(chosen.filePaths[0]);return store.updateSettings({root,rootMode:'custom'});});
 handler('resetRoot',()=>store.updateSettings({root:store.settings().defaultRoot,rootMode:'default'}));
 handler('openProject',async()=>{const chosen=await dialog.showOpenDialog(window,{title:'scenario.jsonのある作品フォルダを開く',defaultPath:store.settings().root,properties:['openDirectory']});return chosen.canceled?null:store.open(chosen.filePaths[0]);});
 handler('reveal',async id=>{const error=await shell.openPath(store.getFolder(id));if(error)throw new Error(error);});
 handler('backup',id=>store.backup(id));handler('restore',async id=>{const result=await dialog.showMessageBox(window,{type:'warning',message:'直前の正常な保存内容に戻しますか？',detail:'現在の内容は置き換わります。必要であれば先にZIP保存またはバックアップを作成してください。',buttons:['キャンセル','復旧する'],defaultId:0,cancelId:0});return result.response===1?store.restore(id):null;});
 handler('loadDraft',id=>store.loadDraft(id));handler('saveDraft',(id,draft)=>store.saveDraft(id,draft));handler('importMedia',(id,file,kind)=>{if(typeof file!=='string'||!['image','audio'].includes(kind))throw new Error('素材指定が不正です。');return store.importMedia(id,file,kind);});
 handler('readInput',async file=>{if(typeof file!=='string'||!path.isAbsolute(file)||!['.json','.zip','.txt'].includes(path.extname(file).toLowerCase()))throw new Error('JSON・ZIP・TXTファイルを指定してください。');const stat=await fs.stat(file);if(!stat.isFile()||stat.size>512*1024*1024)throw new Error('読み込むファイルは512MB以下にしてください。');return new Uint8Array(await fs.readFile(file));});
 handler('exportFile',async(name,bytes)=>{if(typeof name!=='string'||!(bytes instanceof Uint8Array)||bytes.length>600*1024*1024)throw new Error('保存するデータが不正です。');const chosen=await dialog.showSaveDialog(window,{defaultPath:path.basename(name)});if(chosen.canceled||!chosen.filePath)return false;const temporary=`${chosen.filePath}.${randomUUID()}.tmp`;try{const handle=await fs.open(temporary,'wx');try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}if((await fs.stat(temporary)).size!==bytes.length)throw new Error('書き出しデータの検証に失敗しました。');await fs.rename(temporary,chosen.filePath);}finally{await fs.unlink(temporary).catch(()=>{});}return true;});
 window=new BrowserWindow({width:1500,height:1000,minWidth:820,minHeight:620,show:!process.env.TSUZURI_TEST_USER_DATA,title:'綴り — TsuzuriVN',backgroundColor:'#141a1e',webPreferences:{preload:path.join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('tsuzuri-app://app/'))event.preventDefault();});window.webContents.session.setPermissionRequestHandler((contents,permission,callback)=>callback(permission==='fullscreen'&&contents.getURL().startsWith('tsuzuri-app://app/')));
 window.on('close',event=>{if(closing)return;event.preventDefault();if(requestingClose)return;requestingClose=true;void(async()=>{try{await flushRenderer();await store.drain();closing=true;window.close();}catch(e){const decision=await dialog.showMessageBox(window,{type:'warning',message:'保存を完了できませんでした。',detail:String(e),buttons:['編集を続ける','保存せず終了'],defaultId:0,cancelId:0});if(decision.response===1){closing=true;window.close();}}finally{requestingClose=false;}})();});
 await window.loadURL('tsuzuri-app://app/index.html');
}).catch(async error=>{await dialog.showErrorBox('TsuzuriVNを起動できません',String(error));app.quit();});
app.on('window-all-closed',()=>app.quit());
