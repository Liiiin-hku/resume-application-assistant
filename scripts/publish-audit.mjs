import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { root } from './checkpoint.mjs';

// Inspect the exact staged snapshot, plus every blob in the history being pushed.
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 12 * 1024 * 1024 });
const staged = git('ls-files', '--stage', '-z').toString('utf8').split('\0').filter(Boolean);
const forbidden = /(^|\/)(node_modules|\.pnpm-store|dist|\.git)(\/|$)|(^|\/)\.env(?:\.|$)|\.(?:pem|key|p12|pfx)$/i;
const entries = staged.map(line => {
  const [metadata, file] = line.split('\t');
  const [mode, sha, stage] = metadata.split(' ');
  if (stage !== '0' || mode !== '100644') throw new Error(`不支持的暂存状态或文件模式：${file}`);
  if (forbidden.test(file) || (file.startsWith('data/') && file !== 'data/private/.gitkeep') || (file.startsWith('artifacts/') && file !== 'artifacts/.gitkeep'))
    throw new Error(`禁止上传的文件路径：${file}`);
  return { file, sha };
});
const forbiddenHistory = git('rev-list', '--objects', '--all').toString('utf8').trim().split('\n').filter(Boolean);
for (const item of forbiddenHistory) {
  const file = item.slice(item.indexOf(' ') + 1);
  if (item.includes(' ') && (forbidden.test(file) || (file.startsWith('data/private/') && file !== 'data/private/.gitkeep') || (file.startsWith('artifacts/') && file !== 'artifacts/.gitkeep')))
    throw new Error(`历史中存在禁止上传路径：${file}`);
}
const objectIds = new Set([...entries.map(x => x.sha), ...forbiddenHistory.map(x => x.split(' ')[0])]);
let blobs = 0;
for (const sha of objectIds) {
  if (git('cat-file', '-t', sha).toString().trim() !== 'blob') continue;
  const data = git('cat-file', 'blob', sha);
  const text = data.toString('utf8');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/.test(text))
    throw new Error(`检测到疑似私钥或凭据，只报告对象标识：${sha}`);
  blobs++;
}
for (const required of ['AGENTS.md', 'README.md', 'pnpm-lock.yaml', 'src/extension-key.json', 'memory/STATUS.md'])
  if (!entries.some(x => x.file === required)) throw new Error(`缺少必要文件：${required}`);
const report = {
  result: 'pass', time: new Date().toISOString(), stagedFiles: entries.length, inspectedBlobs: blobs,
  tree: git('write-tree').toString().trim(),
  pathManifestHash: crypto.createHash('sha256').update(entries.map(x => `${x.file}\t${x.sha}`).sort().join('\n')).digest('hex'),
  scope: 'Staged paths and all local Git history objects; high-confidence credential patterns, not a guarantee of arbitrary secret detection',
};
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts', 'publish-audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
