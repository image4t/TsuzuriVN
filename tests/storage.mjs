import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage();page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message));
const card=title=>page.getByRole('article',{name:title,exact:true});
try{
 await page.goto(process.env.VN_TEST_URL??'http://127.0.0.1:5175');await page.getByRole('heading',{name:'保存済みシナリオ',exact:true}).waitFor();
 await page.evaluate(async()=>{
  await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('tsuzuri-studio');r.onsuccess=resolve;r.onerror=reject;});
  await new Promise((resolve,reject)=>{const r=indexedDB.open('tsuzuri-studio',2);r.onupgradeneeded=()=>{r.result.createObjectStore('scenarios',{keyPath:'id'});r.result.createObjectStore('projects');};r.onerror=reject;r.onsuccess=()=>{const db=r.result;const tx=db.transaction(['scenarios','projects'],'readwrite');const project=title=>({version:1,title,typewriter:false,scenes:[{id:'scene',text:'既存の本文',speaker:'既存話者',image:null,imageName:'',voices:[],bgm:{mode:'inherit'}}]});for(const [id,title] of [['old-a','v2作品A'],['old-b','v2作品B']])tx.objectStore('scenarios').put({id,project:project(title),createdAt:1,updatedAt:2});tx.objectStore('projects').put(project('再移行しない旧キー'),'current');tx.oncomplete=()=>{db.close();resolve();};};});
 });
 await page.reload();await card('v2作品A').waitFor();assert.equal(await page.locator('.scenario-card').count(),2);
 await card('v2作品A').getByRole('button',{name:'編集する',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'本文'}).inputValue(),'既存の本文');
 await page.getByRole('button',{name:'文章からまとめて作成'}).click();await page.getByRole('textbox',{name:'まとめて作成する原稿'}).fill('Aだけの下書き');await page.getByRole('button',{name:'まとめて作成を閉じる'}).click();
 await page.getByRole('button',{name:'シナリオ一覧',exact:true}).click();await card('v2作品B').getByRole('button',{name:'編集する',exact:true}).click();
 await page.getByRole('button',{name:'文章からまとめて作成'}).click();await page.getByRole('textbox',{name:'まとめて作成する原稿'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'まとめて作成する原稿'}).inputValue(),'');await page.getByRole('button',{name:'まとめて作成を閉じる'}).click();
 await page.getByRole('button',{name:'シナリオ一覧',exact:true}).click();await card('v2作品A').getByRole('button',{name:'シナリオを削除',exact:true}).click();await card('v2作品A').waitFor({state:'detached'});
 const drafts=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('tsuzuri-studio');r.onsuccess=()=>resolve(r.result);});const tx=db.transaction('drafts','readonly');const request=tx.objectStore('drafts').getAllKeys();return await new Promise(resolve=>{tx.oncomplete=()=>{db.close();resolve(request.result);};});});
 assert.deepEqual(drafts,['old-b']);await page.reload();await card('v2作品B').waitFor();assert.equal(await page.locator('.scenario-card').count(),1);assert.deepEqual(errors,[]);
 console.log('PASS: v2→v3 storage upgrade preserves works, does not reimport legacy keys, isolates drafts per work and deletes draft with work; no runtime errors');
}finally{await browser.close();}

