import type {Background,Scene} from './model';

export type SceneFilters={speaker:string|null;voice:string;background:string;bgm:string};
export const emptyFilters=():SceneFilters=>({speaker:null,voice:'all',background:'all',bgm:'all'});
export function filteredSceneIndices(scenes:Scene[],backgrounds:(Background|null)[],filters:SceneFilters):number[]{
 let bgmPlaying=false;
 const indices:number[]=[];
 scenes.forEach((s,i)=>{
  if(s.bgm.mode==='track')bgmPlaying=true;
  else if(s.bgm.mode==='stop')bgmPlaying=false;
  const speaker=s.speaker.trim()?s.speaker:'';
  if(filters.speaker!==null&&speaker!==filters.speaker)return;
  if(filters.voice==='missing'&&s.voices.length>0||filters.voice==='present'&&s.voices.length===0)return;
  if(filters.background==='present'&&!backgrounds[i]||filters.background==='missing'&&backgrounds[i])return;
  if(filters.background==='inherit'&&s.imageMode!=='inherit'||filters.background==='custom'&&s.imageMode!=='custom')return;
  if(filters.bgm==='present'&&!bgmPlaying||filters.bgm==='missing'&&bgmPlaying)return;
  if(filters.bgm==='track'&&s.bgm.mode!=='track'||filters.bgm==='inherit'&&s.bgm.mode!=='inherit'||filters.bgm==='stop'&&s.bgm.mode!=='stop')return;
  indices.push(i);
 });
 return indices;
}
