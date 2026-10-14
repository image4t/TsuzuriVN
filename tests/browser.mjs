import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
try{
 await page.goto(process.env.VN_TEST_URL ?? 'http://127.0.0.1:5175');
 await page.getByRole('button',{name:'新規シナリオ'}).click();
 await page.getByRole('button',{name:'再生する',exact:true}).click();
 await page.getByText('まだ、白紙の物語。').waitFor();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'シーンを追加',exact:true}).first().click();
 await page.getByRole('textbox',{name:/^話者名/}).fill('栞');
 await page.getByRole('textbox',{name:'本文'}).fill('最初の場面\n日本語の文章です。');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=','base64');
 await page.locator('input[type=file][accept^="image/png"]').nth(0).setInputFiles({name:'test.png',mimeType:'image/png',buffer:png});
 await page.getByAltText('選択した背景画像').waitFor();
 await page.getByRole('button',{name:'シーンを複製',exact:true}).click();
 await page.getByRole('textbox',{name:'本文'}).fill('第二の場面');
 await page.getByRole('button',{name:'シーン2を上へ'}).click();
 assert.equal(await page.locator('.scene-summary p').first().textContent(),'第二の場面');
 await page.getByRole('button',{name:'シーン1を下へ'}).click();
 await page.getByRole('button',{name:'シーンを追加',exact:true}).first().click();
 await page.getByRole('textbox',{name:'本文'}).fill('削除対象');
 await page.getByRole('button',{name:'シーンを削除',exact:true}).click();
 assert.equal(await page.locator('.scene-card').count(),2);
 await page.locator('input[type=file][accept=".txt,text/plain"]').setInputFiles({name:'story.txt',mimeType:'text/plain',buffer:Buffer.from('第三の場面\n\n第四の場面','utf8')});
 await page.locator('.scene-card').nth(3).waitFor();
 await page.getByText('自動保存済み',{exact:true}).waitFor();await page.reload();
 await page.getByRole('button',{name:'編集する',exact:true}).first().click();
 await page.locator('.scene-card').nth(3).waitFor();
 assert.equal(await page.locator('.scene-summary p').first().textContent(),'最初の場面\n日本語の文章です。');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'書き出す',exact:true}).click();const download=await downloadPromise;const path=await download.path();const exported=JSON.parse(await fs.readFile(path,'utf8'));assert.equal(exported.scenes.length,4);assert.ok(exported.scenes[0].image.startsWith('data:image/png'));
 await page.getByRole('button',{name:'新規シナリオ'}).click();
 await page.locator('.empty-editor').waitFor();
 await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 await page.locator('.scene-card').nth(3).waitFor();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'再生する',exact:true}).click();
 await page.keyboard.press('Enter');assert.equal(await page.locator('.dialogue > .dialogue-text').textContent(),exported.scenes[0].text);
 await page.keyboard.press('Space');await page.getByText('2 / 4',{exact:true}).waitFor();
 await page.keyboard.press('ArrowLeft');await page.getByText('1 / 4',{exact:true}).waitFor();
 await page.keyboard.press('Enter');await page.locator('.game').click({position:{x:40,y:40}});await page.getByText('2 / 4',{exact:true}).waitFor();
 await page.getByRole('button',{name:'次へ',exact:true}).click();await page.getByRole('button',{name:'次へ',exact:true}).click();await page.getByText('3 / 4',{exact:true}).waitFor();
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.getByText('4 / 4',{exact:true}).waitFor();
 for(let i=0;i<3 && await page.getByRole('button',{name:'次へ',exact:true}).isEnabled();i++)await page.getByRole('button',{name:'次へ',exact:true}).click();await page.getByText('物語の、その先へ。').waitFor();
 await page.getByRole('button',{name:'最初から読む'}).click();await page.getByText('1 / 4',{exact:true}).waitFor();await page.keyboard.press('Escape');
 await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"version":2}')});await page.getByRole('alert').waitFor();assert.equal(await page.locator('.scene-card').count(),4);
 await page.getByRole('button',{name:'エラーを閉じる'}).click();
 await page.screenshot({path:'tests/editor.png',fullPage:true});
 await page.setViewportSize({width:820,height:1180});assert.ok(await page.locator('.editor-panel').isVisible());
 assert.deepEqual(errors,[]);console.log('PASS: empty/new, edit, add, clone, reorder, delete, image, TXT, autosave/restore, JSON roundtrip, typewriter, keys/clicks, ending/restart, invalid import, tablet; no runtime errors');
}finally{await browser.close();}





