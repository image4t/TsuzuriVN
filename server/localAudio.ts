import type {Plugin,Connect} from 'vite';
import {open,realpath} from 'node:fs/promises';
import {isAbsolute,extname,basename} from 'node:path';

const MAX_AUDIO=25*1024*1024;
export function localAudio():Plugin{
 const middleware:Connect.NextHandleFunction=async(req,res,next)=>{
  if(req.url?.split('?')[0]!=='/__local/audio')return next();
  const fail=(status:number,message:string)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({message}));};
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  // Only the local app may request explicit audio paths. No cross-origin access.
  try{
   const origin=new URL(req.headers.origin??'');
   if(!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)||origin.host!==req.headers.host||origin.protocol!=='http:'||req.headers['x-local-audio']!=='1')return fail(403,'この音声読み込みはローカルのアプリからのみ利用できます。');
  }catch{return fail(403,'この音声読み込みはローカルのアプリからのみ利用できます。');}
  if(req.method!=='POST')return fail(405,'POSTで指定してください。');
  if(!req.headers['content-type']?.startsWith('application/json'))return fail(400,'音声ファイルのパスを指定してください。');
  try{
   let size=0;const chunks:Buffer[]=[];
   for await(const chunk of req){size+=chunk.length;if(size>8192)return fail(413,'ファイルパスが長すぎます。');chunks.push(Buffer.from(chunk));}
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(typeof body.path!=='string'||!isAbsolute(body.path)||body.path.includes('\0'))return fail(400,'音声ファイルをフルパスで指定してください。');
   const extension=extname(body.path).toLowerCase();
   if(!['.wav','.mp3'].includes(extension))return fail(400,'WAVまたはMP3のファイルを指定してください。');
   const path=await realpath(body.path);
   if(!['.wav','.mp3'].includes(extname(path).toLowerCase()))return fail(400,'WAVまたはMP3のファイルを指定してください。');
   const handle=await open(path,'r');
   try{
    const stat=await handle.stat();if(!stat.isFile())return fail(400,'音声ファイルを指定してください。');
    if(!stat.size||stat.size>MAX_AUDIO)return fail(413,'音声は1ファイル25MB以下の空でないファイルを指定してください。');
    const buffer=Buffer.alloc(stat.size);let offset=0;
    while(offset<buffer.length){const {bytesRead}=await handle.read(buffer,offset,buffer.length-offset,offset);if(!bytesRead)throw new Error('File changed');offset+=bytesRead;}
    res.setHeader('Content-Type',extension==='.wav'?'audio/wav':'audio/mpeg');
    res.setHeader('X-Audio-Filename',encodeURIComponent(basename(body.path)));
    res.end(buffer);
   }finally{await handle.close();}
  }catch(error){
   const code=(error as NodeJS.ErrnoException).code;
   fail(400,code==='ENOENT'?'ファイルが見つかりません。フルパスを確認してください。':code==='EACCES'||code==='EPERM'?'ファイルを読み込む権限がありません。':'音声ファイルを読み込めませんでした。パスやファイルの状態を確認してください。');
  }
 };
 return {name:'local-audio',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}};
}
