import fs from 'node:fs/promises';
import path from 'node:path';
import {parseProject} from '../src/model.ts';
import {createProjectPackage} from '../src/projectPackage.ts';
const input=process.argv[2];const output=process.argv[3];
if(!input||!output){console.error('Usage: node scripts/convert-project.mjs input.json output.vn.zip');process.exit(1);}
const project=parseProject(JSON.parse(await fs.readFile(input,'utf8')));const bytes=await createProjectPackage(project);
await fs.writeFile(output,bytes,{flag:'wx'});
console.log(JSON.stringify({input:path.resolve(input),output:path.resolve(output),scenes:project.scenes.length,inputBytes:(await fs.stat(input)).size,outputBytes:bytes.byteLength},null,2));
