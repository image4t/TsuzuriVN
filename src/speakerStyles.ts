import type {CSSProperties} from 'react';
import {speakerColor,type SpeakerColors} from './model';
/** Tint cards while keeping their dark labels readable for pale playback colors. */
export function speakerCardStyle(colors:SpeakerColors|undefined,speaker:string|null):CSSProperties{
 const color=speaker===null?'#b8a386':speakerColor(colors,speaker);
 return {'--speaker-color':color,'--speaker-tint':`${color}20`,'--speaker-border':`${color}80`} as CSSProperties;
}
