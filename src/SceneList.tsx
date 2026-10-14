import {memo,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,GripVertical,ChevronUp,ChevronDown} from 'lucide-react';
import type {Background,Scene,SpeakerColors} from './model';
import {speakerCardStyle} from './speakerStyles';
import {emptyFilters,filteredSceneIndices} from './sceneFilters';
const ROW=90,OVERSCAN=4;
type Props={scenes:Scene[];backgrounds:(Background|null)[];selected:string;colors:SpeakerColors;onSelect:(id:string)=>void;onMove:(id:string,index:number)=>void};
export default memo(function SceneList({scenes,backgrounds,selected,colors,onSelect,onMove}:Props){
 const ref=useRef<HTMLDivElement>(null);const [scrollTop,setScrollTop]=useState(0);const dragged=useRef<string|null>(null);
 const [filters,setFilters]=useState(emptyFilters);
 const speakers=useMemo(()=>Array.from(new Set(scenes.map(s=>s.speaker).filter(s=>s.trim()))),[scenes]);
 const indices=useMemo(()=>filteredSceneIndices(scenes,backgrounds,filters),[scenes,backgrounds,filters]);
 const active=filters.speaker!==null||filters.voice!=='all'||filters.background!=='all'||filters.bgm!=='all';
 const height=Math.min(480,Math.max(215,indices.length*ROW+26));
 const index=useMemo(()=>indices.findIndex(i=>scenes[i].id===selected),[scenes,indices,selected]);
 useLayoutEffect(()=>{if(ref.current)ref.current.scrollTop=0;setScrollTop(0);},[filters]);
 useLayoutEffect(()=>{const list=ref.current;if(index<0||!list)return;const top=13+index*ROW,bottom=top+ROW;if(top<list.scrollTop)list.scrollTop=Math.max(0,top-13);else if(bottom>list.scrollTop+height)list.scrollTop=bottom-height;setScrollTop(list.scrollTop);},[index,height]);
 const start=Math.max(0,Math.floor(scrollTop/ROW)-OVERSCAN);const end=Math.min(indices.length,Math.ceil((scrollTop+height)/ROW)+OVERSCAN);
 return <><div className="scene-filters" aria-label="シーンの絞り込み">
 <label>話者<select aria-label="話者フィルタ" value={JSON.stringify(filters.speaker)} onChange={e=>setFilters(f=>({...f,speaker:JSON.parse(e.target.value)}))}><option value="null">すべての話者</option><option value={'""'}>ナレーション</option>{speakers.map(s=><option key={s} value={JSON.stringify(s)}>{s}</option>)}{filters.speaker&&!speakers.includes(filters.speaker)&&<option value={JSON.stringify(filters.speaker)}>{filters.speaker}</option>}</select></label>
 <label>ボイス<select aria-label="ボイスフィルタ" value={filters.voice} onChange={e=>setFilters(f=>({...f,voice:e.target.value}))}><option value="all">すべて</option><option value="missing">ボイス未設定</option><option value="present">ボイス設定済み</option></select></label>
 <details open={filters.background!=='all'||filters.bgm!=='all'||undefined}><summary>背景・BGMの条件</summary>
 <label>背景画像<select aria-label="背景画像フィルタ" value={filters.background} onChange={e=>setFilters(f=>({...f,background:e.target.value}))}><option value="all">すべて</option><option value="present">画像あり（引き継ぎ含む）</option><option value="missing">画像なし</option><option value="inherit">前の画像を引き継ぐ</option><option value="custom">このシーンで画像を指定</option></select></label>
 <label>BGM<select aria-label="BGMフィルタ" value={filters.bgm} onChange={e=>setFilters(f=>({...f,bgm:e.target.value}))}><option value="all">すべて</option><option value="present">BGMあり（引き継ぎ含む）</option><option value="missing">BGMなし</option><option value="track">このシーンで曲を指定</option><option value="inherit">前のBGMを引き継ぐ</option><option value="stop">このシーンから停止</option></select></label>
 </details>
 <div className="filter-result"><span role="status">{indices.length} / {scenes.length} シーン</span><button disabled={!active} onClick={()=>setFilters(emptyFilters())}>条件をクリア</button></div>
 {active&&selected&&index<0&&<p className="filter-selection-note">編集中のシーンは絞り込み条件外です。</p>}
 </div><div ref={ref} className="scene-list virtual-scene-list" style={{height}} onScroll={e=>setScrollTop(e.currentTarget.scrollTop)} aria-label="シーン一覧スクロール">{!scenes.length?<p className="empty-list">最初のシーンを追加して、<br/>物語を始めましょう。</p>:!indices.length?<p className="empty-list">条件に合うシーンがありません。</p>:<div style={{height:indices.length*ROW+26,position:'relative'}}>{indices.slice(start,end).map((i,offset)=>{const position=start+offset;const s=scenes[i];const background=backgrounds[i];return <div key={s.id} data-scene-index={i} className={`scene-card ${s.id===selected?'selected':''}`} style={{...speakerCardStyle(colors,s.speaker),position:'absolute',top:13+position*ROW,left:12,right:12,height:82,margin:0}} draggable onDragStart={()=>{dragged.current=s.id;}} onDragEnd={()=>{dragged.current=null;}} onDragOver={e=>{e.preventDefault();const list=ref.current;if(!list)return;const bounds=list.getBoundingClientRect();if(e.clientY<bounds.top+45)list.scrollTop-=20;else if(e.clientY>bounds.bottom-45)list.scrollTop+=20;}} onDrop={e=>{e.preventDefault();if(dragged.current)onMove(dragged.current,i);dragged.current=null;}}><button className="scene-select" onClick={()=>onSelect(s.id)}><div className="scene-thumb">{background?<img src={background.image} alt="" loading="lazy" decoding="async"/>:<BookOpen size={22}/>}<span>{String(i+1).padStart(2,'0')}</span></div><div className="scene-summary"><strong>{s.speaker||'ナレーション'}</strong><p>{s.text||(background?'画像のみのシーン':'まだ何も書かれていません')}</p><small>{background?(s.imageMode==='inherit'?'画像を継続':'画像あり'):'画像なし'} · {Array.from(s.text).length}文字</small></div><GripVertical size={14} className="grip"/></button><div className="scene-reorder"><button aria-label={`シーン${i+1}を上へ`} disabled={i===0} onClick={()=>onMove(s.id,i-1)}><ChevronUp size={13}/></button><button aria-label={`シーン${i+1}を下へ`} disabled={i===scenes.length-1} onClick={()=>onMove(s.id,i+1)}><ChevronDown size={13}/></button></div></div>;})}</div>}</div></>;
});
