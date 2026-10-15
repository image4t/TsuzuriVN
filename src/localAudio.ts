import {activeProjectId,requireDesktop} from './desktop';
import type {Voice} from './model';
export async function voicesFromPaths(input:string):Promise<Voice[]>{
 const paths=input.split(/\r?\n/).map(s=>s.trim().replace(/^"(.*)"$/,'$1')).filter(Boolean);
 if(!paths.length)throw new Error('音声ファイルのフルパスを入力してください。');
 const projectId=activeProjectId;const voices:Voice[]=[];for(const path of paths){const media=await requireDesktop().importMedia(projectId,path,'audio');voices.push({id:crypto.randomUUID(),name:media.name,data:media.url});}return voices;
}
