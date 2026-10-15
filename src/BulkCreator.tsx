import {readInputBytes,readInputText} from './desktop';
import {desktop,registerFlusher} from './desktop';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,Plus,Search,Undo2,Upload,X} from 'lucide-react';
import {emptyDraft,groupLines,parseLines,type BulkDraft,type ScriptLine} from './bulk';
import {loadDraft,saveDraft} from './storage';
import type {SpeakerColors} from './model';
import {speakerCardStyle} from './speakerStyles';
import SpeakerColorSettings from './SpeakerColorSettings';
const PAGE_SIZE=100;
type Props={scenarioId:string;speakers:string[];speakerColors:SpeakerColors;onColorsChange:(colors:SpeakerColors)=>void;canInsert:boolean;onClose:()=>void;onCommit:(lines:ScriptLine[],location:'end'|'after')=>Promise<void>};
export default function BulkCreator({scenarioId,speakers,speakerColors,onColorsChange,canInsert,onClose,onCommit}:Props){
 const dialog=useRef<HTMLDialogElement>(null);const lineList=useRef<HTMLDivElement>(null);const file=useRef<HTMLInputElement>(null);
 const [draft,setDraft]=useState<BulkDraft>(()=>emptyDraft(speakers));const latest=useRef(draft);latest.current=draft;
 const [closeFailed,setCloseFailed]=useState(false);const [ready,setReady]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [status,setStatus]=useState('読み込み中…');
 const [narration,setNarration]=useState(true);const [name,setName]=useState('');const [selected,setSelected]=useState<Set<number>>(new Set());const anchor=useRef<number|null>(null);
 const [filter,setFilter]=useState<'all'|'unset'|'dialogue'>('all');const [query,setQuery]=useState('');const [page,setPage]=useState(0);const [autoNext,setAutoNext]=useState(true);const [location,setLocation]=useState<'end'|'after'>('end');
 const history=useRef<ScriptLine[][]>([]);const [undoCount,setUndoCount]=useState(0);const [previewCount,setPreviewCount]=useState(20);
 const chain=useRef(Promise.resolve());const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const revision=useRef(0);const saved=useRef(0);
 useEffect(()=>{const activeElement=document.activeElement;const modal=dialog.current;modal?.showModal();return()=>{modal?.close();if(activeElement instanceof HTMLElement)activeElement.focus();};},[]);
 useEffect(()=>{let active=true;loadDraft(scenarioId).then(value=>{if(active&&value?.version===1)setDraft(value);}).catch(()=>{if(active)setError('下書きを読み込めませんでした。文章を貼り付けて続行できます。');}).finally(()=>{if(active)setReady(true);});return()=>{active=false;};},[scenarioId]);
 useEffect(()=>{
  if(!ready)return;const rev=++revision.current;setStatus('下書きを保存中…');
  timer.current=setTimeout(()=>{const snapshot=draft;chain.current=chain.current.catch(()=>{}).then(()=>saveDraft(scenarioId,snapshot)).then(()=>{saved.current=rev;if(revision.current===rev)setStatus('下書き保存済み');}).catch(()=>{setStatus('下書き保存失敗');setError('下書きを保存できませんでした。容量を確認してください。入力内容をコピーするか、シーンに変換してJSONで保存してください。');});},350);
  return()=>{if(timer.current)clearTimeout(timer.current);};
 },[draft,ready,scenarioId]);
 useEffect(()=>{const leave=(e:BeforeUnloadEvent)=>{if(!desktop&&saved.current<revision.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);},[]);
 const flush=async()=>{if(!ready)throw new Error('下書きを読み込み中です。少し待ってから再試行してください。');if(timer.current)clearTimeout(timer.current);await chain.current.catch(()=>{});await saveDraft(scenarioId,latest.current);saved.current=revision.current;};
 useEffect(()=>registerFlusher('bulk',flush));
 const close=async()=>{setBusy(true);try{await flush();onClose();}catch{setCloseFailed(true);setStatus('下書き保存失敗');setError('下書きを保存できませんでした。入力内容をコピーして保管してください。');}finally{setBusy(false);}};
 const knownSpeakers=useMemo(()=>Array.from(new Set([...speakers,...draft.speakers,...draft.lines.map(line=>line.speaker).filter((s):s is string=>!!s)])),[speakers,draft.speakers,draft.lines]);
 const groups=useMemo(()=>groupLines(draft.lines),[draft.lines]);const unset=draft.lines.filter(line=>line.speaker===null).length;
 const filtered=useMemo(()=>draft.lines.filter(line=>(filter!=='unset'||line.speaker===null)&&(filter!=='dialogue'||line.dialogue)&&(!query||line.text.toLocaleLowerCase().includes(query.toLocaleLowerCase())||line.speaker?.toLocaleLowerCase().includes(query.toLocaleLowerCase()))),[draft.lines,filter,query]);
 const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));const currentPage=Math.min(page,pageCount-1);const displayed=filtered.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE);
 useEffect(()=>{lineList.current?.scrollTo({top:0});},[currentPage,filter,query,draft.stage]);
 useEffect(()=>{if(selected.size===1){const id=Array.from(selected)[0];lineList.current?.querySelector(`[data-line="${id+1}"]`)?.scrollIntoView({block:'nearest'});}},[selected,currentPage,filter]);
 const prepare=()=>{
  const parsed=parseLines(draft.source,narration);if(!parsed.length){setError('文章を入力してください。');return;}
  const previous=new Map(draft.lines.map(line=>[line.id,line]));
  const lines=parsed.map(line=>{const old=previous.get(line.id);return old?.text===line.text?{...line,speaker:old.speaker}:line;});
  setDraft(d=>({...d,lines,stage:'assign'}));history.current=[];anchor.current=null;setUndoCount(0);setSelected(new Set());setPage(0);setFilter('all');setQuery('');setError('');
 };
 const changeLines=(lines:ScriptLine[])=>{history.current=[...history.current.slice(-19),draft.lines];setUndoCount(history.current.length);setDraft(d=>({...d,lines}));};
 const jump=(lines:ScriptLine[],after=-1)=>{
  const pending=lines.filter(line=>line.speaker===null);const next=pending.find(line=>line.id>after)??pending[0];
  if(!next){setSelected(new Set());return;}
  setFilter('unset');setQuery('');setPage(Math.floor(pending.findIndex(line=>line.id===next.id)/PAGE_SIZE));setSelected(new Set([next.id]));anchor.current=next.id;
 };
 const assign=(speaker:string|null)=>{
  if(!selected.size)return;const lines=draft.lines.map(line=>selected.has(line.id)?{...line,speaker}:line);changeLines(lines);
  if(autoNext&&speaker!==null)jump(lines,Array.from(selected).reduce((last,id)=>Math.max(last,id),-1));else setSelected(new Set());
 };
 const toggle=(id:number,shift:boolean)=>{
  const anchorId=anchor.current;
  setSelected(previous=>{const next=new Set(previous);const include=!previous.has(id);const targets=shift&&anchorId!==null?filtered.filter(line=>line.id>=Math.min(id,anchorId)&&line.id<=Math.max(id,anchorId)).map(line=>line.id):[id];for(const target of targets)include?next.add(target):next.delete(target);return next;});anchor.current=id;
 };
 const undo=()=>{const previous=history.current.pop();if(previous){setDraft(d=>({...d,lines:previous}));setUndoCount(history.current.length);anchor.current=null;setSelected(new Set());setFilter('all');setQuery('');setPage(0);}};
 const addNames=()=>{const names=name.split(/[、,，\n]/).map(n=>n.trim()).filter(Boolean);if(names.length){setDraft(d=>({...d,speakers:Array.from(new Set([...knownSpeakers,...names]))}));setName('');}};
 const commit=async()=>{
  if(unset||!draft.lines.length)return;setBusy(true);setError('');
  try{await flush();await onCommit(draft.lines,location);}catch(e){setError(e instanceof Error?e.message:'シーンを保存できませんでした。');}finally{setBusy(false);}
 };
 return <dialog ref={dialog} className="bulk-dialog" aria-labelledby="bulk-title" onCancel={e=>{e.preventDefault();if(!busy&&ready)void close();}} onKeyDown={e=>{if(!busy&&!e.repeat&&draft.stage==='assign'&&e.altKey&&/^[1-9]$/.test(e.key)&&selected.size&&!(e.target instanceof HTMLInputElement&&e.target.type==='text')){const index=Number(e.key)-1;const speaker=index===0?'':knownSpeakers[index-1];if(speaker!==undefined){e.preventDefault();assign(speaker);}}}}>
 <header className="bulk-header"><div><span className="eyebrow">TEXT TO SCENES</span><h2 id="bulk-title">文章から、まとめてシーンを作る</h2></div><div><span className="bulk-save" role="status">{status}</span><button aria-label="まとめて作成を閉じる" disabled={!ready||busy} onClick={()=>void close()}><X size={20}/></button></div></header>
 <div className="bulk-steps"><span className={draft.stage==='input'?'active':''}>01　文章を取り込む</span><ArrowRight size={14}/><span className={draft.stage==='assign'?'active':''}>02　話者を割り当てる</span></div>
 {error&&<div className="error" role="alert">{error}{closeFailed&&<button onClick={onClose}>保存せずに閉じる</button>}<button aria-label="下書きエラーを閉じる" onClick={()=>setError('')}><X size={15}/></button></div>}
 {!ready?<div className="library-empty">下書きを読み込んでいます…</div>:<div className="bulk-body" inert={busy}>{draft.stage==='input'?<div className="bulk-source"><div className="bulk-source-heading"><div><h3>長い文章も、ひとまとめに。</h3><p>改行ごとに話者を指定できます。同じ話者が続く行は、1つのシーンにまとまります。</p></div><button onClick={()=>file.current?.click()}><Upload size={15}/>TXTを取り込む</button></div><label className="field-label">原稿<textarea aria-label="まとめて作成する原稿" value={draft.source} onChange={e=>setDraft(d=>({...d,source:e.target.value}))} placeholder={'文章をここに貼り付けてください。\n\n川面が、夕日に染まっていた。\n「はあ……。なんか、こういうのもいいね」\n「何が？」'}/></label><label className="bulk-check"><input type="checkbox" checked={narration} onChange={e=>setNarration(e.target.checked)}/>「」などで始まるセリフ以外は、ナレーションを自動指定</label><p className="field-note">セリフの話者は自動推測せず、あなたが指定します。下書きは作品ごとに保存されます。</p></div>:<>
 <div className="bulk-toolbar"><div className="bulk-speaker-entry"><label>登場人物を登録<input aria-label="登場人物名" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addNames();}}} placeholder="例：純一、詞（複数指定可）"/></label><button disabled={!name.trim()} onClick={addNames}><Plus size={15}/>登録</button></div><div className="bulk-assign"><span>{selected.size}行を選択中</span><button style={speakerCardStyle(speakerColors,'')} disabled={!selected.size} onClick={()=>assign('')}><span className="speaker-dot" aria-hidden="true"/>ナレーション <kbd>Alt+1</kbd></button>{knownSpeakers.map((speaker,index)=><button key={speaker} style={speakerCardStyle(speakerColors,speaker)} disabled={!selected.size} onClick={()=>assign(speaker)}><span className="speaker-dot" aria-hidden="true"/>{speaker}{index<8&&<kbd>Alt+{index+2}</kbd>}</button>)}<button disabled={!selected.size} onClick={()=>assign(null)}>未指定に戻す</button><button disabled={!undoCount} aria-label="話者の割り当てを元に戻す" onClick={undo}><Undo2 size={14}/>元に戻す</button></div><details className="bulk-color-options"><summary>話者の文字色を設定</summary><SpeakerColorSettings speakers={knownSpeakers} colors={speakerColors} onChange={onColorsChange}/></details><div className="bulk-tools-note"><span>チェックで複数行を選択・Shiftで範囲選択</span><label className="bulk-check"><input type="checkbox" checked={autoNext} onChange={e=>setAutoNext(e.target.checked)}/>一括指定後、次の未指定行を選ぶ</label></div></div>
 <div className="bulk-grid"><section className="bulk-lines-panel"><div className="bulk-filter"><div><button className={filter==='all'?'active':''} onClick={()=>{setFilter('all');setPage(0);}}>全行 {draft.lines.length}</button><button className={filter==='unset'?'active':''} onClick={()=>{setFilter('unset');setPage(0);}}>未指定 {unset}</button><button className={filter==='dialogue'?'active':''} onClick={()=>{setFilter('dialogue');setPage(0);}}>セリフ</button></div><label><Search size={14}/><input aria-label="行の検索" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="本文・話者を検索"/></label></div>
 <div className="bulk-selection"><button disabled={!filtered.length} onClick={()=>setSelected(new Set(filtered.map(line=>line.id)))}>絞り込み全行を選択（{filtered.length}）</button><button disabled={!selected.size} onClick={()=>setSelected(new Set())}>選択解除</button><button disabled={!unset} onClick={()=>jump(draft.lines,anchor.current??-1)}>次の未指定へ</button></div>
 <div className="bulk-line-head"><input aria-label="表示中の行をすべて選択" type="checkbox" checked={displayed.length>0&&displayed.every(line=>selected.has(line.id))} onChange={e=>{const checked=e.target.checked;setSelected(previous=>{const next=new Set(previous);for(const line of displayed)checked?next.add(line.id):next.delete(line.id);return next;});}}/><span>行</span><span>本文</span><span>話者</span></div>
 <div className="bulk-lines" ref={lineList}>{displayed.map(line=><div key={line.id} className={`bulk-line ${selected.has(line.id)?'selected':''} ${line.speaker===null?'unassigned':''}`} style={speakerCardStyle(speakerColors,line.speaker)} data-line={line.lineNumber}><input aria-label={`行${line.lineNumber}を選択`} type="checkbox" checked={selected.has(line.id)} onClick={e=>toggle(line.id,e.shiftKey)} onChange={()=>{}}/><span className="line-number">{line.lineNumber}</span><p>{line.text}</p><select aria-label={`行${line.lineNumber}の話者`} value={JSON.stringify(line.speaker)} onChange={e=>changeLines(draft.lines.map(l=>l.id===line.id?{...l,speaker:JSON.parse(e.target.value) as string|null}:l))}><option value="null">未指定</option><option value={'""'}>ナレーション</option>{knownSpeakers.map(speaker=><option key={speaker} value={JSON.stringify(speaker)}>{speaker}</option>)}</select></div>)}{!displayed.length&&<div className="bulk-no-lines">{filter==='unset'&&unset===0?'すべての行に話者が指定されました。':'条件に一致する行がありません。'}</div>}</div>
 <div className="bulk-page-controls"><span>{filtered.length}行中 {filtered.length?currentPage*PAGE_SIZE+1:0}〜{Math.min((currentPage+1)*PAGE_SIZE,filtered.length)}行</span><button aria-label="行一覧の前のページ" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}><ArrowLeft size={14}/></button><span>{currentPage+1} / {pageCount}</span><button aria-label="行一覧の次のページ" disabled={currentPage>=pageCount-1} onClick={()=>setPage(currentPage+1)}><ArrowRight size={14}/></button></div></section>
 <aside className="bulk-preview"><div><h3>シーン構成プレビュー</h3><p>{draft.lines.length}行 → <strong>{groups.length}シーン</strong></p><small>{unset?`未指定の${unset}行を割り当ててください。`:'すべての話者を指定済みです。'}</small></div><div className="bulk-preview-list">{groups.slice(0,previewCount).map((group,index)=><article key={index} style={speakerCardStyle(speakerColors,group.speaker)}><span className="speaker-dot" aria-hidden="true"/><header><span>{String(index+1).padStart(2,'0')}</span><strong>{group.speaker===null?'未指定':group.speaker||'ナレーション'}</strong></header><p>{group.text.slice(0,240)}{group.text.length>240?'…':''}</p><small>行{group.from}{group.to!==group.from?`〜${group.to}`:''} · {group.count}行を結合</small></article>)}{groups.length>previewCount&&<button onClick={()=>setPreviewCount(n=>n+20)}>次の20シーンを表示</button>}</div></aside></div>
 </>}</div>}
 <footer className="bulk-footer"><div>{draft.stage==='assign'?<button disabled={busy} onClick={()=>setDraft(d=>({...d,stage:'input'}))}><ArrowLeft size={14}/>原稿へ戻る</button>:<span>原稿と話者の指定は、閉じても下書きに残ります。</span>}</div><div>{draft.stage==='assign'?<><label>追加位置<select aria-label="シーンの追加位置" value={location} disabled={busy} onChange={e=>setLocation(e.target.value as 'end'|'after')}><option value="end">シナリオの末尾</option>{canInsert&&<option value="after">選択中のシーンの後</option>}</select></label><button className="primary" disabled={busy||!ready||!!unset||!draft.lines.length} onClick={()=>void commit()}><Check size={16}/>{groups.length}シーンを追加</button></>:<button className="primary" disabled={!ready||busy||!draft.source.trim()} onClick={prepare}>行ごとに話者を指定<ArrowRight size={16}/></button>}</div></footer>
 <input hidden ref={file} type="file" accept=".txt,text/plain" onChange={e=>{const selectedFile=e.target.files?.[0];e.target.value='';if(selectedFile){setBusy(true);setError('');void selectedFile.arrayBuffer().then(bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes)).then(source=>setDraft(d=>({...d,source}))).catch(()=>setError('UTF-8のTXTファイルを読み込めませんでした。')).finally(()=>setBusy(false));}}}/>
 </dialog>;
}



