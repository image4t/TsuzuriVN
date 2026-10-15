import {openMenu,closeMenu,readProgress,playbackAction} from './playback-menu.mjs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const setHex=async(scope,name,value)=>{const input=scope.getByRole('textbox',{name:`${name}の色コード`,exact:true});await input.fill(value);await input.press('Enter');};
try{
 await page.goto(process.env.VN_TEST_URL??'http://127.0.0.1:5175');
 const base={speaker:'',image:null,imageName:'',voices:[],bgm:{mode:'inherit'}};
 const narration=Array.from({length:8},(_,i)=>`ナレーション${i+1}行目。`).join('\n');
 await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'colors.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,title:'話者色テスト',scenes:[{...base,text:narration},{...base,text:'「純一のセリフ」',speaker:'純一'},{...base,text:'「詞のセリフ」',speaker:'詞'},{...base,text:'「もう一度、純一」',speaker:'純一'}]}))});
 const settings=page.locator('.project-settings');await settings.getByRole('textbox',{name:'ナレーションの色コード',exact:true}).waitFor();
 await setHex(settings,'ナレーション','#ffe6aa');await setHex(settings,'純一','#a8d8ff');await setHex(settings,'詞','#ffb6d5');
 await settings.getByRole('textbox',{name:'色を設定する話者名'}).fill('先生');await settings.getByRole('button',{name:'文字色の話者を追加'}).click();await setHex(settings,'先生','#bbffcc');
 await page.getByRole('button',{name:'再生する',exact:true}).click();
 assert.equal(await page.locator('.dialogue .speaker').count(),0);
 const geometry=await page.locator('.dialogue').evaluate(el=>({height:el.clientHeight,top:el.querySelector('.dialogue-text').getBoundingClientRect().top-el.getBoundingClientRect().top,scale:el.getBoundingClientRect().width/el.offsetWidth,textHeight:el.querySelector('.dialogue-text').clientHeight}));
 assert.equal(geometry.height,238);assert.equal(geometry.textHeight,180);assert.ok(geometry.top/geometry.scale<22,'narration has no empty speaker row');
 assert.equal(await page.locator('.dialogue > .dialogue-text').evaluate(e=>getComputedStyle(e).color),'rgb(255, 230, 170)');
 const narrationPages=[];const total=Number((await readProgress(page)).match(/\/ (\d+)/)[1]);
 for(let i=0;i<total;i++){narrationPages.push(await page.locator('.dialogue > .dialogue-text').textContent());assert.ok(await page.locator('.dialogue > .dialogue-text').evaluate(e=>e.scrollHeight<=e.clientHeight));await page.keyboard.press('ArrowRight');}
 assert.equal(narrationPages.join(''),narration);assert.equal(await page.locator('.dialogue .speaker').textContent(),'純一');assert.equal(await page.locator('.dialogue > .dialogue-text').evaluate(e=>getComputedStyle(e).color),'rgb(168, 216, 255)');assert.equal(await page.locator('.dialogue .speaker').evaluate(e=>getComputedStyle(e).color),'rgb(168, 216, 255)');assert.equal(await page.locator('.dialogue > .dialogue-text').evaluate(e=>e.clientHeight),144);
 await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.dialogue > .dialogue-text').evaluate(e=>getComputedStyle(e).color),'rgb(255, 182, 213)');
 await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.dialogue > .dialogue-text').evaluate(e=>getComputedStyle(e).color),'rgb(168, 216, 255)');await page.keyboard.press('Escape');
 await page.locator('.scene-select').first().click();assert.equal(await page.locator('.mini-dialogue p').evaluate(e=>getComputedStyle(e).color),'rgb(255, 230, 170)');
 await page.getByRole('button',{name:'文章からまとめて作成'}).click();const modal=page.getByRole('dialog');await modal.getByRole('textbox',{name:'まとめて作成する原稿'}).fill('河川敷のナレーション。\n「純一のセリフ」\n「詞のセリフ」\n「純一の続き」');await modal.getByRole('button',{name:'行ごとに話者を指定'}).click();
 await modal.getByRole('combobox',{name:'行2の話者',exact:true}).selectOption('"純一"');await modal.getByRole('combobox',{name:'行3の話者',exact:true}).selectOption('"詞"');await modal.getByRole('combobox',{name:'行4の話者',exact:true}).selectOption('"純一"');
 assert.deepEqual(await page.locator('.bulk-line').evaluateAll(rows=>rows.map(e=>getComputedStyle(e).getPropertyValue('--speaker-color'))),['#ffe6aa','#a8d8ff','#ffb6d5','#a8d8ff']);
 assert.deepEqual(await page.locator('.bulk-preview-list article').evaluateAll(cards=>cards.map(e=>getComputedStyle(e).borderLeftColor)),['rgb(255, 230, 170)','rgb(168, 216, 255)','rgb(255, 182, 213)','rgb(168, 216, 255)']);
 await modal.getByText('話者の文字色を設定',{exact:true}).click();await setHex(modal.locator('.bulk-color-options'),'純一','#b6f0cc');
 assert.equal(await page.locator('.bulk-line').nth(1).evaluate(e=>getComputedStyle(e).getPropertyValue('--speaker-color')),'#b6f0cc');assert.equal(await page.locator('.bulk-line').nth(3).evaluate(e=>getComputedStyle(e).getPropertyValue('--speaker-color')),'#b6f0cc');
 await modal.getByText('話者の文字色を設定',{exact:true}).click();await page.screenshot({path:'tests/speaker-colors.png'});
 await modal.getByRole('button',{name:'4シーンを追加',exact:true}).click();await modal.waitFor({state:'detached'});
 assert.equal(await settings.getByRole('textbox',{name:'純一の色コード',exact:true}).inputValue(),'#b6f0cc');
 // Invalid color edits leave the last valid definition unchanged.
 await setHex(settings,'純一','bad');assert.equal(await settings.getByRole('textbox',{name:'純一の色コード',exact:true}).getAttribute('aria-invalid'),'true');await setHex(settings,'純一','#b6f0cc');
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'JSON書き出し',exact:true}).click();const download=await pending;const exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));assert.deepEqual(exported.speakerColors,{'':'#ffe6aa','純一':'#b6f0cc','詞':'#ffb6d5','先生':'#bbffcc'});
 await page.getByRole('button',{name:'シナリオ一覧',exact:true}).click();await page.getByRole('article',{name:'話者色テスト',exact:true}).getByRole('button',{name:'シナリオを複製',exact:true}).click();await page.getByRole('article',{name:'話者色テスト（コピー）',exact:true}).getByRole('button',{name:'編集する',exact:true}).click();assert.equal(await page.locator('.project-settings').getByRole('textbox',{name:'純一の色コード',exact:true}).inputValue(),'#b6f0cc');
 await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'restored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...exported,title:'色の復元'}))});await page.waitForFunction(()=>document.querySelector('.project-settings input')?.value==='色の復元');await page.getByText('自動保存済み',{exact:true}).waitFor();await page.reload();await page.getByRole('article',{name:'色の復元',exact:true}).getByRole('button',{name:'編集する',exact:true}).click();assert.equal(await page.locator('.project-settings').getByRole('textbox',{name:'ナレーションの色コード',exact:true}).inputValue(),'#ffe6aa');
 await page.getByRole('button',{name:'再生する',exact:true}).click();assert.equal(await page.locator('.dialogue > .dialogue-text').evaluate(e=>getComputedStyle(e).color),'rgb(255, 230, 170)');await page.screenshot({path:'tests/narration.png'});await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('PASS: compact narration, fixed dialogue size and five-line pagination, global narration/speaker colors, matching bulk cards/rows/buttons, live bulk color changes, invalid edits, JSON/duplicate/autosave restore; no runtime errors');
}finally{await browser.close();}

