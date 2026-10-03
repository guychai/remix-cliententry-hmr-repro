import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
const cwd = new URL('./app/', import.meta.url).pathname;
const source = new URL('./app/app/actions/public/counter.tsx', import.meta.url);
const plain = await readFile(new URL('./evidence/counter.plain.tsx', import.meta.url));
const wrapped = await readFile(new URL('./evidence/counter.wrapped.tsx', import.meta.url));
let proc;
let log = '';
const rows = [];
async function start() {
  proc = spawn(process.execPath, ['--watch', '--import', 'remix/node-tsx', 'server.ts'], { cwd, env: { ...process.env, NODE_ENV: 'development', PORT: '45300' }, stdio: ['ignore','pipe','pipe'] });
  proc.stdout.on('data', b => { log += b; process.stdout.write(b); });
  proc.stderr.on('data', b => { log += b; process.stdout.write(b); });
  for (let i=0;i<100;i++) { try { let r = await fetch('http://127.0.0.1:45300'); if (r.ok) return; } catch {} await delay(100); }
  throw new Error('server did not become ready');
}
async function stop() { proc.kill('SIGTERM'); await once(proc, 'exit'); }
async function sample(name) {
  const r=await fetch('http://127.0.0.1:45300', {cache:'no-store'}); const html=await r.text();
  await writeFile(new URL(`./evidence/${name}.html`,import.meta.url),html);
  const row={stage:name,status:r.status,hydrationMarkers:(html.match(/<!--\s*rmx:h:/g)||[]).length,hasCounterUrl:html.includes('counter.tsx'),scripts:[...html.matchAll(/<script[^>]*type="application\/json"[^>]*>(.*?)<\/script>/gs)].map(m=>m[1]),countLabel:html.match(/Count:[^<]*/)?.[0]};
  rows.push(row);console.log(JSON.stringify(row)); return row;
}
try {
  await writeFile(source,plain); await start(); await sample('dev-01-plain-cold');
  await writeFile(source,wrapped); await delay(1500); await sample('dev-02-wrapped-watch-restart');
  await writeFile(source,plain); await delay(1500); await sample('dev-03-plain-watch-restart');
  assert.deepEqual(rows.map(r=>r.hydrationMarkers), [0,1,0]);
  console.log('WATCH WORKAROUND VERIFIED: npm run dev restarts correctly for both transitions.');
} finally { if(proc && proc.exitCode===null) await stop(); await writeFile(new URL('./evidence/dev-watch-results.json',import.meta.url),JSON.stringify(rows,null,2)); await writeFile(new URL('./evidence/dev-watch.log',import.meta.url),log); }
