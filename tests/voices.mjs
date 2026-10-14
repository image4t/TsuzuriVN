import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
function wav(seconds){const rate=8000;const samples=Math.floor(seconds*rate);const b=Buffer.alloc(44+samples*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)b.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*220/rate)*1000),44+i*2);return b;}
const audioInput=()=>page.locator('.voice-editor input[type=file]');
const jsonInput=()=>page.locator('input[type=file][accept=".json,application/json"]');
try{
 await page.goto(process.env.VN_TEST_URL??'http://127.0.0.1:5175');
 await page.getByRole('button',{name:'新規シナリオ',exact:true}).click();
 await page.getByRole('button',{name:'シーンを追加',exact:true}).first().click();
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=','base64');
 await page.locator('input[type=file][accept^="image/png"]').first().setInputFiles({name:'background.png',mimeType:'image/png',buffer:png});await page.getByAltText('選択した背景画像').waitFor();
 const mp3=await fs.readFile(new URL('./fixtures/tone.mp3',import.meta.url));
 await audioInput().setInputFiles([{name:'first.mp3',mimeType:'audio/mpeg',buffer:mp3},{name:'second.wav',mimeType:'audio/wav',buffer:wav(10)}]);
 await page.locator('.voice-list li').nth(1).waitFor();
 await page.getByRole('button',{name:'second.wavを試聴'}).click();await page.locator('.voice-editor audio').waitFor();
 await page.waitForFunction(()=>document.querySelector('.voice-editor audio')?.currentTime>0);
 await page.getByRole('button',{name:'ボイス2を上へ'}).click();assert.equal(await page.locator('.voice-name').first().textContent(),'second.wav');
 await page.getByRole('button',{name:'ボイス1を下へ'}).click();
 await page.getByRole('button',{name:'シーンを追加',exact:true}).first().click();
 assert.equal(await page.getByAltText('選択した背景画像').count(),1);assert.equal(await page.locator('.voice-list li').count(),0);
 await page.getByRole('textbox',{name:'本文'}).fill('次の場面');
 // Add uses the actual preceding scene at the end, even if an earlier scene is selected.
 await page.getByRole('button',{name:'背景画像を削除'}).click();
 await page.locator('.scene-select').first().click();await page.getByRole('button',{name:'シーンを追加',exact:true}).first().click();
 assert.equal(await page.getByAltText('選択した背景画像').count(),0);
 await page.getByRole('button',{name:'シーンを削除',exact:true}).click();
 await page.locator('.scene-select').first().click();
 const longText=('長い文章も音声を継続して読み進める。\n').repeat(12);
 await page.getByRole('textbox',{name:'本文'}).fill(longText);
 await audioInput().setInputFiles({name:'broken.wav',mimeType:'audio/wav',buffer:Buffer.from('not an audio')});await page.getByRole('alert').waitFor();assert.equal(await page.locator('.voice-list li').count(),2);await page.getByRole('button',{name:'エラーを閉じる'}).click();
 await page.getByRole('button',{name:'シナリオ一覧',exact:true}).click();await page.getByRole('button',{name:'編集する',exact:true}).click();assert.equal(await page.locator('.voice-list li').count(),2);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'書き出す',exact:true}).click();const download=await pending;const exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));
 assert.equal(exported.scenes[0].voices.length,2);assert.ok(exported.scenes[0].voices[0].data.startsWith('data:audio/mpeg'));assert.ok(exported.scenes[0].voices[1].data.startsWith('data:audio/wav'));
 await jsonInput().setInputFiles({name:'voices.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...exported,title:'ボイスを復元した作品'}))});
 await page.waitForFunction(()=>document.querySelector('.project-settings input')?.value==='ボイスを復元した作品');assert.equal(await page.locator('.voice-list li').count(),2);
 // Observe native media playback, including cleanup, without replacing play().
 await page.evaluate(()=>{window.testAudios=[];const NativeAudio=window.Audio;window.Audio=function(...args){const audio=new NativeAudio(...args);window.testAudios.push(audio);audio.addEventListener('loadstart',async()=>{const src=audio.src;if(src.startsWith('blob:')){const blob=await (await fetch(src)).blob();if(audio.src===src)audio.testMime=blob.type;}});return audio;};});
 await page.getByRole('button',{name:'再生する',exact:true}).click();
 await page.waitForFunction(()=>window.testAudios.some(a=>(a.src&&a.testMime==='audio/mpeg')&&a.currentTime>0));
 await page.waitForFunction(()=>window.testAudios.some(a=>(a.src&&a.testMime==='audio/wav')&&a.currentTime>0));
 const count=await page.evaluate(()=>window.testAudios.length);
 await page.locator('.game').click({position:{x:40,y:40}});assert.match(await page.locator('.page-number').textContent(),/^2 \//);
 assert.equal(await page.evaluate(()=>window.testAudios.length),count,'page changes must not recreate audio');
 assert.ok(await page.evaluate(()=>window.testAudios.some(a=>!a.paused&&a.currentTime>0)));
 await page.keyboard.press('ArrowLeft');assert.equal(await page.evaluate(()=>window.testAudios.length),count);
 const total=Number((await page.locator('.page-number').textContent()).match(/\/ (\d+)/)[1]);
 for(let i=0;i<total;i++)await page.keyboard.press('ArrowRight');
 assert.equal(await page.locator('.dialogue > .dialogue-text').textContent(),'次の場面');
 assert.ok(await page.evaluate(()=>window.testAudios.every(a=>a.paused)),'scene change stops previous voice');
 await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>window.testAudios.some(a=>(a.src&&a.testMime==='audio/mpeg')&&a.currentTime>0));
 await page.keyboard.press('Escape');assert.ok(await page.evaluate(()=>window.testAudios.every(a=>a.paused)),'exit stops playback');
 // Audio policy rejection must offer a retry and keep scene navigation functional.
 await page.evaluate(()=>{window.nativePlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('blocked','NotAllowedError'));};});
 await page.getByRole('button',{name:'再生する',exact:true}).click();await page.getByRole('button',{name:'音声を再生',exact:true}).waitFor();
 await page.evaluate(()=>{HTMLMediaElement.prototype.play=window.nativePlay;});await page.getByRole('button',{name:'音声を再生',exact:true}).click();
 await page.waitForFunction(()=>window.testAudios.some(a=>!a.paused&&a.currentTime>0));await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'first.mp3を削除'}).click();assert.equal(await page.locator('.voice-list li').count(),1);
 await page.getByRole('button',{name:'シーンを複製',exact:true}).click();assert.equal(await page.locator('.voice-list li').count(),1);
 await page.getByRole('button',{name:'second.wavを削除'}).click();assert.equal(await page.locator('.voice-list li').count(),0);await page.locator('.scene-select').first().click();assert.equal(await page.locator('.voice-list li').count(),1);
 await page.getByText('自動保存済み',{exact:true}).waitFor();await page.reload();await page.getByRole('button',{name:'編集する',exact:true}).first().click();assert.equal(await page.locator('.voice-list li').count(),1);
 assert.deepEqual(errors,[]);console.log('PASS: previous-image inheritance, WAV/MP3 import and preview, reorder/delete, native sequential playback, page continuation, scene/exit stop, autoplay retry, JSON/autosave restore, independent clone, invalid audio; no runtime errors');
}finally{await browser.close();}


