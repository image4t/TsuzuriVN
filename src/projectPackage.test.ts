import {describe,it,expect} from 'vitest';
import {zipSync,unzipSync,strFromU8,strToU8} from 'fflate';
import {emptyProject,scene} from './model';
import {createProjectPackage,readProjectPackage} from './projectPackage';
import {blobDataUrl,legacyProject} from './assets';
describe('binary project package',()=>{
 it('stores repeated image/voice/BGM data once and restores every scene',async()=>{
  const image='data:image/png;base64,YWJj';const audio='data:audio/wav;base64,ZGVm';const voice={id:'v',name:'a.wav',data:audio};
  const project={...emptyProject(),title:'日本語',scenes:[scene({image,voices:[voice],bgm:{mode:'track',track:voice}}),scene({image,voices:[voice]}),scene()]};
  const zip=await createProjectPackage(project);const files=unzipSync(zip);const manifest=JSON.parse(strFromU8(files['scenario.json']));expect(manifest.assets).toHaveLength(2);expect(manifest.project.scenes[0].image).toMatch(/^asset:/);expect(strFromU8(files['scenario.json'])).not.toContain('base64');
  const restored=await readProjectPackage(zip);expect(restored.scenes).toHaveLength(3);const legacy=await legacyProject(restored,async()=>{throw new Error('not cached');});expect(legacy.scenes[0].image).toBe(image);expect(legacy.scenes[0].voices[0].data).toBe(audio);expect(legacy.scenes[1].image).toBe(image);
 });
 it('rejects missing and changed assets',async()=>{
  const zip=await createProjectPackage({...emptyProject(),scenes:[scene({image:'data:image/png;base64,YWJj'})]});const files=unzipSync(zip);const manifest=JSON.parse(strFromU8(files['scenario.json']));
  files[manifest.assets[0].file]=strToU8('modified');await expect(readProjectPackage(zipSync(files))).rejects.toThrow('変わ');
  delete files[manifest.assets[0].file];await expect(readProjectPackage(zipSync(files))).rejects.toThrow('不足');
 });
 it('can encode blobs without altering bytes',async()=>expect(await blobDataUrl(new Blob(['hello'],{type:'audio/mpeg'}))).toBe('data:audio/mpeg;base64,aGVsbG8='));
});
