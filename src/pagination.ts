/** Preserve every grapheme and split using the browser's actual font metrics. */
export function paginateText(text:string, measure:HTMLElement, height:number):string[] {
 if(!text)return [''];
 const characters=Array.from(new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(text),s=>s.segment);
 const pages:string[]=[];let offset=0;
 while(offset<characters.length){
  let low=1,high=Math.min(characters.length-offset,1000),fit=1;
  while(low<=high){const count=Math.floor((low+high)/2);measure.textContent=characters.slice(offset,offset+count).join('')+'\u200b';
   if(measure.offsetHeight<=height){fit=count;low=count+1;}else high=count-1;
  }
  pages.push(characters.slice(offset,offset+fit).join(''));offset+=fit;
 }
 measure.textContent='';return pages;
}
