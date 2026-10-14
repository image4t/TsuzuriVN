import {useEffect,useRef,useState} from 'react';
import type {Voice} from './model';
export function useBgm(track:Voice|null,volume:number){
 const audioRef=useRef<HTMLAudioElement|null>(null);const volumeRef=useRef(volume);volumeRef.current=volume;
 const [retry,setRetry]=useState(0);const [error,setError]=useState('');
 const data=track?.data;
 useEffect(()=>{if(audioRef.current)audioRef.current.volume=volume;},[volume]);
 useEffect(()=>{
  setError('');if(!data)return;
  let active=true;const audio=new Audio(data);audio.loop=true;audio.volume=volumeRef.current;audio.preload='auto';audioRef.current=audio;
  audio.onerror=()=>{if(active)setError('BGMを読み込めませんでした。');};
  void audio.play().catch((error:unknown)=>{if(active)setError(error instanceof DOMException&&error.name==='NotAllowedError'?'BGMを再生するにはボタンを押してください。':'BGMを再生できませんでした。');});
  return()=>{active=false;audioRef.current=null;audio.onerror=null;audio.pause();audio.removeAttribute('src');audio.load();};
 },[data,retry]);
 return {error,retry:()=>setRetry(v=>v+1)};
}
