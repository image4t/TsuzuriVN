import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const directory=await fs.mkdtemp(path.resolve('.desktop-test-packaged-'));
const env={...process.env,TSUZURI_TEST_USER_DATA:path.join(directory,'userData'),TSUZURI_TEST_DOCUMENTS:path.join(directory,'Documents')};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:path.resolve('release/win-unpacked/TsuzuriVN.exe'),args:[],env,timeout:30000});
try{
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));assert.ok(page.url().startsWith('tsuzuri-app://app/'));
 const preferences=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];const p=w.webContents.getLastWebPreferences();return {nodeIntegration:p.nodeIntegration,contextIsolation:p.contextIsolation,sandbox:p.sandbox};});assert.deepEqual(preferences,{nodeIntegration:false,contextIsolation:true,sandbox:true});
 assert.equal(await page.evaluate(()=>typeof require),'undefined');
 await page.getByRole('button',{name:'新規シナリオ',exact:true}).click();await page.getByRole('button',{name:'シーンを追加',exact:true}).first().click();await page.getByRole('textbox',{name:'本文',exact:true}).fill('配布版だけで作成・保存');await page.getByText('自動保存済み',{exact:true}).waitFor();
 const records=await page.evaluate(()=>window.tsuzuri.list());assert.equal(records.length,1);assert.equal(JSON.parse(await fs.readFile(path.join(records[0].folder,'scenario.json'),'utf8')).project.scenes[0].text,'配布版だけで作成・保存');
 await page.getByRole('button',{name:'このシーンから再生'}).click();assert.equal(await page.locator('.dialogue > .dialogue-text').textContent(),'配布版だけで作成・保存');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'設定',exact:true}).click();await page.getByRole('combobox',{name:'表示テーマ',exact:true}).selectOption('dark');await expect.poll(()=>page.evaluate(()=>window.tsuzuri.settings().then(s=>s.theme))).toBe('dark');assert.deepEqual(errors,[]);
 console.log('PASS: packaged executable launches app.asar without Vite, isolated sandboxed preload, new/edit/save/play and userData theme settings');
}finally{await app.close();}
