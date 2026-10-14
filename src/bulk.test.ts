import {describe,it,expect} from 'vitest';
import {parseLines,groupLines,linesToScenes} from './bulk';
import {scene} from './model';
describe('bulk script creation',()=>{
 it('normalizes UTF-8 BOM/CRLF, marks narration and leaves dialogue unassigned',()=>{
  const rows=parseLines('\uFEFF川面が染まる。\r\n続く地の文。\r\n\r\n「何が？」\r\n　『返事』\r\n');
  expect(rows.map(r=>[r.lineNumber,r.text,r.speaker])).toEqual([[1,'川面が染まる。',''],[2,'続く地の文。',''],[4,'「何が？」',null],[5,'　『返事』',null]]);
  expect(rows[2].separator).toBe('\n\n');expect(parseLines('本文',false)[0].speaker).toBeNull();
 });
 it('combines only consecutive matching speakers, preserves indentation and internal blank lines',()=>{
  const rows=parseLines('地の文。\n　続く。\n\nさらに続く。\n「一」\n「二」\n「三」\n戻る地の文。');
  rows[3].speaker='純一';rows[4].speaker='純一';rows[5].speaker='詞';
  const groups=groupLines(rows);expect(groups.map(g=>[g.speaker,g.text])).toEqual([['','地の文。\n　続く。\n\nさらに続く。'],['純一','「一」\n「二」'],['詞','「三」'],['','戻る地の文。']]);
  expect(groups[0]).toMatchObject({from:1,to:4,count:3});
  const previous=scene({image:'data:image/png;base64,YQ==',imageName:'背景.png',voices:[{id:'a',name:'a.wav',data:'data:audio/wav;base64,YQ=='}],bgm:{mode:'stop'}});
  const scenes=linesToScenes(rows,previous);expect(scenes).toHaveLength(4);expect(new Set(scenes.map(s=>s.id)).size).toBe(4);
  for(const s of scenes)expect(s).toMatchObject({image:null,imageName:'',imageMode:'inherit',voices:[],bgm:{mode:'inherit'}});
 });
 it('never converts unspecified speakers and handles blank input',()=>{
  expect(()=>linesToScenes(parseLines('「不明」'))).toThrow('未指定');expect(parseLines(' \n\n')).toEqual([]);expect(linesToScenes([])).toEqual([]);
 });
 it('handles 20,000 dialogue rows with repeated speaker changes without dropping text',()=>{
  const text=Array.from({length:20000},(_,i)=>`「${i}行目」`).join('\n');const rows=parseLines(text).map((r,i)=>({...r,speaker:i%4<2?'純一':'詞'}));
  const groups=groupLines(rows);expect(groups).toHaveLength(10000);expect(groups.map(g=>g.text).join('\n')).toBe(text);
 });
});
