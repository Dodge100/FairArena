/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LICENSE_HEADER = `/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */\n\n`;

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.prisma']);
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.next',
  '.vercel',
  'coverage',
  'build',
  'apminsightdata',
]);

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!IGNORED_DIRS.has(file)) {
        walk(fullPath, callback);
      }
    } else {
      callback(fullPath);
    }
  }
}

const isCheckMode = process.argv.includes('--check');

console.log(
  isCheckMode ? '🔍 Checking License Headers...' : '🚀 Starting License Header Injection...',
);

let count = 0;
let skipped = 0;
let missing = [];

// Root directory of the project
const rootDir = path.resolve(__dirname, '..');

walk(rootDir, (filePath) => {
  const ext = path.extname(filePath);
  if (!EXTENSIONS.has(ext)) return;

  // Skip license files themselves
  if (path.basename(filePath).toLowerCase().includes('license')) return;

  const content = fs.readFileSync(filePath, 'utf8');

  // Check if header already exists
  if (content.includes('@license') || content.includes('Copyright (c) 2026 FairArena')) {
    skipped++;
    return;
  }

  if (isCheckMode) {
    missing.push(path.relative(rootDir, filePath));
  } else {
    // Prepend header
    const newContent = LICENSE_HEADER + content;
    fs.writeFileSync(filePath, newContent, 'utf8');
    count++;
    console.log(`✅ Applied to: ${path.relative(rootDir, filePath)}`);
  }
});

console.log('\n--- Summary ---');
if (isCheckMode) {
  if (missing.length > 0) {
    console.log(`❌ ${missing.length} files are missing the license header:`);
    missing.forEach((f) => console.log(`   - ${f}`));
    process.exit(1);
  } else {
    console.log('✅ All files have the license header.');
  }
} else {
  console.log(`✨ Total files updated: ${count}`);
}
console.log(`⏩ Files already labeled (skipped): ${skipped}`);
console.log('--- Done ---');
