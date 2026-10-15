import {spawn} from 'node:child_process';
import electron from 'electron';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(electron,['.'],{cwd:new URL('..',import.meta.url),env,stdio:'inherit',windowsHide:false});
child.on('exit',code=>process.exitCode=code??1);child.on('error',error=>{console.error(error);process.exitCode=1;});
