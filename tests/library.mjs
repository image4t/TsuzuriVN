import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let confirm=true;page.on('dialog',d=>confirm?d.accept():d.dismiss());
const url=process.env.VN_TEST_URL??'http://127.0.0.1:5175';
const card=title=>page.getByRole('article',{name:title,exact:true});
const home=async()=>{await page.getByRole('button',{name:'シナリオ一覧',exact:true}).click();await page.getByRole('heading',{name:'保存済みシナリオ',exact:true}).waitFor();};
try{
 await page.goto(url);await page.getByText('まだ、白紙の本棚。').waitFor();
 await page.getByRole('button',{name:'新規シナリオ',exact:true}).click();
 await page.getByRole('textbox',{name:'タイトル',exact:true}).fill('第一の物語');
 await page.getByRole('button',{name:'シーンを追加',exact:true}).first().click();
 await page.getByRole('textbox',{name:'本文'}).fill('保存を待たずに一覧へ戻っても残る文章。');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=','base64');
 await page.locator('input[type=file][accept^="image/png"]').nth(0).setInputFiles({name:'image.png',mimeType:'image/png',buffer:png});
 await page.getByAltText('選択した背景画像').waitFor();
 await home();await card('第一の物語').waitFor();assert.equal(await card('第一の物語').locator('img').count(),1);
 await card('第一の物語').getByRole('button',{name:'タイトル変更',exact:true}).click();
 await page.getByRole('textbox',{name:'シナリオのタイトル'}).fill('改題した物語');
 await page.getByRole('button',{name:'保存する',exact:true}).click();await card('改題した物語').waitFor();
 await card('改題した物語').getByRole('button',{name:'シナリオを複製',exact:true}).click();
 await card('改題した物語（コピー）').waitFor();assert.equal(await page.locator('.scenario-card').count(),2);
 await card('改題した物語（コピー）').getByRole('button',{name:'編集する',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'本文'}).inputValue(),'保存を待たずに一覧へ戻っても残る文章。');
 await page.getByAltText('選択した背景画像').waitFor();
 await page.getByRole('textbox',{name:'本文'}).fill('コピーだけの変更');await home();
 await card('改題した物語').getByRole('button',{name:'編集する',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'本文'}).inputValue(),'保存を待たずに一覧へ戻っても残る文章。');
 await page.getByRole('textbox',{name:'本文'}).fill('新規作成前に入力した内容');
 await page.getByRole('button',{name:'新規シナリオ',exact:true}).click();
 await page.locator('.empty-editor').waitFor();await page.getByRole('textbox',{name:'タイトル',exact:true}).fill('第三の物語');await home();
 assert.equal(await page.locator('.scenario-card').count(),3);
 await page.reload();await card('第三の物語').waitFor();assert.equal(await page.locator('.scenario-card').count(),3);
 await card('改題した物語').getByRole('button',{name:'編集する',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'本文'}).inputValue(),'新規作成前に入力した内容');await home();
 confirm=false;await card('第三の物語').getByRole('button',{name:'シナリオを削除',exact:true}).click();assert.equal(await page.locator('.scenario-card').count(),3);confirm=true;
 await card('第三の物語').getByRole('button',{name:'シナリオを削除',exact:true}).click();await card('第三の物語').waitFor({state:'detached'});
 await page.reload();await card('改題した物語').waitFor();assert.equal(await page.locator('.scenario-card').count(),2);
 const imported={version:1,title:'読み込んだ作品',typewriter:false,scenes:[{text:'日本語本文',speaker:'',image:null}]};
 await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'import.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
 await page.getByRole('textbox',{name:'本文'}).waitFor();await home();assert.equal(await page.locator('.scenario-card').count(),3);
 await page.screenshot({path:'tests/library.png',fullPage:true});
 await page.setViewportSize({width:820,height:1180});assert.equal(await page.locator('.scenario-card').count(),3);
 // Verify quota errors leave the original card intact and surface an error.
 await page.evaluate(()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('容量不足','QuotaExceededError');};});
 await card('改題した物語').getByRole('button',{name:'シナリオを複製',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('.scenario-card').count(),3);
 await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalPut;});
 // Seed the previous version and verify its single working scenario migrates once.
 await page.evaluate(async()=>{
  await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('tsuzuri-studio');r.onsuccess=resolve;r.onerror=reject;});
  await new Promise((resolve,reject)=>{const r=indexedDB.open('tsuzuri-studio',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onerror=reject;r.onsuccess=()=>{const db=r.result;const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put({version:1,title:'以前の作業データ',typewriter:false,scenes:[{id:'legacy',text:'移行しても残る文章',speaker:'以前の話者',image:null,imageName:''}]},'current');tx.oncomplete=()=>{db.close();resolve();};};});
 });
 await page.reload();await card('以前の作業データ').waitFor();assert.equal(await page.locator('.scenario-card').count(),1);
 await card('以前の作業データ').getByRole('button',{name:'編集する',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'本文'}).inputValue(),'移行しても残る文章');await home();
 await page.reload();await card('以前の作業データ').waitFor();assert.equal(await page.locator('.scenario-card').count(),1);
 await card('以前の作業データ').getByRole('button',{name:'シナリオを削除',exact:true}).click();await page.getByText('まだ、白紙の本棚。').waitFor();
 await page.reload();await page.getByText('まだ、白紙の本棚。').waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: library list, create, edit, immediate-save navigation, rename, independent duplicate with image, delete/cancel, persistence, import, quota error, legacy migration, empty library; no runtime errors');
}finally{await browser.close();}




