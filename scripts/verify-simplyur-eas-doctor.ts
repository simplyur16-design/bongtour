/**
 * REGRESSION-FREEZE[simplyur-eas-doctor-sdk57]: EAS expo-doctor — function config + SDK pins — manifest
 * Object-export app.config.js + stale SDK 57 patches fail `npx expo-doctor` on production AAB.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, 'apps', 'simplyur-mobile', 'app.config.js');
const pkgPath = path.join(root, 'apps', 'simplyur-mobile', 'package.json');
const easPath = path.join(root, 'apps', 'simplyur-mobile', 'eas.json');

const configSrc = fs.readFileSync(configPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
  dependencies: Record<string, string>;
};
const eas = JSON.parse(fs.readFileSync(easPath, 'utf8')) as {
  build?: { production?: { android?: { buildType?: string } } };
};

const errors: string[] = [];

if (!configSrc.includes('REGRESSION-FREEZE[simplyur-eas-doctor-sdk57]')) {
  errors.push('app.config.js missing freeze marker');
}
if (!/module\.exports\s*=\s*\(\s*\{\s*config\s*\}/.test(configSrc)) {
  errors.push('app.config.js must export ({ config }) so expo-doctor uses app.json');
}
if (!configSrc.includes('...config')) {
  errors.push('app.config.js must spread ...config');
}
if (/module\.exports\s*=\s*\{/.test(configSrc)) {
  errors.push('app.config.js must not object-export (doctor treats app.json as unused)');
}

const expo = pkg.dependencies.expo;
const rn = pkg.dependencies['react-native'];
if (expo !== '~57.0.18') {
  errors.push(`package.json expo must be ~57.0.18 (got ${expo})`);
}
if (rn !== '0.86.3') {
  errors.push(`package.json react-native must be 0.86.3 (got ${rn})`);
}

const buildType = eas.build?.production?.android?.buildType;
if (buildType !== 'app-bundle') {
  errors.push(`eas.json production android.buildType must be app-bundle (got ${buildType})`);
}

if (errors.length) {
  console.error('FAIL simplyur-eas-doctor-sdk57:\n' + errors.map((e) => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('OK: simplyur EAS doctor pins (function config, SDK 57.0.18, AAB)');
