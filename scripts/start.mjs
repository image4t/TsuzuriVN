import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const input=(process.env.VN_LAUNCH_PORT??'').trim()||'5175';
if(!/^\d{1,5}$/.test(input)||Number(input)<1||Number(input)>65535){
 console.error('Invalid port. Enter a number from 1 to 65535.');process.exit(1);
}
const vite=fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url));
if(!existsSync(vite)){
 console.error('Dependencies are missing. Run "npm install" in the project folder first.');process.exit(1);
}
const port=String(Number(input));
console.log(`Starting Visual Novel Studio: http://127.0.0.1:${port}`);
console.log('Press Ctrl+C to stop.');
const child=spawn(process.execPath,[vite,'--host','127.0.0.1','--port',port,'--strictPort'],{cwd:fileURLToPath(new URL('..',import.meta.url)),stdio:'inherit'});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
