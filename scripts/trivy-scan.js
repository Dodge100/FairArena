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

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TRIVY_VERSION = '0.69.1';
const REPO_ROOT = path.resolve(__dirname, '..');
const TRIVY_BIN_PATH = path.join(
  REPO_ROOT,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'trivy.exe' : 'trivy',
);
const TRIVY_CONFIG_PATH = path.join(REPO_ROOT, 'trivy.yaml');
const TRIVY_IGNORE_PATH = path.join(REPO_ROOT, '.trivyignore');
const TRIVY_OUTPUT_PATH = path.join(REPO_ROOT, 'trivy-results.json');

function installTrivy() {
  console.log('Installing Trivy...');
  try {
    const isWindows = process.platform === 'win32';
    const platform = isWindows ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';
    const arch = process.arch === 'x64' ? '64bit' : 'ARM64';
    const ext = isWindows ? 'zip' : 'tar.gz';

    const downloadUrl = `https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_${platform}-${arch}.${ext}`;

    if (isWindows) {
      // Use PowerShell to download and extract
      execSync(
        `powershell -Command "Invoke-WebRequest -Uri '${downloadUrl}' -OutFile 'trivy.${ext}'"`,
        { stdio: 'inherit' },
      );
      execSync(
        `powershell -Command "Expand-Archive -Path 'trivy.${ext}' -DestinationPath '.' -Force"`,
        { stdio: 'inherit' },
      );
      execSync(`move trivy.exe "${TRIVY_BIN_PATH}"`, { stdio: 'inherit' });
      execSync(`del trivy.${ext}`, { stdio: 'inherit' });
    } else {
      execSync(`curl -L ${downloadUrl} -o trivy.${ext}`, { stdio: 'inherit' });
      execSync(`tar -xzf trivy.${ext}`, { stdio: 'inherit' });
      execSync(`mv trivy "${TRIVY_BIN_PATH}"`, { stdio: 'inherit' });
      execSync(`rm trivy.${ext}`, { stdio: 'inherit' });
      execSync(`chmod +x "${TRIVY_BIN_PATH}"`, { stdio: 'inherit' });
    }

    console.log('Trivy installed successfully');
  } catch (error) {
    console.error('Failed to install Trivy:', error.message);
    console.log('Skipping Trivy scan for this commit');
    process.exit(0); // Don't fail the commit
  }
}

function runTrivyScan() {
  try {
    console.log('Running Trivy filesystem scan...');

    // Quick scan for high/critical vulnerabilities
    const command = `"${TRIVY_BIN_PATH}" fs --config "${TRIVY_CONFIG_PATH}" --output "${TRIVY_OUTPUT_PATH}" --ignorefile "${TRIVY_IGNORE_PATH}" --skip-db-update "${REPO_ROOT}"`;

    execSync(command, { stdio: 'inherit' });

    // Check results
    if (fs.existsSync(TRIVY_OUTPUT_PATH)) {
      const results = JSON.parse(fs.readFileSync(TRIVY_OUTPUT_PATH, 'utf8'));

      let vulnCount = 0;
      let secretCount = 0;

      if (results && results.Results) {
        results.Results.forEach((result) => {
          if (result.Vulnerabilities) vulnCount += result.Vulnerabilities.length;
          if (result.Secrets) secretCount += result.Secrets.length;
        });
      }

      if (vulnCount > 0 || secretCount > 0) {
        console.error(`\n\x1b[31mSecurity issues found:\x1b[0m`);
        if (vulnCount > 0) console.error(`\x1b[33m- ${vulnCount} vulnerabilities\x1b[0m`);
        if (secretCount > 0) console.error(`\x1b[33m- ${secretCount} secrets\x1b[0m`);
        console.error(`\nPlease review the trivy-results.json file for details.\n`);
        process.exit(1);
      } else {
        console.log('\x1b[32m✓ No high/critical security issues found\x1b[0m');
      }

      // Clean up
      fs.unlinkSync(TRIVY_OUTPUT_PATH);
    }
  } catch (error) {
    console.error('Trivy scan failed:', error.message);
    // Don't fail the commit for Trivy errors, just warn
    console.warn('Continuing with commit despite Trivy scan failure');
  }
}

function main() {
  // Check if Trivy is already installed
  if (!fs.existsSync(TRIVY_BIN_PATH)) {
    installTrivy();
  }

  runTrivyScan();
}

if (require.main === module) {
  main();
}
