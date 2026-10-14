import {describe,it,expect} from 'vitest';
import {scene,resolveBackgrounds} from './model';
import {emptyFilters,filteredSceneIndices} from './sceneFilters';
describe('scene filters',()=>{
 const track={id:'voice',name:'a.mp3',data:'test'};
 const scenes=[scene({speaker:'甲',image:'image',bgm:{mode:'track',track},voices:[track]}),scene({speaker:'乙'}),scene({speaker:'甲',imageMode:'none',bgm:{mode:'stop'}}),scene()];
 const filter=(changes:Partial<ReturnType<typeof emptyFilters>>)=>filteredSceneIndices(scenes,resolveBackgrounds(scenes),{...emptyFilters(),...changes});
 it('combines speaker and voice conditions and preserves original indices',()=>{expect(filter({speaker:'甲',voice:'missing'})).toEqual([2]);expect(filter({speaker:''})).toEqual([3]);expect(filter({speaker:'unknown'})).toEqual([]);});
 it('resolves inheritance before filtering out preceding scenes',()=>{expect(filter({speaker:'乙',background:'present',bgm:'present'})).toEqual([1]);expect(filter({background:'missing',bgm:'missing'})).toEqual([2,3]);expect(filter({background:'inherit'})).toEqual([1,3]);});
 it('handles empty scenarios',()=>expect(filteredSceneIndices([],[],emptyFilters())).toEqual([]));
});
