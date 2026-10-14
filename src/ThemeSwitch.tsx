import {useState} from 'react';
import {Moon,Sun} from 'lucide-react';

export const THEME_KEY='tsuzuri-ui-theme';
export function initializeTheme(){
 let theme='light';
 try{if(localStorage.getItem(THEME_KEY)==='dark')theme='dark';}catch{/* The theme remains usable when storage is unavailable. */}
 document.documentElement.dataset.theme=theme;
}
export default function ThemeSwitch(){
 const [dark,setDark]=useState(()=>document.documentElement.dataset.theme==='dark');
 return <button className="subtle theme-switch" aria-label="ダークモード" aria-pressed={dark} title={dark?'ライトモードに切り替え':'ダークモードに切り替え'} onClick={()=>{
  const next=!dark;setDark(next);document.documentElement.dataset.theme=next?'dark':'light';
  try{localStorage.setItem(THEME_KEY,next?'dark':'light');}catch{/* Keep the current session theme. */}
 }}>{dark?<Sun size={16}/>:<Moon size={16}/>}<span>{dark?'ライト':'ダーク'}</span></button>;
}
