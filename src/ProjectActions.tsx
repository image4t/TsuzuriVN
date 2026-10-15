import {useState} from 'react';
import {Save,FolderOpen,Archive,RotateCcw} from 'lucide-react';
import {requireDesktop} from './desktop';
export default function ProjectActions({id,onSave,onRestore,disabled=false}:{disabled?:boolean;id:string;onSave:()=>Promise<void>;onRestore:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const run=async(action:()=>Promise<void>)=>{setBusy(true);setMessage('');setError('');try{await action();}catch(e){setError(String(e));}finally{setBusy(false);}};
 return <div className="project-file-actions"><div><button disabled={busy||disabled} onClick={()=>void run(async()=>{await onSave();setMessage('保存しました');})}><Save size={15}/>保存・再試行</button><button disabled={busy||disabled} onClick={()=>void run(async()=>requireDesktop().reveal(id))}><FolderOpen size={15}/>保存先を開く</button><button disabled={busy||disabled} onClick={()=>void run(async()=>{await onSave();const folder=await requireDesktop().backup(id);setMessage(`バックアップを保存しました: ${folder}`);})}><Archive size={15}/>バックアップ</button><button disabled={busy||disabled} onClick={()=>void run(onRestore)}><RotateCcw size={15}/>直前の保存に復旧</button></div>{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</div>;
}
