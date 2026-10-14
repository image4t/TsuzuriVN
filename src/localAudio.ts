export async function voiceFilesFromPaths(input:string):Promise<File[]>{
 const paths=input.split(/\r?\n/).map(s=>s.trim().replace(/^"(.*)"$/,'$1')).filter(Boolean);
 if(!paths.length)throw new Error('音声ファイルのフルパスを入力してください。');
 const files:File[]=[];
 for(const path of paths){
  const response=await fetch('/__local/audio',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Audio':'1'},body:JSON.stringify({path})});
  if(!response.headers.get('content-type')?.startsWith('audio/')){
   let message='フルパス読み込みには起動バッチ、npm run dev または npm run preview のローカルサーバーが必要です。';
   try{const data=await response.json();if(typeof data.message==='string')message=data.message;}catch{/* Static hosting has no local file endpoint. */}
   throw new Error(`${path}\n${message}`);
  }
  if(!response.ok)throw new Error(`${path}\n音声を読み込めませんでした。`);
  const name=decodeURIComponent(response.headers.get('X-Audio-Filename')??'voice.mp3');
  files.push(new File([await response.blob()],name,{type:response.headers.get('content-type')!}));
 }
 return files;
}
