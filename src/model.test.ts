import {describe,it,expect} from 'vitest';
import {emptyProject,parseProject,scene,sceneAfter,splitText,resolveBgm,resolveBackground,resolveBackgrounds,speakerColor,DEFAULT_TEXT_COLOR} from './model';
describe('scenario model',()=>{
 it('splits UTF-8 Japanese text with CRLF and whitespace separators',()=>{expect(splitText('\uFEFF第一行\r\n続き\r\n \r\n次の場面\r\n\r\n').map(s=>s.text)).toEqual(['第一行\n続き','次の場面']);});
 it('round trips text, image and order',()=>{const p={...emptyProject(),scenes:[scene({text:'こんにちは\n世界',speaker:'栞',image:'data:image/png;base64,YQ==',imageName:'背景.png'}),scene({text:'次'})]};const restored=parseProject(JSON.parse(JSON.stringify(p)));expect(restored.scenes.map(s=>({...s,id:''}))).toEqual(p.scenes.map(s=>({...s,id:''})));expect(new Set(restored.scenes.map(s=>s.id)).size).toBe(2);});
 it('accepts empty scenarios',()=>expect(parseProject(emptyProject()).scenes).toEqual([]));
 it('resolves background inheritance, changes and clearing in playback order',()=>{
  const a=scene({image:'data:image/png;base64,YQ==',imageName:'a.png'});const b=scene({image:'data:image/png;base64,Yg==',imageName:'b.png'});
  const scenes=[a,scene(),b,scene(),scene({imageMode:'none'}),scene()];
  expect(resolveBackgrounds(scenes).map(bg=>bg?.name??null)).toEqual(['a.png','a.png','b.png','b.png',null,null]);
  expect(resolveBackground(scenes,1)?.image).toBe(a.image);expect(resolveBackground(scenes,6)).toBeNull();expect(resolveBackground([],0)).toBeNull();
  expect(resolveBackground([{...a,image:b.image,imageName:b.imageName},scenes[1]],1)?.name).toBe('b.png');
  expect(resolveBackground([b,a,scene()],2)?.name).toBe('a.png');
 });
 it('defaults old unset backgrounds to inheritance and preserves explicit none',()=>{
  const old={version:1,title:'古い画像',scenes:[{text:'a',speaker:'',image:'data:image/png;base64,YQ==',imageName:'a.png'},{text:'b',speaker:'',image:null}]};
  const restored=parseProject(old);expect(restored.scenes.map(s=>s.imageMode)).toEqual(['custom','inherit']);expect(resolveBackground(restored.scenes,1)?.name).toBe('a.png');
  expect(scene({image:null}).imageMode).toBe('inherit');
  expect(resolveBackground([restored.scenes[0],scene({imageMode:'none'}),scene()],2)).toBeNull();
  const inherited=parseProject({...emptyProject(),scenes:[scene({image:'data:image/png;base64,YQ=='}),scene()]});expect(inherited.scenes[1]).toMatchObject({image:null,imageMode:'inherit'});expect(resolveBackground(inherited.scenes,1)?.image).toBe(inherited.scenes[0].image);
  for(const imageMode of ['bad',null,42])expect(()=>parseProject({...emptyProject(),scenes:[{...scene(),imageMode}]})).toThrow();
  expect(()=>parseProject({...emptyProject(),scenes:[scene({imageMode:'custom'})]})).toThrow();
 });
 it('round trips narration and speaker colors, with safe defaults for old JSON',()=>{
  const p={...emptyProject(),speakerColors:{'':'#FFE6AA','純一':'#A8D8FF','詞':'#FFB6D5'}};
  const restored=parseProject(JSON.parse(JSON.stringify(p)));expect(restored.speakerColors).toEqual({'':'#ffe6aa','純一':'#a8d8ff','詞':'#ffb6d5'});
  expect(speakerColor(restored.speakerColors,'')).toBe('#ffe6aa');expect(speakerColor(restored.speakerColors,'　')).toBe('#ffe6aa');expect(speakerColor(restored.speakerColors,'純一')).toBe('#a8d8ff');expect(speakerColor(restored.speakerColors,'他の話者')).toBe(DEFAULT_TEXT_COLOR);
  expect(parseProject({version:1,title:'古い作品',scenes:[]}).speakerColors).toEqual({});
  const special=parseProject({...emptyProject(),speakerColors:JSON.parse('{"__proto__":"#abcdef"}')});expect(speakerColor(special.speakerColors,'__proto__')).toBe('#abcdef');expect(speakerColor({},'toString')).toBe(DEFAULT_TEXT_COLOR);
 });
 it('rejects malformed and unsafe color settings',()=>{
  for(const speakerColors of [null,[],{'純一':'red'},{'純一':'url(https://example.com)'},{'純一':'#abc'},{'':'#zzzzzz'},{'純一':42}])expect(()=>parseProject({...emptyProject(),speakerColors})).toThrow();
 });
 it('resolves BGM inheritance, changes, stopping, middle starts and reverse navigation',()=>{
  const a={id:'a',name:'a.wav',data:'data:audio/wav;base64,YQ=='};const b={id:'b',name:'b.mp3',data:'data:audio/mpeg;base64,Yg=='};
  const scenes=[scene(),scene({bgm:{mode:'track',track:a}}),scene(),scene({bgm:{mode:'track',track:b}}),scene(),scene({bgm:{mode:'stop'}}),scene()];
  expect(scenes.map((_,i)=>resolveBgm(scenes,i))).toEqual([null,a,a,b,b,null,null]);
  expect(resolveBgm(scenes,2)).toBe(a);expect(resolveBgm(scenes,scenes.length)).toBeNull();expect(resolveBgm([],0)).toBeNull();
  expect(sceneAfter(scenes[1]).bgm).toEqual({mode:'inherit'});
 });
 it('round trips BGM and independent volumes; defaults old JSON safely',()=>{
  const p={...emptyProject(),audioSettings:{voiceVolume:.7,bgmVolume:0},scenes:[scene({bgm:{mode:'track',track:{id:'a',name:'bgm.mp3',data:'data:audio/mpeg;base64,YQ=='}}}),scene(),scene({bgm:{mode:'stop'}})]};
  const restored=parseProject(JSON.parse(JSON.stringify(p)));expect(restored.audioSettings).toEqual(p.audioSettings);expect(resolveBgm(restored.scenes,1)?.data).toBe('data:audio/mpeg;base64,YQ==');expect(restored.scenes[2].bgm).toEqual({mode:'stop'});
  expect(parseProject({version:1,title:'古い作品',scenes:[{text:'本文',speaker:'',image:null}]})).toMatchObject({audioSettings:{voiceVolume:1,bgmVolume:.5},scenes:[{bgm:{mode:'inherit'}}]});
 });
 it('rejects invalid BGM and volumes',()=>{
  for(const bgm of [null,{mode:'bad'},{mode:'track',track:{name:'a',data:'https://example.com/a.mp3'}}])expect(()=>parseProject({...emptyProject(),scenes:[{...scene(),bgm}]})).toThrow();
  for(const audioSettings of [null,{voiceVolume:2,bgmVolume:0},{voiceVolume:.5,bgmVolume:-1},{voiceVolume:NaN,bgmVolume:.5}])expect(()=>parseProject({...emptyProject(),audioSettings})).toThrow();
 });
 it('new scenes inherit dynamically without copying image data or voice',()=>{
  const previous=scene({image:'data:image/png;base64,YQ==',imageName:'背景.png',text:'前',speaker:'栞',voices:[{id:'voice',name:'a.wav',data:'data:audio/wav;base64,YQ=='}]});
  expect(sceneAfter(previous)).toMatchObject({image:null,imageName:'',imageMode:'inherit',text:'',speaker:'',voices:[]});
  expect(sceneAfter(undefined)).toMatchObject({image:null,imageName:'',voices:[]});
  expect(sceneAfter(previous,{image:null})).toMatchObject({image:null});
 });
 it('round trips ordered embedded WAV and MP3 voices and supports older JSON',()=>{
  const p={...emptyProject(),scenes:[scene({voices:[{id:'a',name:'一.wav',data:'data:audio/wav;base64,YQ=='},{id:'b',name:'二.mp3',data:'data:audio/mpeg;base64,Yg=='}]})]};
  expect(parseProject(JSON.parse(JSON.stringify(p))).scenes[0].voices.map(({name,data})=>({name,data}))).toEqual(p.scenes[0].voices.map(({name,data})=>({name,data})));
  const {voices,...oldScene}=p.scenes[0];expect(parseProject({...p,scenes:[oldScene]}).scenes[0].voices).toEqual([]);
 });
 it('rejects malformed voice lists and external audio URLs',()=>{
  for(const voices of [null,{},[{name:'a.wav',data:'https://example.com/a.wav'}],[{name:'a.ogg',data:'data:audio/ogg;base64,YQ=='}]])expect(()=>parseProject({...emptyProject(),scenes:[{...scene(),voices}]})).toThrow();
 });
 it('rejects malformed or remote images without altering data',()=>{expect(()=>parseProject({version:1,title:'a',scenes:[{text:'a',speaker:'',image:'https://example.com/image.png'}]})).toThrow();expect(()=>parseProject({version:2,title:'a',scenes:[]})).toThrow();});
});
