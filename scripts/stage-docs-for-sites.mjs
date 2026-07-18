import { cp, mkdir, rm } from 'node:fs/promises';

const projectRoot = new URL('../', import.meta.url);
const vitePressOutput = new URL('website/.vitepress/dist/', projectRoot);
const workerSource = new URL('website/sites-worker.mjs', projectRoot);
const sitesOutput = new URL('dist/', projectRoot);
const clientOutput = new URL('client/', sitesOutput);
const serverOutput = new URL('server/', sitesOutput);

await rm(sitesOutput, { recursive: true, force: true });
await mkdir(clientOutput, { recursive: true });
await mkdir(serverOutput, { recursive: true });
await cp(vitePressOutput, clientOutput, { recursive: true });
await cp(workerSource, new URL('index.js', serverOutput));
