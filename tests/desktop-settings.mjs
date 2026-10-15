import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const directory=await fs.mkdtemp(path.resolve('.desktop-test-settings-ui-'));
const env={...process.env,TSUZURI_TEST_USER_DATA:path.join(directory,'AppSettings'),TSUZURI_TEST_DOCUMENTS:path.join(directory,'TestInstall')};delete env.ELECTRON_RUN_AS_NODE;
let app=await electron.launch({args:['.'],env});
try{
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));const expectedRoot=path.join(directory,'TestInstall','UserData');
 await page.getByRole('button',{name:'設定',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'ダークモード',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'既定の保存先を変更',exact:true}).count(),0);
 let settings=await page.evaluate(()=>window.tsuzuri.settings());assert.equal(settings.root,expectedRoot);assert.equal(settings.defaultRoot,expectedRoot);assert.equal(settings.rootMode,'default');
 await page.getByRole('button',{name:'設定',exact:true}).click();await page.getByRole('dialog',{name:'設定',exact:true}).waitFor();await expect(page.getByLabel('現在の保存先')).toHaveText(expectedRoot);
 await page.getByRole('combobox',{name:'表示テーマ',exact:true}).selectOption('dark');await expect.poll(()=>page.evaluate(()=>window.tsuzuri.settings().then(s=>s.theme))).toBe('dark');assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
 const custom=path.join(directory,'新しい保存先');await fs.mkdir(custom);await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},custom);await page.getByRole('button',{name:'フォルダを変更',exact:true}).click();await expect(page.getByLabel('現在の保存先')).toHaveText(custom);await page.screenshot({path:'tests/desktop-settings.png'});await page.getByRole('button',{name:'閉じる',exact:true}).click();
 await page.getByRole('button',{name:'新規シナリオ',exact:true}).click();await page.getByRole('button',{name:'シーンを追加',exact:true}).first().click();await page.getByRole('textbox',{name:'本文',exact:true}).fill('設定したフォルダの作品');await page.locator('.voice-editor input[type=file]').setInputFiles(path.resolve('tests/fixtures/tone.mp3'));await page.locator('.voice-list li').waitFor();await page.getByText('自動保存済み',{exact:true}).waitFor();
 const record=(await page.evaluate(()=>window.tsuzuri.list()))[0];assert.ok(record.folder.startsWith(custom));assert.equal((await fs.readdir(path.join(record.folder,'assets'))).length,1);
 await page.getByRole('button',{name:'設定',exact:true}).click();await page.getByRole('button',{name:'既定に戻す',exact:true}).click();await expect(page.getByLabel('現在の保存先')).toHaveText(expectedRoot);
 const bad=path.join(directory,'not-a-directory.json');await fs.writeFile(bad,'{}');await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},bad);await page.getByRole('button',{name:'フォルダを変更',exact:true}).click();await page.getByRole('dialog').getByRole('alert').waitFor();assert.equal((await page.evaluate(()=>window.tsuzuri.settings())).root,expectedRoot);await page.getByRole('button',{name:'閉じる',exact:true}).click();
 await page.getByRole('button',{name:'保存・再試行',exact:true}).click();assert.ok((await fs.stat(path.join(record.folder,'scenario.json'))).isFile());
 await app.close();app=await electron.launch({args:['.'],env});const restored=await app.firstWindow();await restored.getByRole('button',{name:'設定',exact:true}).click();await expect(restored.getByRole('combobox',{name:'表示テーマ',exact:true})).toHaveValue('dark');await expect(restored.getByLabel('現在の保存先')).toHaveText(expectedRoot);assert.deepEqual(errors,[]);
 console.log('PASS: header gear on library/editor, native settings dialog, installation UserData default, shared project/assets destination, theme and folder persistence/reset, write failure and existing project preservation');
}finally{await app.close();}
