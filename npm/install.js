#!/usr/bin/env node
'use strict';

const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const VERSION = require('./package.json').version;
const REPO = 'https://github.com/sakshamred/Meth-v12';
const BIN_DIR = path.join(__dirname, 'bin');

// ── Platform detection ─────────────────────────────────────────────────────

const TARGETS = {
  'linux/x64':    { target: 'x86_64-unknown-linux-gnu',  ext: 'tar.gz', exe: 'launchwhitely' },
  'linux/arm64':  { target: 'aarch64-unknown-linux-gnu', ext: 'tar.gz', exe: 'launchwhitely' },
  'darwin/x64':   { target: 'x86_64-apple-darwin',       ext: 'tar.gz', exe: 'launchwhitely' },
  'darwin/arm64': { target: 'aarch64-apple-darwin',      ext: 'tar.gz', exe: 'launchwhitely' },
  'win32/x64':    { target: 'x86_64-pc-windows-msvc',    ext: 'zip',    exe: 'launchwhitely.exe' },
};

function getDownloadInfo() {
  const key = `${process.platform}/${process.arch}`;
  const info = TARGETS[key];
  if (!info) {
    throw new Error(
      `Unsupported platform: ${key}\n` +
      `Supported: ${Object.keys(TARGETS).join(', ')}\n` +
      `Build from source: cargo install launchwhitely`
    );
  }
  const filename = `launchwhitely-${info.target}.${info.ext}`;
  const url = `https://github.com/${REPO}/releases/download/v${VERSION}/${filename}`;
  return { ...info, filename, url };
}

// ── Download with redirect following ─────────────────────────────────────

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (location, redirects) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      https.get(location, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return follow(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} downloading ${location}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
        res.on('error', reject);
      }).on('error', reject);
    };
    follow(url, 0);
  });
}

// ── Extract archive ────────────────────────────────────────────────────────

function extract(archive, ext, dest) {
  if (ext === 'tar.gz') {
    execSync(`tar -xzf "${archive}" -C "${dest}"`, { stdio: 'pipe' });
  } else {
    // Windows: use PowerShell Expand-Archive
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Force -Path '${archive}' -DestinationPath '${dest}'"`,
      { stdio: 'pipe' }
    );
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Skip install if running in CI without network or if binary already exists
  const info = getDownloadInfo();
  const exePath = path.join(BIN_DIR, info.exe);

  if (fs.existsSync(exePath)) {
    console.log(`launchwhitely already installed at ${exePath}`);
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lw-install-'));
  const archive = path.join(tmp, info.filename);

  try {
    process.stdout.write(`Downloading launchwhitely v${VERSION} (${info.target})... `);
    await download(info.url, archive);
    console.log('done');

    fs.mkdirSync(BIN_DIR, { recursive: true });
    extract(archive, info.ext, BIN_DIR);

    if (process.platform !== 'win32') {
      fs.chmodSync(exePath, 0o755);
    }

    console.log(`launchwhitely installed → ${exePath}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('\nlaunchwhitely install failed:', err.message);
  console.error('You can build from source: cargo install launchwhitely');
  process.exit(1);
});
