import {useEffect,useState} from 'react';
import {Plus,RotateCcw} from 'lucide-react';
import {speakerColor,DEFAULT_TEXT_COLOR,type SpeakerColors} from './model';
function ColorEntry({speaker,colors,onChange}:{speaker:string;colors:SpeakerColors;onChange:(colors:SpeakerColors)=>void}){
 const color=speakerColor(colors,speaker);const [text,setText]=useState(color);const [invalid,setInvalid]=useState(false);
 useEffect(()=>{setText(color);setInvalid(false);},[color]);
 const label=speaker||'ナレーション';
 const save=(value:string)=>{if(/^#[0-9a-fA-F]{6}$/.test(value)){onChange({...colors,[speaker]:value.toLowerCase()});setText(value.toLowerCase());setInvalid(false);}else setInvalid(true);};
 return <div className="speaker-color-entry"><span title={label}>{label}</span><input aria-label={`${label}の文字色`} type="color" value={color} onChange={e=>save(e.target.value)}/><input aria-label={`${label}の色コード`} aria-invalid={invalid} className={invalid?'invalid':''} value={text} placeholder="#RRGGBB" maxLength={7} onChange={e=>{setText(e.target.value);setInvalid(false);}} onBlur={()=>save(text)} onKeyDown={e=>{if(e.key==='Enter')save(text);}}/><button title="既定色に戻す" aria-label={`${label}の文字色を既定に戻す`} onClick={()=>save(DEFAULT_TEXT_COLOR)}><RotateCcw size={13}/></button></div>;
}
export default function SpeakerColorSettings({speakers,colors,onChange}:{speakers:string[];colors:SpeakerColors;onChange:(colors:SpeakerColors)=>void}){
 const [name,setName]=useState('');const names=Array.from(new Set([...speakers,...Object.keys(colors)].filter(s=>s.trim())));
 const add=()=>{const speaker=name.trim();if(!speaker)return;onChange({...colors,[speaker]:Object.hasOwn(colors,speaker)?colors[speaker]:'#a8d8ff'});setName('');};
 return <section className="speaker-color-settings"><h4>話者ごとの文字色</h4><p>同じ話者の全シーンに反映します。</p><ColorEntry speaker="" colors={colors} onChange={onChange}/>{names.map(speaker=><ColorEntry key={speaker} speaker={speaker} colors={colors} onChange={onChange}/>)}<div className="speaker-color-add"><input aria-label="色を設定する話者名" value={name} onChange={e=>setName(e.target.value)} placeholder="新しい話者名" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add();}}}/><button aria-label="文字色の話者を追加" disabled={!name.trim()} onClick={add}><Plus size={15}/></button></div><p className="field-note">ナレーションも変更できます。一括作成画面にも色を表示します。</p></section>;
}
