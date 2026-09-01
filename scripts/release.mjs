#!/usr/bin/env node
/*
 * Bump the app version in the two places that must agree.
 *
 *   npm run release -- 1.1.0
 *
 * versionName is what people see; versionCode is what Android compares when deciding
 * whether an APK is an update. Bumping the name without the code means the new build
 * silently refuses to install over the old one, so both move here or neither does.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const GRADLE = join(root, 'android', 'app', 'build.gradle');
const PKG = join(root, 'package.json');

const version = process.argv[2];
if (!version) {
  console.error('Usage: npm run release -- <version>      e.g. npm run release -- 1.1.0');
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`"${version}" is not MAJOR.MINOR.PATCH`);
  process.exit(1);
}

let gradle = readFileSync(GRADLE, 'utf8');

const codeMatch = gradle.match(/versionCode\s+(\d+)/);
const nameMatch = gradle.match(/versionName\s+"([^"]+)"/);
if (!codeMatch || !nameMatch) {
  console.error(`Could not find versionCode/versionName in ${GRADLE}`);
  process.exit(1);
}

const oldCode = Number(codeMatch[1]);
const oldName = nameMatch[1];
if (oldName === version) {
  console.error(`Already at ${version}. Pick a higher version.`);
  process.exit(1);
}
const newCode = oldCode + 1;

gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${newCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
writeFileSync(GRADLE, gradle);

const pkg = JSON.parse(readFileSync(PKG, 'utf8'));
pkg.version = version;
writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n');

console.log(`  versionName  ${oldName} -> ${version}`);
console.log(`  versionCode  ${oldCode} -> ${newCode}`);
console.log(`  package.json -> ${version}`);
console.log(`
Next:
  1. Add a "## [${version}]" section to CHANGELOG.md
  2. npx cap sync android && (cd android && ./gradlew.bat assembleDebug)
  3. git commit -am "Release ${version}"
  4. git tag -a v${version} -m "v${version}"
  5. git push --follow-tags
  6. Attach android/app/build/outputs/apk/debug/app-debug.apk to the GitHub Release`);
