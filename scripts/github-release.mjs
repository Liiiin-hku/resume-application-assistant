import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { root, checkpoint } from './checkpoint.mjs';

// Deliberately restricted to the repository explicitly authorized by the user.
const repository = 'Liiiin-hku/resume-application-assistant';
const owner = 'Liiiin-hku';
const apiRoot = `https://api.github.com/repos/${repository}`;
let token = '';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 15000 }).trim();
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function request(url, method = 'GET', body, contentType = 'application/json') {
  const parsed = new URL(url);
  const allowed = parsed.protocol === 'https:' && (
    (parsed.hostname === 'api.github.com' && (parsed.pathname === '/user' || parsed.pathname.startsWith(`/repos/${repository}/`) || parsed.pathname === `/repos/${repository}`)) ||
    (parsed.hostname === 'uploads.github.com' && parsed.pathname.startsWith(`/repos/${repository}/releases/`))
  );
  if (!allowed) throw new Error('GitHub API 目标不在本项目白名单');
  const result = await fetch(url, {
    method, redirect: 'error', signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'resume-application-assistant-release',
      ...(body === undefined ? {} : { 'Content-Type': contentType }),
    },
    body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body),
  });
  if (!result.ok) throw new Error(`GitHub ${method} ${parsed.pathname} 返回 HTTP ${result.status}`);
  return result.json();
}

try {
  if (process.argv[2] !== '--publish') throw new Error('此命令会发布公开Release；仅在用户要求发布时使用 node scripts/github-release.mjs --publish');
  if (git('remote', 'get-url', 'origin') !== `https://github.com/${repository}.git`) throw new Error('origin 与用户确认的仓库不一致');
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('版本号无效');
  const tag = `v${version}`;
  const head = git('rev-parse', 'HEAD');
  const releaseDir = path.join(root, 'artifacts', 'releases', tag);
  const names = [`resume-application-assistant-${tag}.zip`, 'SHA256SUMS.txt'];
  const files = names.map(name => ({ name, bytes: fs.readFileSync(path.join(releaseDir, name)) }));
  const packageReport = JSON.parse(fs.readFileSync(path.join(releaseDir, 'package-check.json'), 'utf8'));
  if (packageReport.result !== 'pass' || packageReport.sha256 !== hash(files[0].bytes)) throw new Error('安装包未通过本地校验或已变化');
  if (files.some(file => file.bytes.length > 20 * 1024 * 1024)) throw new Error('附件超过本项目发布大小上限');
  const notes = fs.readFileSync(path.join(root, 'docs', `发布说明-${version}.md`), 'utf8');

  // Standard Git credential-helper use for the same GitHub account and destination.
  // Capture only inside this process; never print, export, log or save the response.
  let credentialBytes;
  try {
    credentialBytes = execFileSync('git', ['-c', 'credential.interactive=never', 'credential', 'fill'], {
      cwd: root, input: `protocol=https\nhost=github.com\nusername=${owner}\n\n`, timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    token = credentialBytes.toString('utf8').split(/\r?\n/).find(line => line.startsWith('password='))?.slice(9) || '';
  } catch { throw new Error('本机Git凭据不可用；请通过官方登录流程重新授权，不能把Token写进文件'); }
  finally { credentialBytes?.fill(0); }
  if (!token) throw new Error('本机Git没有可用凭据');
  const identity = await request('https://api.github.com/user');
  if (identity.login !== owner) throw new Error('登录账号与已确认账号不一致');
  const repo = await request(apiRoot);
  if (repo.private || repo.visibility !== 'public' || repo.full_name !== repository) throw new Error('仓库身份或公开可见性不符合用户当前要求');
  const remote = await request(`${apiRoot}/git/ref/heads/main`);
  if (remote.object.sha !== head) throw new Error('先推送当前提交，远程main与本地HEAD必须一致');

  const releases = await request(`${apiRoot}/releases?per_page=100`);
  let release = releases.find(item => item.tag_name === tag);
  if (release && release.target_commitish !== head) throw new Error('同名Release已指向其他提交；不覆盖版本，请核对后提升版本');
  if (!release) {
    release = await request(`${apiRoot}/releases`, 'POST', {
      tag_name: tag, target_commitish: head, name: `简历网申投递助手 ${version}`,
      body: notes, draft: true, prerelease: false,
    });
    console.log(`已创建 ${tag} 草稿，准备上传两个已校验附件。`);
  }
  const assets = await request(`${apiRoot}/releases/${release.id}/assets`);
  for (const file of files) {
    let asset = assets.find(item => item.name === file.name);
    if (!asset) {
      if (!release.draft) throw new Error('已发布版本缺少附件，不静默改变；请人工核对');
      const uploadURL = new URL(`https://uploads.github.com/repos/${repository}/releases/${release.id}/assets`);
      uploadURL.searchParams.set('name', file.name);
      asset = await request(uploadURL.href, 'POST', file.bytes, file.name.endsWith('.zip') ? 'application/zip' : 'text/plain');
    }
    if (asset.state !== 'uploaded' || asset.size !== file.bytes.length || asset.digest !== `sha256:${hash(file.bytes)}`)
      throw new Error(`远程附件校验不一致：${file.name}；不删除或覆盖已有附件`);
    console.log(`附件已验证：${file.name}（${asset.size} 字节，SHA256一致）`);
  }
  if (release.draft) release = await request(`${apiRoot}/releases/${release.id}`, 'PATCH', { draft: false, make_latest: 'true' });
  release = await request(`${apiRoot}/releases/${release.id}`);
  if (release.draft || !release.published_at) throw new Error('Release 未成功发布');
  const tagRef = await request(`${apiRoot}/git/ref/tags/${tag}`);
  if (tagRef.object.type !== 'commit' || tagRef.object.sha !== head) throw new Error('发布标签未指向本次验证提交');
  const report = {
    result: 'pass', time: new Date().toISOString(), repository, private: repo.private, visibility: repo.visibility,
    head, tag, url: release.html_url,
    assets: release.assets.map(({ name, size, digest, state, browser_download_url }) => ({ name, size, digest, state, url: browser_download_url })),
  };
  fs.writeFileSync(path.join(root, 'artifacts', 'github-release.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await checkpoint({ step: '公开Release发布并远程核验', result: 'success', summary: `${tag}发布成功；两个附件大小和GitHub SHA256摘要与本地一致；标签对应已推送HEAD，仓库公开。凭据只在进程内使用`, next: '更新STATUS和中文维护说明，提交推送交接记录' });
} catch (error) {
  // Do not print request headers, credential subprocess results or raw fetch objects.
  const message = error instanceof Error ? error.message : '发布失败';
  console.error(message);
  await checkpoint({ step: '公开Release发布', result: 'failure', summary: message, next: '核对远程草稿、附件状态和失败原因；不强制覆盖版本' });
  process.exitCode = 1;
} finally { token = ''; }
