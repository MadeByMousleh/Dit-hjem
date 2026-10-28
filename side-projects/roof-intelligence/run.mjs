import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {prepare} from './prepare.mjs';
import {trainingInput} from './dataset.mjs';
const python=fileURLToPath(new URL('../color-trainer/data/semantic-runtime/python.exe',import.meta.url));
const worker=fileURLToPath(new URL('./worker.py',import.meta.url));
const run=args=>new Promise((done,fail)=>{const child=spawn(python,['-u',worker,...args],{windowsHide:true,stdio:'inherit'});child.once('error',fail);child.once('exit',code=>code===0?done():fail(Error(`Roof worker failed: ${code}`)));});
console.log(JSON.stringify(await prepare()));await run([]);const input=await trainingInput();console.log(JSON.stringify({eligibleObjects:input.rows.length}));await run(['--train']);
