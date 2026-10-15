import {desktop,requireDesktop} from './desktop';
import {useEffect,useState} from 'react';
import {emptyProject,parseProject,type Project} from './model';
import {deleteScenario,loadScenario,listScenarios,newScenario,saveScenario,type SavedScenario} from './storage';
import Editor from './Editor';
import Library from './Library';
import {releaseAssetsExcept} from './assets';
export default function App(){
 const [records,setRecords]=useState<SavedScenario[]>([]);const [editing,setEditing]=useState<SavedScenario|null>(null);
 const [root,setRoot]=useState('');
 const [ready,setReady]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{if(editing||busy)return;const keep=new Set<string>();for(const record of records){const image=record.project.scenes.find(s=>s.image)?.image;if(image?.startsWith('asset:'))keep.add(image.slice(6));}releaseAssetsExcept(keep);},[editing,records,busy]);
 const refresh=async()=>{const [list,settings]=await Promise.all([listScenarios(),requireDesktop().settings()]);setRecords(list);setRoot(settings.root);};
 useEffect(()=>{if(!desktop){setError('TsuzuriVNデスクトップアプリで起動してください。旧ブラウザ版の作品はJSON / ZIPで移行できます。');setReady(true);return;}void requireDesktop().settings().then(settings=>{setRoot(settings.root);if(settings.storageWarning)setError(settings.storageWarning);}).catch(()=>{});let active=true;listScenarios().then(list=>{if(active)setRecords(list);}).catch(()=>{if(active)setError('保存済みシナリオを読み込めませんでした。保存先とアクセス権を確認してください。');}).finally(()=>{if(active)setReady(true);});return()=>{active=false;};},[]);
 const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'保存処理に失敗しました。');}finally{setBusy(false);}};
 const create=async(project=emptyProject())=>{const record=newScenario(project);await saveScenario(record);await refresh();setEditing(await loadScenario(record.id));};
 if(editing)return <Editor key={editing.id} id={editing.id} initialProject={editing.project} initialWarning={editing.warning} onHome={async()=>{await refresh();setEditing(null);}} onNew={()=>create()} onImport={project=>create(project)}/>;
 return <Library records={records} ready={ready} busy={busy} error={error} onDismiss={()=>setError('')}
  root={root} onOpenProject={()=>run(async()=>{const record=await requireDesktop().openProject();if(record){await refresh();setEditing(await loadScenario(record.id));}})} onSettingsChange={settings=>{setRoot(settings.root);void run(refresh);}} onNew={()=>run(()=>create())} onImport={project=>run(()=>create(project))}
  onEdit={record=>void run(async()=>{setEditing(await loadScenario(record.id));})}
  onRename={(record,title)=>run(async()=>{await saveScenario({...record,project:{...record.project,title},updatedAt:Date.now()});await refresh();})}
  onDuplicate={record=>run(async()=>{await requireDesktop().duplicate(record.id);await refresh();})}
  onDelete={record=>run(async()=>{await deleteScenario(record.id);await refresh();})}/>;
}
