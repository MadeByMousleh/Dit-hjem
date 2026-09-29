import { spawn } from 'node:child_process';

const environments = {
  dev: { api: 'https://dit-hjem-git-dev-mohammed-mouslehs-projects.vercel.app', project: 'wsdomkzhnksyjrpxqfvn' },
  prod: { api: 'https://dit-hjem-five.vercel.app', project: 'arkpfdsglgufnnukader' },
};
const target = environments[process.argv[2]];
if (!target) throw new Error('Choose dev or prod explicitly.');
const response = await fetch(`${target.api}/api/auth/config`, { signal: AbortSignal.timeout(15000) });
const config = await response.json();
if (!response.ok || config.url?.replace(/\/$/, '') !== `https://${target.project}.supabase.co`) {
  throw new Error('Backend database does not match the selected environment. Expo was not started.');
}
console.log(`Expo ${process.argv[2]}: ${target.api} -> ${target.project}`);
const child = spawn(process.execPath, ['node_modules/expo/bin/cli', 'start', '--clear', '--go', ...process.argv.slice(3)], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_API_URL: target.api },
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
