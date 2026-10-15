import {useEffect,useRef,useState} from 'react';
import {ChevronUp,ChevronDown,Plus,Trash2,Volume2} from 'lucide-react';
import type {Voice} from './model';
export default function VoiceEditor({voices,onAdd,onAddPaths,onChange,volume=1}:{voices:Voice[];onAdd:(files:File[])=>void;onAddPaths:(paths:string)=>Promise<void>;onChange:(voices:Voice[])=>void;volume?:number}){
 const [paths,setPaths]=useState('');const [loadingPaths,setLoadingPaths]=useState(false);
 const input=useRef<HTMLInputElement>(null);const preview=useRef<HTMLAudioElement>(null);const [previewId,setPreviewId]=useState<string|null>(null);const [error,setError]=useState('');
 useEffect(()=>{const audio=preview.current;return()=>{audio?.pause();};},[previewId]);
 useEffect(()=>{if(preview.current)preview.current.volume=volume;},[previewId,volume]);
 useEffect(()=>{if(previewId&&!voices.some(v=>v.id===previewId))setPreviewId(null);},[voices,previewId]);
 const move=(index:number,target:number)=>{const next=[...voices];const [voice]=next.splice(index,1);next.splice(target,0,voice);onChange(next);};
 const listen=(voice:Voice)=>{setError('');if(previewId===voice.id&&preview.current){preview.current.currentTime=0;void preview.current.play().catch(()=>setError('このボイスを再生できませんでした。'));}else{preview.current?.pause();setPreviewId(voice.id);}};
 return <section className="voice-editor" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.stopPropagation();const files=Array.from(e.dataTransfer.files);if(files.length)onAdd(files);}}><div className="voice-heading"><div className="field-label">ボイス <span>任意・複数指定可</span></div><button onClick={()=>input.current?.click()}><Plus size={15}/>音声を追加</button></div>
 <p className="field-note">WAV / MP3 · 1ファイル25MBまで。シーン開始時に上から順に再生します。</p>
 <details className="voice-path-import"><summary>フルパスを指定して追加</summary><label className="field-label">音声ファイルのフルパス<textarea rows={3} value={paths} disabled={loadingPaths} onChange={e=>setPaths(e.target.value)} placeholder={'例：Z:\\素材\\voice01.wav\n複数の場合は1行に1ファイル指定'}/></label><div><span>PC上のWAV / MP3。複数行を入力した順に追加します。</span><button disabled={loadingPaths||!paths.trim()} onClick={async()=>{setLoadingPaths(true);setError('');try{await onAddPaths(paths);setPaths('');}catch(e){setError(e instanceof Error?e.message:'音声を読み込めませんでした。');}finally{setLoadingPaths(false);}}}>{loadingPaths?'読み込み中…':'パスから音声を追加'}</button></div></details>
 {voices.length===0?<div className="voice-empty"><Volume2 size={18}/>このシーンのボイスは未設定です。</div>:<ol className="voice-list">{voices.map((voice,index)=><li key={voice.id}><span className="voice-order">{index+1}</span><span className="voice-name" title={voice.name}>{voice.name}</span><button aria-label={`${voice.name}を試聴`} title="試聴" onClick={()=>listen(voice)}><Volume2 size={15}/></button><button aria-label={`ボイス${index+1}を上へ`} disabled={index===0} onClick={()=>move(index,index-1)}><ChevronUp size={15}/></button><button aria-label={`ボイス${index+1}を下へ`} disabled={index===voices.length-1} onClick={()=>move(index,index+1)}><ChevronDown size={15}/></button><button aria-label={`${voice.name}を削除`} onClick={()=>onChange(voices.filter(v=>v.id!==voice.id))}><Trash2 size={15}/></button></li>)}</ol>}
 {previewId&&voices.some(v=>v.id===previewId)&&<audio key={previewId} ref={preview} controls autoPlay src={voices.find(v=>v.id===previewId)!.data} onError={()=>setError('このボイスを再生できませんでした。')}/>}
 {error&&<p role="alert" className="voice-error">{error}</p>}
 <input hidden ref={input} type="file" multiple accept=".wav,.mp3,audio/wav,audio/x-wav,audio/mpeg" onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';if(files.length)onAdd(files);}}/>
 </section>;
}

