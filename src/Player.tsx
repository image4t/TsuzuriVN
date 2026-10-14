import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,X,RotateCcw,Maximize,Minimize,MoreHorizontal,Volume2,SlidersHorizontal} from 'lucide-react';
import {defaultAudioSettings,resolveBackground,resolveBgm,speakerColor,type Project,type AudioSettings} from './model';
import {paginateText} from './pagination';
import {useSceneVoices} from './useSceneVoices';
import {useBgm} from './useBgm';
import AudioVolumes from './AudioVolumes';
import SceneBackground from './SceneBackground';
export default function Player({project,start,onClose,onAudioChange}:{project:Project;start:number;onClose:()=>void;onAudioChange:(settings:AudioSettings)=>void}) {
 const [position,setPosition]=useState({index:start,page:0});const {index,page}=position;
 const [visible,setVisible]=useState(0);const [pages,setPages]=useState<string[][]>([]);const [scale,setScale]=useState(1);
 const shell=useRef<HTMLDivElement>(null);const measure=useRef<HTMLDivElement>(null);
 const player=useRef<HTMLElement>(null);
 const [menuOpen,setMenuOpen]=useState(false);const menu=useRef<HTMLDivElement>(null);const menuButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(menuOpen)menu.current?.querySelector<HTMLButtonElement>('button')?.focus();},[menuOpen]);
 const dismissMenu=()=>{setMenuOpen(false);menuButton.current?.focus();};
 const [fullscreen,setFullscreen]=useState(false);const [fullscreenError,setFullscreenError]=useState('');
 useEffect(()=>{
  const update=()=>setFullscreen(document.fullscreenElement===player.current);
  document.addEventListener('fullscreenchange',update);
  return()=>{document.removeEventListener('fullscreenchange',update);};
 },[]);
 const toggleFullscreen=async()=>{
  setFullscreenError('');
  try{if(document.fullscreenElement===player.current)await document.exitFullscreen();else if(player.current?.requestFullscreen)await player.current.requestFullscreen();else throw new Error('Fullscreen unavailable');}
  catch{setFullscreenError('全画面表示に切り替えられませんでした。ブラウザの設定を確認してください。');}
 };
 const close=async()=>{
  if(document.fullscreenElement===player.current){try{await document.exitFullscreen();}catch{/* Unmounting also exits fullscreen. */}}
  onClose();
 };
 const current=project.scenes[index];const scenePages=pages[index]??[''];
 const settings=project.audioSettings??defaultAudioSettings();const [showVolumes,setShowVolumes]=useState(false);
 const background=resolveBackground(project.scenes,index);
 const voice=useSceneVoices(current,settings.voiceVolume);
 const bgm=useBgm(resolveBgm(project.scenes,index),settings.bgmVolume);
 const chars=Array.from(scenePages[page]??'');
 useLayoutEffect(()=>{
  const resize=()=>{if(shell.current)setScale(shell.current.clientWidth/1280);};resize();
  const observer=new ResizeObserver(resize);if(shell.current)observer.observe(shell.current);return()=>observer.disconnect();
 },[]);
 useLayoutEffect(()=>{
  let active=true;
  const split=()=>{if(active&&measure.current)setPages(project.scenes.map(s=>paginateText(s.text,measure.current!,s.speaker.trim()?144:180)));};
  split();void document.fonts.ready.then(split);return()=>{active=false;};
 },[project.scenes]);
 useLayoutEffect(()=>{setVisible(project.typewriter?0:chars.length);},[index,page,pages,project.typewriter]);
 useEffect(()=>{if(!project.typewriter || visible>=chars.length)return;const timer=setTimeout(()=>setVisible(v=>v+1),28);return()=>clearTimeout(timer);},[visible,chars.length,project.typewriter]);
 const next=()=>{
  if(!current)return;
  if(visible<chars.length)setVisible(chars.length);
  else if(page<scenePages.length-1)setPosition({index,page:page+1});
  else setPosition({index:Math.min(project.scenes.length,index+1),page:0});
 };
 const back=()=>{if(page>0)setPosition({index,page:page-1});else if(index>0)setPosition({index:index-1,page:(pages[index-1]?.length??1)-1});};
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.repeat)return;if(e.key==='Escape'&&menuOpen){e.preventDefault();dismissMenu();return;}if(menuOpen){if(e.key==='Tab'&&menu.current){const items=Array.from(menu.current.querySelectorAll<HTMLElement>('button:not(:disabled),input'));const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}return;}if(e.key==='m'||e.key==='M'||e.key==='ContextMenu'||(e.key==='F10'&&e.shiftKey)){e.preventDefault();setMenuOpen(true);return;}if(e.key!=='Escape'&&e.target instanceof HTMLInputElement)return;if(['Enter',' ','ArrowRight','ArrowLeft','Escape'].includes(e.key)){e.preventDefault();if(e.key==='Escape'){if(document.fullscreenElement===player.current)void toggleFullscreen();else void close();}else if(e.key==='ArrowLeft')back();else next();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});
 return <main className="player" ref={player}><div className="game-shell" ref={shell}><div className="game" style={{transform:`scale(${scale})`}} onClick={()=>{if(!menuOpen)next();}} onContextMenu={e=>{e.preventDefault();setMenuOpen(v=>!v);}} role="region" aria-label="ビジュアルノベル再生">
 <div ref={measure} className="dialogue-text page-measure" aria-hidden="true"/>
 {current ? <><SceneBackground source={background?.image??null}/><div className="game-shade"/></> : <div className="ending"><span className="eyebrow">THE END</span><h1>{project.scenes.length?'物語の、その先へ。':'まだ、白紙の物語。'}</h1><p>{project.scenes.length?'最後までお読みいただき、ありがとうございました。':'編集画面でシーンを追加してください。'}</p>{project.scenes.length>0&&<button onClick={e=>{e.stopPropagation();setPosition({index:0,page:0});}}><RotateCcw size={16}/> 最初から読む</button>}</div>}
 <div className={`playback-panel ${current&&(current.text||current.speaker)?"has-dialogue":"controls-only"}`}>
 {current&&(current.text||current.speaker)&&<div className={`dialogue ${current.speaker.trim()?'':'narration'}`} style={{color:speakerColor(project.speakerColors,current.speaker)}}>{current.speaker.trim()&&<div className="speaker">{current.speaker}</div>}<div className="dialogue-text">{chars.slice(0,visible).join('')}</div><div className="dialogue-footer"><span className="continue">{visible<chars.length?'•••':'▾'}</span></div></div>}
 </div><div className="playback-quick-actions" aria-hidden={menuOpen||undefined}><button className={`playback-voice-toggle ${voice.blocked?'needs-attention':''}`} aria-label="ボイスを再生" title={voice.hasVoices?(voice.blocked?'ボイスを再試行':'このシーンのボイスを最初から再生'):'このシーンにはボイスがありません'} disabled={!voice.hasVoices} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')e.stopPropagation();}} onClick={e=>{e.stopPropagation();voice.replay();}}><Volume2 size={20}/></button><button ref={menuButton} className={`playback-menu-toggle ${voice.blocked||bgm.error?"needs-attention":""}`} aria-label="再生メニュー" aria-haspopup="dialog" aria-expanded={menuOpen} title="再生メニュー（右クリック / M）" onClick={e=>{e.stopPropagation();setMenuOpen(true);}}><MoreHorizontal size={20}/></button></div>
 {menuOpen&&<div className="playback-menu-backdrop" onClick={e=>{e.stopPropagation();dismissMenu();}}><div ref={menu} className="playback-menu" role="dialog" aria-modal="true" aria-labelledby="playback-menu-title" onClick={e=>e.stopPropagation()} onContextMenu={e=>{e.preventDefault();e.stopPropagation();}}><header><div><span className="eyebrow">PLAYBACK</span><h2 id="playback-menu-title">再生メニュー</h2></div><button aria-label="メニューを閉じる" onClick={dismissMenu}><X size={20}/></button></header><p className="menu-project-title">{project.title||"無題の物語"}</p><div className="playback-progress"><span>シーン <strong>{Math.min(index+1,project.scenes.length)} / {project.scenes.length}</strong></span>{current&&<span className="page-number">{page+1} / {scenePages.length} ページ</span>}</div> <div className="player-controls"><button onClick={back} disabled={index===0&&page===0}><ArrowLeft size={16}/>戻る</button><button onClick={next} disabled={!current}>次へ<ArrowRight size={16}/></button><div className="control-spacer"/>{bgm.error&&<><span className="voice-status" role="status">{bgm.error}</span><button onClick={bgm.retry}>BGMを再生</button></>}{showVolumes&&<div className="menu-volumes"><AudioVolumes settings={settings} onChange={onAudioChange}/></div>}<button aria-label="音量設定" aria-expanded={showVolumes} onClick={()=>setShowVolumes(v=>!v)}><SlidersHorizontal size={16}/>音量</button>{voice.status&&<span className="voice-status" role="status">{voice.status}</span>}{voice.hasVoices&&<button onClick={voice.replay}><Volume2 size={16}/>{voice.blocked?'音声を再生':'ボイスを再生'}</button>}{fullscreenError&&<span className="fullscreen-error" role="alert">{fullscreenError}</span>}<button title={fullscreen?"全画面を解除":"全画面に拡大"} aria-label={fullscreen?"全画面を解除":"全画面に拡大"} aria-pressed={fullscreen} onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize size={16}/>:<Maximize size={16}/>}<span>{fullscreen?"全画面解除":"全画面"}</span></button><button onClick={()=>void close()}><X size={16}/>再生終了</button></div></div></div>} </div></div><p className="player-hint">クリック・Enter・Space：次のページへ　 /　 ←：戻る　 /　 Esc：全画面解除 / 編集画面へ</p></main>;
}



