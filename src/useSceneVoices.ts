import {useEffect,useRef,useState} from 'react';
import type {Scene} from './model';
export function useSceneVoices(current:Scene|undefined,volume:number){
 const [retry,setRetry]=useState(0);const [status,setStatus]=useState('');const [blocked,setBlocked]=useState(false);
 const audioRef=useRef<HTMLAudioElement|null>(null);const volumeRef=useRef(volume);volumeRef.current=volume;
 useEffect(()=>{if(audioRef.current)audioRef.current.volume=volume;},[volume]);
 useEffect(()=>{
  setStatus('');setBlocked(false);
  const voices=current?.voices??[];if(!voices.length)return;
  let active=true;let index=0;const audio=new Audio();audio.preload='auto';audio.volume=volumeRef.current;audioRef.current=audio;
  const play=()=>{
   if(!active)return;const voice=voices[index];audio.src=voice.data;setStatus(`ボイス ${index+1} / ${voices.length}`);
   void audio.play().catch((error:unknown)=>{if(!active)return;setBlocked(true);setStatus(error instanceof DOMException&&error.name==='NotAllowedError'?'音声を再生するにはボタンを押してください。':'ボイスを再生できませんでした。再試行できます。');});
  };
  audio.onended=()=>{if(!active)return;if(++index<voices.length)play();else setStatus('');};
  audio.onerror=()=>{if(active){setStatus('ボイスを読み込めませんでした。再試行できます。');setBlocked(true);}};
  play();return()=>{active=false;audioRef.current=null;audio.onended=null;audio.onerror=null;audio.pause();audio.removeAttribute('src');audio.load();};
 },[current?.id,current?.voices,retry]);
 return {status,blocked,replay:()=>setRetry(v=>v+1),hasVoices:!!current?.voices?.length};
}
