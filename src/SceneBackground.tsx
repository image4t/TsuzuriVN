import {useEffect,useRef,useState} from 'react';

const FADE_MS=1000;
type Layer={source:string|null;image:string|null};
/** Resolve images before fading; cancel stale loads and keep at most two layers. */
export default function SceneBackground({source}:{source:string|null}){
 const [layers,setLayers]=useState<{current:Layer;previous:Layer|null}>(()=>({current:{source,image:source},previous:null}));
 const [error,setError]=useState(false);
 const shown=useRef(source);
 useEffect(()=>{
  if(source===shown.current)return;
  let active=true;setError(false);
  const change=(image:string|null)=>{
   if(!active)return;
   shown.current=source;
   setLayers(previous=>({current:{source,image},previous:previous.current}));
  };
  if(source){
   const image=new Image();image.src=source;
   void image.decode().then(()=>change(source)).catch(()=>{if(active){setError(true);change(null);}});
  }else change(null);
  return()=>{active=false;};
 },[source]);
 useEffect(()=>{
  if(!layers.previous)return;
  const timer=setTimeout(()=>setLayers(state=>({...state,previous:null})),FADE_MS);
  return()=>clearTimeout(timer);
 },[layers.current,layers.previous]);
 const style=(layer:Layer)=>layer.image?{backgroundImage:`url(${layer.image})`}:undefined;
 return <>
  {layers.previous&&<div key={`old:${layers.previous.source}`} className="background-outgoing" style={style(layers.previous)} aria-hidden="true"/>}
  <div key={layers.current.source??'no-image'} className={`game-background ${layers.previous?'background-incoming':''}`} style={style(layers.current)} aria-hidden="true"/>
  {error&&<span className="background-error" role="status">背景画像を読み込めませんでした。</span>}
 </>;
}
