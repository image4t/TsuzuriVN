import {useEffect,useRef,useState} from 'react';
import {Check,Copy} from 'lucide-react';
import {desktop} from './desktop';

export default function TextCopyButton({text}:{text:string}){
 const [status,setStatus]=useState('');
 const [busy,setBusy]=useState(false);
 const revision=useRef(0);
 useEffect(()=>{revision.current++;setStatus('');return()=>{revision.current++;};},[text]);
 return <div className="text-copy-control"><span role="status" className="text-copy-status">{status}</span><button type="button" className="text-copy-button" aria-label="本文をコピー" title="本文全体をクリップボードにコピー" disabled={!text||busy} onClick={async()=>{
  const current=revision.current;setBusy(true);setStatus('');
  try{
   if(desktop)await desktop.copyText(text);
   else {if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(text);}
   if(current===revision.current)setStatus('コピーしました');
  }catch{if(current===revision.current)setStatus('コピーできませんでした。本文を選択してコピーしてください。');}
  finally{setBusy(false);}
 }}>{status==='コピーしました'?<Check size={14}/>:<Copy size={14}/>}コピー</button></div>;
}
