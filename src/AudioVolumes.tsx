import type {AudioSettings} from './model';
export default function AudioVolumes({settings,onChange}:{settings:AudioSettings;onChange:(settings:AudioSettings)=>void}){
 return <div className="audio-volumes"><label><span>ボイス <output>{Math.round(settings.voiceVolume*100)}%</output></span><input aria-label="ボイス音量" type="range" min="0" max="100" step="1" value={Math.round(settings.voiceVolume*100)} onChange={e=>onChange({...settings,voiceVolume:Number(e.target.value)/100})}/></label><label><span>BGM <output>{Math.round(settings.bgmVolume*100)}%</output></span><input aria-label="BGM音量" type="range" min="0" max="100" step="1" value={Math.round(settings.bgmVolume*100)} onChange={e=>onChange({...settings,bgmVolume:Number(e.target.value)/100})}/></label></div>;
}
