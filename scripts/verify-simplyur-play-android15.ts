/**
 * REGRESSION-FREEZE[simplyur-play-android15-large-screen]: Play Android 15 window APIs + Android 16 portrait lock — manifest
 * Play Console flagged version 1.0.0 (6) for Window.setStatusBarColor / cutout modes
 * and MainActivity screenOrientation=PORTRAIT.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = process.cwd();
const mobile = path.join(root, 'apps', 'simplyur-mobile');
const errors: string[] = [];

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const appJson = JSON.parse(read('apps/simplyur-mobile/app.json')) as {
  expo?: {
    orientation?: string;
    androidStatusBar?: { barStyle?: string; backgroundColor?: string };
    android?: { edgeToEdgeEnabled?: boolean };
  };
};
const configSrc = read('apps/simplyur-mobile/app.config.js');
const layoutSrc = read('apps/simplyur-mobile/app/_layout.tsx');
const pkg = JSON.parse(read('apps/simplyur-mobile/package.json')) as {
  dependencies?: Record<string, string>;
};

if (!configSrc.includes('REGRESSION-FREEZE[simplyur-play-android15-large-screen]')) {
  errors.push('app.config.js missing play-android15 freeze marker');
}
if (!layoutSrc.includes('REGRESSION-FREEZE[simplyur-play-android15-large-screen]')) {
  errors.push('app/_layout.tsx missing play-android15 freeze marker');
}

if (appJson.expo?.orientation !== 'default') {
  errors.push(`app.json orientation must be default (got ${appJson.expo?.orientation})`);
}
if (appJson.expo?.android?.edgeToEdgeEnabled !== true) {
  errors.push('app.json android.edgeToEdgeEnabled must be true');
}
if (appJson.expo?.androidStatusBar?.backgroundColor) {
  errors.push('app.json androidStatusBar.backgroundColor must not be set (deprecated Window.setStatusBarColor)');
}
if (appJson.expo?.androidStatusBar?.barStyle !== 'dark-content') {
  errors.push('app.json androidStatusBar.barStyle must be dark-content (no color APIs)');
}

if (!configSrc.includes('enableMinifyInReleaseBuilds: true')) {
  errors.push('app.config.js must enable R8 enableMinifyInReleaseBuilds');
}
if (!configSrc.includes('enableShrinkResourcesInReleaseBuilds: true')) {
  errors.push('app.config.js must enable enableShrinkResourcesInReleaseBuilds');
}
if (!configSrc.includes("'react-native-edge-to-edge'")) {
  errors.push('app.config.js must register react-native-edge-to-edge plugin');
}
if (!configSrc.includes('useLegacyPackaging: false')) {
  errors.push('app.config.js must set useLegacyPackaging: false');
}

if (!layoutSrc.includes("from 'react-native-edge-to-edge'")) {
  errors.push('app/_layout.tsx must import SystemBars from react-native-edge-to-edge');
}
if (!layoutSrc.includes('<SystemBars')) {
  errors.push('app/_layout.tsx must render SystemBars');
}
if (/from ['"]expo-status-bar['"]/.test(layoutSrc) || /from ['"]react-native['"].*StatusBar/.test(layoutSrc)) {
  errors.push('app/_layout.tsx must not import StatusBar (deprecated color APIs)');
}

const deps = pkg.dependencies ?? {};
if (!deps['expo-build-properties']) {
  errors.push('package.json missing expo-build-properties');
}
if (!deps['react-native-edge-to-edge']) {
  errors.push('package.json missing react-native-edge-to-edge');
}

const skip = new Set(['node_modules', '.expo', 'android', 'ios', 'dist', 'aab']);
const banned = [
  /statusBarBackgroundColor/,
  /setStatusBarBackgroundColor/,
  /navigationBarColor\s*:/,
  /StatusBar\.setBackgroundColor/,
];
function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}
for (const file of walk(mobile)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const re of banned) {
    if (re.test(src)) {
      errors.push(`${path.relative(root, file)} uses banned status/nav bar color API (${re})`);
    }
  }
}

if (errors.length) {
  console.error('FAIL simplyur-play-android15-large-screen:\n' + errors.map((e) => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('OK: simplyur Play Android 15 edge-to-edge + default orientation + R8');
