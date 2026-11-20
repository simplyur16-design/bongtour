/**
 * Patch a generated android/app/build.gradle for local Play upload signing.
 * Usage: node patch-android-release-signing.js <build.gradle> <keystore.properties> [app.json]
 *
 * - signingConfigs.release reads keyAlias / keyPassword / storeFile / storePassword from
 *   <keystore.properties> at Gradle time. Values are never read, printed, or written here.
 * - buildTypes.release -> signingConfig signingConfigs.release (buildTypes.debug untouched).
 * - versionName <- app.json expo.version
 * - versionCode <- SIMPLYUR_VERSION_CODE (optional override) || app.json expo.android.versionCode
 * Also repairs files already run through the old script (buildTypes.debug flipped to release).
 * Works on old (SDK 51) and new (SDK 57) Expo templates, LF or CRLF; safe to run repeatedly.
 */
const fs = require("fs");
const path = require("path");

const LOADER_MARKER = "// simplyur-release-signing: keystore loader";
const RELEASE_MARKER = "// simplyur-release-signing: release signingConfig";

/** Index just past the `{` that closes at the matching `}`; skips strings and comments. */
function findBlockEnd(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (c === "/" && n === "/") {
      const e = text.indexOf("\n", i);
      i = e === -1 ? text.length : e;
      continue;
    }
    if (c === "/" && n === "*") {
      const e = text.indexOf("*/", i + 2);
      i = e === -1 ? text.length : e + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === "\\") i++;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Find a named block `name {` whose start is in [from, to) at nesting depth 0 relative to `from`. */
function findChildBlock(text, name, from, to) {
  const re = new RegExp(`(^|[\\s{;])${name}\\s*\\{`, "g");
  re.lastIndex = from;
  let m;
  while ((m = re.exec(text)) && m.index < to) {
    const open = text.indexOf("{", m.index + m[1].length);
    // depth check: count braces between from and open
    const slice = text.slice(from, open);
    const stripped = slice.replace(/\/\/.*$/gm, "").replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
    const depth = (stripped.match(/\{/g) || []).length - (stripped.match(/\}/g) || []).length;
    if (depth !== 0) continue;
    const close = findBlockEnd(text, open);
    if (close === -1 || close > to) throw new Error(`unbalanced ${name} block`);
    return { start: m.index + m[1].length, open, close };
  }
  return null;
}

function inner(block) {
  return { from: block.open + 1, to: block.close };
}

function indentAt(text, idx) {
  const ls = text.lastIndexOf("\n", idx - 1) + 1;
  return /^[ \t]*/.exec(text.slice(ls))[0];
}

function groovyPath(p) {
  return String(p).replace(/\\/g, "/").replace(/'/g, "\\'");
}

function readAppVersion(appJsonPath) {
  const app = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
  const expo = app.expo || app;
  const versionName = expo.version;
  const versionCode = expo.android && expo.android.versionCode;
  if (typeof versionName !== "string" || !/^\d+(\.\d+)*$/.test(versionName)) {
    throw new Error(`app.json expo.version invalid: ${JSON.stringify(versionName)}`);
  }
  return { versionName, versionCode };
}

function resolveVersionCode(appVersionCode, envValue) {
  const raw = envValue != null && String(envValue).trim() !== "" ? envValue : appVersionCode;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`versionCode invalid (SIMPLYUR_VERSION_CODE / app.json android.versionCode): ${JSON.stringify(raw)}`);
  }
  return n;
}

/**
 * @param {string} source build.gradle text
 * @param {{ keystorePropsPath: string, versionName: string, versionCode: number }} opts
 */
function patchBuildGradle(source, opts) {
  const crlf = source.includes("\r\n");
  let t = source.replace(/\r\n/g, "\n");
  const ks = groovyPath(opts.keystorePropsPath);

  // 1) RN node_modules dir (kept from the previous script).
  if (!t.includes("ext.REACT_NATIVE_NODE_MODULES_DIR")) {
    const a = findChildBlock(t, "android", 0, t.length);
    if (!a) throw new Error("android block not found");
    t =
      t.slice(0, a.start) +
      'ext.REACT_NATIVE_NODE_MODULES_DIR = file("${rootDir}/../node_modules/react-native").absolutePath\n\n' +
      t.slice(a.start);
  }

  // 2) keystore.properties loader before `android {` (path refreshed on every run).
  const loader =
    `${LOADER_MARKER}\n` +
    "def simplyurReleaseKeystore = new Properties()\n" +
    `def simplyurReleaseKeystoreFile = file('${ks}')\n` +
    "if (simplyurReleaseKeystoreFile.exists()) {\n" +
    "    simplyurReleaseKeystoreFile.withInputStream { simplyurReleaseKeystore.load(it) }\n" +
    "}\n";
  if (/def simplyurReleaseKeystoreFile = file\('[^'\n]*'\)/.test(t)) {
    t = t.replace(/def simplyurReleaseKeystoreFile = file\('[^'\n]*'\)/, () => `def simplyurReleaseKeystoreFile = file('${ks}')`);
  } else {
    const a = findChildBlock(t, "android", 0, t.length);
    if (!a) throw new Error("android block not found");
    t = t.slice(0, a.start) + loader + "\n" + t.slice(a.start);
  }

  let android = findChildBlock(t, "android", 0, t.length);
  if (!android) throw new Error("android block not found");

  // 3) versionName / versionCode in defaultConfig.
  const dc = findChildBlock(t, "defaultConfig", inner(android).from, inner(android).to);
  if (!dc) throw new Error("defaultConfig block not found");
  let dcBody = t.slice(dc.open + 1, dc.close);
  const dcIndent = indentAt(t, dc.start) + "    ";
  const vName = `versionName "${opts.versionName}"`;
  const vCode = `versionCode ${opts.versionCode}`;
  dcBody = /^\s*versionCode\s+\S+/m.test(dcBody)
    ? dcBody.replace(/^(\s*)versionCode\s+\S+/m, (_, s) => s + vCode)
    : `\n${dcIndent}${vCode}` + dcBody;
  dcBody = /^\s*versionName\s+\S+/m.test(dcBody)
    ? dcBody.replace(/^(\s*)versionName\s+.*$/m, (_, s) => s + vName)
    : dcBody.replace(new RegExp(`(^\\s*${vCode.replace(/\s+/, "\\s+")}.*$)`, "m"), `$1\n${dcIndent}${vName}`);
  t = t.slice(0, dc.open + 1) + dcBody + t.slice(dc.close);

  // 4) signingConfigs { release { ... } }
  android = findChildBlock(t, "android", 0, t.length);
  let sc = findChildBlock(t, "signingConfigs", inner(android).from, inner(android).to);
  const aIndent = indentAt(t, android.start) + "    ";
  if (!sc) {
    const bt0 = findChildBlock(t, "buildTypes", inner(android).from, inner(android).to);
    const at = bt0 ? bt0.start : android.close;
    t = t.slice(0, at) + `signingConfigs {\n${aIndent}}\n${aIndent}` + t.slice(at);
    android = findChildBlock(t, "android", 0, t.length);
    sc = findChildBlock(t, "signingConfigs", inner(android).from, inner(android).to);
  }
  if (!findChildBlock(t, "release", inner(sc).from, inner(sc).to)) {
    const i1 = aIndent + "    ";
    const i2 = i1 + "    ";
    const i3 = i2 + "    ";
    const block =
      `\n${i1}${RELEASE_MARKER}\n` +
      `${i1}release {\n` +
      `${i2}if (simplyurReleaseKeystoreFile.exists()) {\n` +
      `${i3}keyAlias simplyurReleaseKeystore['keyAlias']\n` +
      `${i3}keyPassword simplyurReleaseKeystore['keyPassword']\n` +
      `${i3}storeFile file(simplyurReleaseKeystore['storeFile'])\n` +
      `${i3}storePassword simplyurReleaseKeystore['storePassword']\n` +
      `${i2}}\n` +
      `${i1}}`;
    const dbg = findChildBlock(t, "debug", inner(sc).from, inner(sc).to);
    const at = dbg ? dbg.close + 1 : sc.open + 1;
    t = t.slice(0, at) + block + t.slice(at);
  }

  // 5) buildTypes { release { signingConfig signingConfigs.release } }
  android = findChildBlock(t, "android", 0, t.length);
  const bt = findChildBlock(t, "buildTypes", inner(android).from, inner(android).to);
  if (!bt) throw new Error("buildTypes block not found");
  const rel = findChildBlock(t, "release", inner(bt).from, inner(bt).to);
  if (!rel) throw new Error("buildTypes.release block not found");
  let relBody = t.slice(rel.open + 1, rel.close);
  if (/^\s*signingConfig\s+\S+/m.test(relBody)) {
    relBody = relBody.replace(/^(\s*)signingConfig\s+\S+/gm, (_, s) => s + "signingConfig signingConfigs.release");
  } else {
    relBody = `\n${indentAt(t, rel.start)}    signingConfig signingConfigs.release` + relBody;
  }
  t = t.slice(0, rel.open + 1) + relBody + t.slice(rel.close);

  // 6) Undo the old script's bug: its lazy regex could flip buildTypes.debug to release signing.
  android = findChildBlock(t, "android", 0, t.length);
  const bt2 = findChildBlock(t, "buildTypes", inner(android).from, inner(android).to);
  const dbgBt = findChildBlock(t, "debug", inner(bt2).from, inner(bt2).to);
  if (dbgBt) {
    const b = t.slice(dbgBt.open + 1, dbgBt.close).replace(/^(\s*)signingConfig\s+signingConfigs\.release\b/m, "$1signingConfig signingConfigs.debug");
    t = t.slice(0, dbgBt.open + 1) + b + t.slice(dbgBt.close);
  }

  return crlf ? t.replace(/\n/g, "\r\n") : t;
}

/** Small read-back used by tests and the CLI self-check. No secret values involved. */
function inspectBuildGradle(source) {
  const t = source.replace(/\r\n/g, "\n");
  const android = findChildBlock(t, "android", 0, t.length);
  const body = (b) => t.slice(b.open + 1, b.close);
  const sc = findChildBlock(t, "signingConfigs", inner(android).from, inner(android).to);
  const bt = findChildBlock(t, "buildTypes", inner(android).from, inner(android).to);
  const dc = findChildBlock(t, "defaultConfig", inner(android).from, inner(android).to);
  const sig = (b) => {
    if (!b) return null;
    const m = /^\s*signingConfig\s+signingConfigs\.(\w+)/m.exec(body(b));
    return m ? m[1] : null;
  };
  return {
    hasReleaseSigningConfig: !!(sc && findChildBlock(t, "release", inner(sc).from, inner(sc).to)),
    debugBuildTypeSigning: sig(bt && findChildBlock(t, "debug", inner(bt).from, inner(bt).to)),
    releaseBuildTypeSigning: sig(bt && findChildBlock(t, "release", inner(bt).from, inner(bt).to)),
    versionName: (/^\s*versionName\s+"([^"]*)"/m.exec(body(dc)) || [])[1] || null,
    versionCode: Number((/^\s*versionCode\s+(\d+)/m.exec(body(dc)) || [])[1]) || null,
  };
}

function main(argv) {
  const [gradlePath, ksPropsPath, appJsonArg] = argv;
  if (!gradlePath || !ksPropsPath) {
    console.error("usage: node patch-android-release-signing.js <build.gradle> <keystore.properties> [app.json]");
    process.exit(1);
  }
  const appJsonPath = appJsonArg || path.join(__dirname, "..", "app.json");
  const app = readAppVersion(appJsonPath);
  const versionCode = resolveVersionCode(app.versionCode, process.env.SIMPLYUR_VERSION_CODE);
  const src = fs.readFileSync(gradlePath, "utf8");
  const out = patchBuildGradle(src, { keystorePropsPath: ksPropsPath, versionName: app.versionName, versionCode });
  const r = inspectBuildGradle(out);
  if (!r.hasReleaseSigningConfig || r.releaseBuildTypeSigning !== "release" || r.versionName !== app.versionName) {
    console.error("gradle patch self-check failed");
    process.exit(1);
  }
  fs.writeFileSync(gradlePath, out);
  console.log(`gradle_patched versionName=${r.versionName} versionCode=${r.versionCode} release=signingConfigs.release`);
}

module.exports = { patchBuildGradle, inspectBuildGradle, readAppVersion, resolveVersionCode };

if (require.main === module) main(process.argv.slice(2));
