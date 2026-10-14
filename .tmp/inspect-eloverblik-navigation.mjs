import { execFileSync } from 'node:child_process';
const dump = execFileSync('C:/Users/mbm/AppData/Local/Android/Sdk/platform-tools/adb.exe', ['shell','dumpsys','activity','activities'], { encoding: 'utf8', windowsHide: true, timeout: 20000 });
let found = 0;
for (const match of dump.matchAll(/https:\/\/eloverblik\.dk[^\s}\]]+/g)) {
  try {
    const url = new URL(match[0]);
    const target = url.searchParams.get('returnUrl');
    const returned = target ? new URL(target) : null;
    console.log({ portalPath: url.pathname, parameterNames:[...url.searchParams.keys()], returnOrigin: returned?.origin, returnPath: returned?.pathname, nativeReturn: returned?.searchParams.get('app') === '1' });
    found++;
  } catch { /* Truncated Android intent, never print it. */ }
}
console.log({ relatedBrowserIntents: found });
