import { spawn } from 'node:child_process';
const action=process.argv[2];
if (!['diff','push'].includes(action)) throw new Error('Choose diff or push');
const ref=new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
const child=spawn(process.execPath,['node_modules/supabase/dist/supabase.js','config',action,'--workdir','supabase/hosted','--project-ref',ref,...(action==='push'?['--yes']:[])],{stdio:'inherit'});
child.on('exit',code=>{process.exitCode=code??1;});
