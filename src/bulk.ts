import {sceneAfter,type Scene} from './model';
export type ScriptLine={id:number;lineNumber:number;text:string;separator:string;speaker:string|null;dialogue:boolean};
export type ScriptGroup={speaker:string|null;text:string;from:number;to:number;count:number};
export type BulkDraft={version:1;source:string;lines:ScriptLine[];speakers:string[];stage:'input'|'assign'};
export const emptyDraft=(speakers:string[]=[]):BulkDraft=>({version:1,source:'',lines:[],speakers,stage:'input'});
export function parseLines(source:string,narration=true):ScriptLine[]{
 const lines:ScriptLine[]=[];let blanks=0;
 source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n').forEach((text,index)=>{
  if(!text.trim()){blanks++;return;}
  const dialogue=/^[\s　]*[「『“"]/.test(text);
  lines.push({id:index,lineNumber:index+1,text,separator:'\n'.repeat(blanks+1),speaker:narration&&!dialogue?'':null,dialogue});blanks=0;
 });return lines;
}
export function groupLines(lines:ScriptLine[]):ScriptGroup[]{
 const groups:ScriptGroup[]=[];
 for(const line of lines){const last=groups.at(-1);if(last&&last.speaker===line.speaker){last.text+=line.separator+line.text;last.to=line.lineNumber;last.count++;}else groups.push({speaker:line.speaker,text:line.text,from:line.lineNumber,to:line.lineNumber,count:1});}
 return groups;
}
export function linesToScenes(lines:ScriptLine[],previous?:Scene):Scene[]{
 if(lines.some(line=>line.speaker===null))throw new Error('未指定の行に話者またはナレーションを割り当ててください。');
 return groupLines(lines).map(group=>sceneAfter(previous,{speaker:group.speaker!,text:group.text}));
}
