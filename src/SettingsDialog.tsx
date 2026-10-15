import {useEffect,useRef,useState} from 'react';
import {Settings,X,FolderOpen,RotateCcw} from 'lucide-react';
import {requireDesktop} from './desktop';
import type {DesktopSettings} from '../shared/desktop';

export default function SettingsDialog({disabled=false,onChange}:{disabled?:boolean;onChange?:(settings:DesktopSettings)=>void}){
 const [open,setOpen]=useState(false);
 return <><button className="subtle settings-trigger" aria-label="設定" title="設定" aria-haspopup="dialog" disabled={disabled} onClick={()=>setOpen(true)}><Settings size={18}/></button>{open&&<SettingsPanel onClose={()=>setOpen(false)} onChange={onChange}/>}</>;
}
function SettingsPanel({onClose,onChange}:{onClose:()=>void;onChange?:(settings:DesktopSettings)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);const [settings,setSettings]=useState<DesktopSettings|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{const previous=document.activeElement;dialog.current?.showModal();let active=true;void requireDesktop().settings().then(s=>{if(active)setSettings(s);}).catch(e=>{if(active)setError(String(e));});return()=>{active=false;dialog.current?.close();if(previous instanceof HTMLElement)previous.focus();};},[]);
 const run=async(action:()=>Promise<DesktopSettings>)=>{setBusy(true);setError('');try{const next=await action();setSettings(next);onChange?.(next);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 return <dialog className="settings-dialog" ref={dialog} aria-labelledby="settings-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><header><div><span className="eyebrow">PREFERENCES</span><h2 id="settings-title">設定</h2></div><button aria-label="設定を閉じる" disabled={busy} onClick={onClose}><X size={20}/></button></header>{error&&<p role="alert" className="settings-error">{error}</p>}{settings?<>
 <section><h3>表示テーマ</h3><label className="settings-theme">テーマ<select aria-label="表示テーマ" disabled={busy} value={settings.theme} onChange={e=>{const value=e.target.value as 'light'|'dark';void run(async()=>{await requireDesktop().theme(value);document.documentElement.dataset.theme=value;window.dispatchEvent(new Event('tsuzuri-theme'));return requireDesktop().settings();});}}><option value="light">ライト</option><option value="dark">ダーク</option></select></label></section>
 <section><h3>プロジェクト・リソースの保存先</h3><p>新しい作品の保存先です。画像・音声・下書きも各作品フォルダ内にまとめて保存します。</p><output aria-label="現在の保存先" className="settings-path">{settings.root}</output>{settings.storageWarning&&<p role="alert" className="settings-error">{settings.storageWarning}</p>}<div className="settings-path-actions"><button disabled={busy} onClick={()=>void run(()=>requireDesktop().chooseRoot())}><FolderOpen size={15}/>フォルダを変更</button><button disabled={busy||settings.rootMode==='default'} onClick={()=>void run(()=>requireDesktop().resetRoot())}><RotateCcw size={15}/>既定に戻す</button></div><p className="settings-default">既定: {settings.defaultRoot}</p><p>保存先の変更は次に作成する作品へ適用します。既存作品を移動する場合はアプリを閉じてフォルダ全体を移動し、「作品フォルダを開く」から登録してください。</p></section>
 </>:<p className="settings-loading">設定を読み込み中…</p>}<footer><span>{busy?'設定を保存中…':'変更は自動で保存されます'}</span><button disabled={busy} className="primary" onClick={onClose}>閉じる</button></footer></dialog>;
}
