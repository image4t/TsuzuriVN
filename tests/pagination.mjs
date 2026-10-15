import {openMenu,closeMenu,readProgress,playbackAction} from './playback-menu.mjs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const longText=('「長い文章も、同じウィンドウで読み進めます。」🌸👨‍👩‍👧‍👦\nこれは日本語の改行と句読点を含む文章です。\n\n').repeat(12)+'最後の一文。';
try{
 await page.goto(process.env.VN_TEST_URL ?? 'http://127.0.0.1:5175');
 await page.getByRole('button',{name:'新規シナリオ',exact:true}).click();
 await page.locator('.empty-editor').waitFor();
 await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'pages.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,title:'ページ送りテスト',typewriter:false,scenes:[{text:longText,speaker:'栞',image:null},{text:'次のシーン',speaker:'',image:null}]}))});
 await page.locator('.scene-card').nth(1).waitFor();
 await page.getByRole('button',{name:'再生する',exact:true}).click();
 const text=page.locator('.dialogue > .dialogue-text');
 const dimensions=()=>page.locator('.dialogue').evaluate(e=>({width:e.clientWidth,height:e.clientHeight}));
 const size=await dimensions();assert.equal(size.height,238);
 const pages=[];
 const pageCount=Number((await readProgress(page)).match(/\/ (\d+)/)[1]);assert.ok(pageCount>1);
 for(let i=0;i<pageCount;i++){
  assert.equal(await readProgress(page),`${i+1} / ${pageCount} ページ`);
  pages.push(await text.textContent());
  assert.deepEqual(await dimensions(),size);
  assert.ok(await text.evaluate(e=>e.scrollHeight<=e.clientHeight),'page must fit four lines');
  await page.locator('.game').click({position:{x:35,y:35}});
 }
 assert.equal(pages.join(''),longText,'no text lost or duplicated');
 assert.equal(await text.textContent(),'次のシーン');
 await page.keyboard.press('ArrowLeft');assert.equal(await text.textContent(),pages.at(-1));
 await playbackAction(page,'戻る');assert.equal(await text.textContent(),pages.at(-2));
 await page.keyboard.press('ArrowRight');assert.equal(await text.textContent(),pages.at(-1));
 await page.keyboard.press('Enter');assert.equal(await text.textContent(),'次のシーン');
 await page.keyboard.press('Space');await page.getByText('物語の、その先へ。').waitFor();
 await page.getByRole('button',{name:'最初から読む'}).click();assert.equal(await text.textContent(),pages[0]);
 await page.setViewportSize({width:820,height:650});assert.equal(await text.textContent(),pages[0]);assert.deepEqual(await dimensions(),size);
 assert.ok(await page.locator('.game-shell').evaluate(e=>e.getBoundingClientRect().width<=window.innerWidth));
 await page.screenshot({path:'tests/pagination.png'});
 await page.keyboard.press('Escape');await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'再生する',exact:true}).click();
 await page.keyboard.press('Enter');assert.equal(await text.textContent(),pages[0]);
 await page.keyboard.press('Enter');assert.equal(await readProgress(page),`2 / ${pageCount} ページ`);
 await page.keyboard.press('Space');assert.equal(await text.textContent(),pages[1]);
 assert.deepEqual(errors,[]);console.log(`PASS: ${pageCount} fixed-size pages, full text preservation, click/key navigation, page/scene back, ending/restart, tablet scaling, typewriter; no runtime errors`);
}finally{await browser.close();}



