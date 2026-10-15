import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {unzipSync,strFromU8} from 'fflate';
const directory=await fs.mkdtemp(path.resolve('.desktop-test-compat-'));
const env={...process.env,TSUZURI_TEST_USER_DATA:path.join(directory,'userData'),TSUZURI_TEST_DOCUMENTS:path.join(directory,'Documents')};delete env.ELECTRON_RUN_AS_NODE;
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=';
const mp3=`data:audio/mpeg;base64,${(await fs.readFile('tests/fixtures/tone.mp3')).toString('base64')}`;
const source=path.join(directory,'legacy.json');await fs.writeFile(source,JSON.stringify({version:1,title:'互換性テスト',scenes:[{id:'legacy-1',text:'旧形式の日本語',speaker:'栞',image:png,voices:[{id:'v1',name:'tone.mp3',data:mp3}]},{id:'legacy-2',text:'2場面目',speaker:'',image:png}]}));
const app=await electron.launch({args:['.'],env});
try{
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.getByRole('button',{name:'新規シナリオ',exact:true}).click();await page.getByRole('button',{name:'シーンを追加',exact:true}).first().click();await page.getByRole('textbox',{name:'本文',exact:true}).fill('元の作品は保持');await page.getByText('自動保存済み',{exact:true}).waitFor();
 const original=(await page.evaluate(()=>window.tsuzuri.list()))[0];
 await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles(source);await page.waitForFunction(()=>document.querySelector('.project-settings input')?.value==='互換性テスト');
 const all=await page.evaluate(()=>window.tsuzuri.list());assert.equal(all.length,2);const imported=all.find(r=>r.id!==original.id);let doc=JSON.parse(await fs.readFile(path.join(imported.folder,'scenario.json'),'utf8'));assert.deepEqual(doc.project.scenes.map(s=>s.id),['legacy-1','legacy-2']);assert.equal(Object.keys(doc.assets).length,2);assert.equal((await fs.readdir(path.join(imported.folder,'assets'))).length,2);
 assert.equal(JSON.parse(await fs.readFile(path.join(original.folder,'scenario.json'),'utf8')).project.scenes[0].text,'元の作品は保持');
 const zip=path.join(directory,'compat.vn.zip');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},zip);await page.getByRole('button',{name:'ZIP保存',exact:true}).click();await expect.poll(async()=>{try{return(await fs.stat(zip)).size;}catch{return 0;}}).toBeGreaterThan(0);
 const archive=unzipSync(await fs.readFile(zip));const manifest=JSON.parse(strFromU8(archive['scenario.json']));assert.equal(manifest.format,'tsuzuri-project');assert.equal(manifest.assets.length,2);assert.deepEqual(manifest.project.scenes.map(s=>s.id),['legacy-1','legacy-2']);
 await page.locator('input[type=file][accept=".zip,application/zip"]').setInputFiles(zip);await expect.poll(async()=>await page.evaluate(()=>window.tsuzuri.list().then(r=>r.length))).toBe(3);
 await page.getByRole('button',{name:'シナリオ一覧',exact:true}).click();await page.getByRole('article',{name:'互換性テスト',exact:true}).first().getByRole('button',{name:'シナリオを複製',exact:true}).click();await page.getByRole('article',{name:'互換性テスト（コピー）',exact:true}).waitFor();
 const copy=(await page.evaluate(()=>window.tsuzuri.list())).find(r=>r.project.title==='互換性テスト（コピー）');assert.notEqual(copy.id,imported.id);assert.equal((await fs.readdir(path.join(copy.folder,'assets'))).length,2);
 const moved=path.join(directory,'移動した作品');await fs.rename(original.folder,moved);await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},moved);await page.getByRole('button',{name:'作品フォルダを開く',exact:true}).click();await page.getByRole('textbox',{name:'本文',exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'本文',exact:true}).inputValue(),'元の作品は保持');
 await page.getByRole('button',{name:'シナリオ一覧',exact:true}).click();const destination=path.join(directory,'別の保存先');await fs.mkdir(destination);await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},destination);await page.getByRole('button',{name:'設定',exact:true}).click();await page.getByRole('button',{name:'フォルダを変更',exact:true}).click();await page.getByRole('button',{name:'閉じる',exact:true}).click();await page.getByRole('button',{name:'新規シナリオ',exact:true}).click();await page.getByRole('button',{name:'シーンを追加',exact:true}).first().waitFor();
 const last=(await page.evaluate(()=>window.tsuzuri.list())).find(r=>r.folder.startsWith(destination));assert.ok(last);assert.deepEqual(errors,[]);
 console.log('PASS: legacy JSON -> native folder, deduplicated image/audio, scene IDs, original preservation, vn.zip export/import, independent native duplicate, moved project opening and custom save root');
}finally{await app.close();}
