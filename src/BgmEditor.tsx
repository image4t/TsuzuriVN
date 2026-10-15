import {useEffect,useRef,useState} from 'react';
import {Music2,Upload} from 'lucide-react';
import type {Bgm,Voice} from './model';
export default function BgmEditor({bgm,inherited,onAdd,onChange,volume=.5}:{bgm:Bgm;inherited:Voice|null;onAdd:(file:File)=>void;onChange:(bgm:Bgm)=>void;volume?:number}){
 const input=useRef<HTMLInputElement>(null);const preview=useRef<HTMLAudioElement>(null);const [listening,setListening]=useState(false);const [error,setError]=useState('');
 const effective=bgm.mode==='track'?bgm.track:bgm.mode==='inherit'?inherited:null;
 useEffect(()=>{setListening(false);setError('');},[effective?.data]);
 useEffect(()=>{const audio=preview.current;return()=>{audio?.pause();};},[listening,effective?.data]);
 useEffect(()=>{if(preview.current)preview.current.volume=volume;},[listening,volume]);
 return <section className="bgm-editor" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.stopPropagation();const file=e.dataTransfer.files[0];if(file)onAdd(file);}}><div className="voice-heading"><div className="field-label">BGM <span>シーンをまたいでループ再生</span></div><Music2 size={18}/></div>
 <div className="bgm-options"><label><input type="radio" name="bgm-mode" checked={bgm.mode==='inherit'} onChange={()=>onChange({mode:'inherit'})}/>前のBGMを引き継ぐ</label><label><input type="radio" name="bgm-mode" checked={bgm.mode==='track'} onChange={()=>input.current?.click()}/>曲を設定・変更</label><label><input type="radio" name="bgm-mode" checked={bgm.mode==='stop'} onChange={()=>onChange({mode:'stop'})}/>このシーンから停止</label></div>
 <div className="bgm-file"><div><strong>{effective?.name||'BGMなし'}</strong><small>{bgm.mode==='track'?'このシーンから曲を変更':bgm.mode==='stop'?'このシーン以降はBGMなし':inherited?'前のシーンから継続':'前のシーンにBGMが設定されていません'}</small></div><button onClick={()=>input.current?.click()}><Upload size={14}/>{bgm.mode==='track'?'曲を差し替え':'曲を設定'}</button>{effective&&<button onClick={()=>setListening(v=>!v)}>{listening?'試聴終了':'試聴'}</button>}</div>
 {listening&&effective&&<audio ref={preview} controls autoPlay loop src={effective.data} onError={()=>setError('BGMを試聴できませんでした。')}/>}
 {error&&<p className="voice-error" role="alert">{error}</p>}
 <p className="field-note">WAV / MP3 · 1ファイル25MBまで。変更しない限り、次のシーンでも同じ曲が流れます。</p>
 <input hidden ref={input} data-testid="bgm-input" type="file" accept=".wav,.mp3,audio/wav,audio/x-wav,audio/mpeg" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)onAdd(file);}}/>
 </section>;
}
