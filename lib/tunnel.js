'use strict';
/**
 * 🌍 내 컴퓨터의 게임 서버를 인터넷에 여는 도구 (Cloudflare 무료 "빠른 터널")
 *  - 가입·카드 등록이 필요 없어요. 켤 때마다 https://xxxx.trycloudflare.com 주소가 새로 만들어져요.
 *  - cloudflared 프로그램이 없으면 처음 한 번 GitHub에서 자동으로 내려받아 bin/ 폴더에 저장해요.
 *  - 인터넷에 열리는 것은 이 게임 서버(포트 하나)뿐이고, 컴퓨터의 다른 파일은 열리지 않아요.
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const BIN_DIR = path.join(__dirname, '..', 'bin');
const RELEASE = 'https://github.com/cloudflare/cloudflared/releases/latest/download/';
const ASSETS = {
  win32: { x64: 'cloudflared-windows-amd64.exe', arm64: 'cloudflared-windows-amd64.exe', ia32: 'cloudflared-windows-386.exe' },
  linux: { x64: 'cloudflared-linux-amd64', arm64: 'cloudflared-linux-arm64', arm: 'cloudflared-linux-arm' },
  darwin: { x64: 'cloudflared-darwin-amd64.tgz', arm64: 'cloudflared-darwin-arm64.tgz' },
};
const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

const exeName = () => (process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
const works = cmd => { try { return spawnSync(cmd, ['--version'], { stdio: 'ignore', timeout: 15000 }).status === 0; } catch { return false; } };

/** 파일 내려받기 (GitHub는 다른 주소로 넘겨주므로 따라감) */
function download(url, dest, onProgress, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 6) return reject(new Error('리다이렉트가 너무 많아요'));
    https.get(url, { headers: { 'User-Agent': 'minigame-heaven' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(download(new URL(res.headers.location, url).toString(), dest, onProgress, hops + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`다운로드 실패 (HTTP ${res.statusCode})`)); }
      const total = Number(res.headers['content-length']) || 0;
      let got = 0;
      const tmp = dest + '.part', out = fs.createWriteStream(tmp);
      res.on('data', c => { got += c.length; if (total) onProgress(got / total); });
      res.pipe(out);
      out.on('finish', () => out.close(() => { fs.renameSync(tmp, dest); resolve(dest); }));
      out.on('error', reject);
    }).on('error', reject);
  });
}

/** cloudflared 찾기: 직접 지정 → 설치된 것 → bin 폴더 → 자동 다운로드 */
async function findCloudflared(log) {
  if (process.env.CLOUDFLARED_PATH) return process.env.CLOUDFLARED_PATH;
  const local = path.join(BIN_DIR, exeName());
  if (fs.existsSync(local)) return local;
  if (works('cloudflared')) return 'cloudflared';
  const asset = (ASSETS[process.platform] || {})[process.arch];
  if (!asset) throw new Error(`이 운영체제(${process.platform}/${process.arch})용 cloudflared 자동 설치를 지원하지 않아요.`);
  fs.mkdirSync(BIN_DIR, { recursive: true });
  log('📦 인터넷 연결 도구(cloudflared)를 처음 한 번 내려받는 중이에요… (약 20~40MB)');
  let shown = -1;
  const target = asset.endsWith('.tgz') ? path.join(BIN_DIR, asset) : local;
  await download(RELEASE + asset, target, p => { const pct = Math.floor(p * 10) * 10; if (pct !== shown) { shown = pct; process.stdout.write(`   ${pct}% `); } });
  process.stdout.write('\n');
  if (asset.endsWith('.tgz')) {                                   // macOS: 압축 풀기
    spawnSync('tar', ['-xzf', target, '-C', BIN_DIR]);
    fs.unlinkSync(target);
  }
  if (process.platform !== 'win32') fs.chmodSync(local, 0o755);
  log('✅ 내려받기 완료!');
  return local;
}

/**
 * 터널 시작. 주소가 준비되면 onUrl(url), 끊기면 onDown() 을 부릅니다.
 * 터널이 꺼지면 몇 초 뒤 자동으로 다시 켭니다 (그때 주소는 새로 바뀌어요).
 */
async function startTunnel(port, { onUrl, onDown, log = console.log }) {
  let bin;
  try { bin = await findCloudflared(log); }
  catch (e) {
    log(`\n❌ 인터넷 공개 도구를 준비하지 못했어요: ${e.message}`);
    log('   → 인터넷 연결을 확인하거나, 아래 주소에서 직접 내려받아 이 폴더의 bin 폴더에 cloudflared.exe 로 넣어 주세요.');
    log('     https://github.com/cloudflare/cloudflared/releases/latest');
    log('   (같은 와이파이 친구들은 지금도 아래 주소로 들어올 수 있어요)\n');
    return null;
  }
  let child = null, stopped = false, tries = 0;
  const run = () => {
    let url = null, announced = false, buf = '';
    const announce = () => { if (!announced && url) { announced = true; tries = 0; onUrl(url); } };
    log('🌍 인터넷 주소를 만드는 중이에요… (10초 정도 걸려요)');
    child = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    child.stderr.on('data', chunk => {
      buf = (buf + chunk.toString()).slice(-4000);
      if (!url) { const m = buf.match(URL_RE); if (m) { url = m[0]; setTimeout(announce, 6000); } }   // 주소가 퍼질 때까지 잠깐 기다림
      if (url && /Registered tunnel connection/i.test(buf)) announce();
    });
    child.on('error', e => log(`❌ cloudflared 실행 오류: ${e.message}`));
    child.on('exit', code => {
      if (stopped) return;
      if (announced) onDown();
      tries++;
      const wait = Math.min(30, 5 * tries);
      log(`⚠️  인터넷 연결이 끊겼어요 (코드 ${code}). ${wait}초 뒤 다시 연결합니다…`);
      if (!url && /config\.ya?ml/i.test(buf)) log('   (사용자 폴더의 .cloudflared\\config.yml 파일이 있으면 빠른 터널이 안 될 수 있어요. 잠시 이름을 바꿔 보세요.)');
      setTimeout(() => { if (!stopped) run(); }, wait * 1000);
    });
  };
  run();
  const stop = () => { stopped = true; if (child) try { child.kill(); } catch { /* 이미 꺼짐 */ } };
  process.on('exit', stop);
  ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => { stop(); process.exit(0); }));
  return { stop };
}

module.exports = { startTunnel, download, URL_RE };
