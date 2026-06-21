#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWin = process.platform === 'win32';
const binName = isWin ? 'launchwhitely.exe' : 'launchwhitely';
const binPath = path.join(__dirname, binName);

if (!fs.existsSync(binPath)) {
  const msg = [
    'launchwhitely binary not found.',
    'This usually means the postinstall script failed.',
    '',
    'Try:  npm install -g launchwhitely',
    'Or:   cargo install launchwhitely',
  ].join('\n');
  console.error(msg);
  process.exit(1);
}

const result = spawnSync(binPath, process.argv.slice(2), { stdio: 'inherit' });

// spawnSync status is null when the process was killed by a signal
process.exit(result.status ?? 1);
