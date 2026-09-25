/**
 * Patch a generated android/app/build.gradle for local Play upload signing.
 * Usage: node patch-android-release-signing.js <build.gradle> <keystore.properties>
 */
const fs = require("fs");

const gradlePath = process.argv[2];
const ksPropsPath = process.argv[3];
if (!gradlePath || !ksPropsPath) {
  console.error("usage: patch-android-release-signing.js <build.gradle> <keystore.properties>");
  process.exit(1);
}

const ks = ksPropsPath.replace(/\\/g, "/");
let t = fs.readFileSync(gradlePath, "utf8");
// Play rejects reused versionCode — bump every upload (was stuck at 11).
const versionCode = Number(process.env.SIMPLYUR_VERSION_CODE || "12");
if (!Number.isFinite(versionCode) || versionCode < 1) {
  console.error("invalid SIMPLYUR_VERSION_CODE");
  process.exit(1);
}
t = t.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
if (/versionName\s+"[^"]+"/.test(t)) {
  t = t.replace(/versionName\s+"[^"]+"/, 'versionName "1.0.0"');
}

if (!t.includes("REACT_NATIVE_NODE_MODULES_DIR")) {
  t = t.replace(
    "android {",
    [
      "ext.REACT_NATIVE_NODE_MODULES_DIR = file(\"${rootDir}/../node_modules/react-native\").absolutePath",
      "",
      "android {",
    ].join("\n"),
  );
}

if (!t.includes("simplyurReleaseKeystore")) {
  t = t.replace(
    "android {",
    [
      "def simplyurReleaseKeystore = new Properties()",
      `def simplyurReleaseKeystoreFile = file('${ks}')`,
      "if (simplyurReleaseKeystoreFile.exists()) {",
      "    simplyurReleaseKeystoreFile.withInputStream { simplyurReleaseKeystore.load(it) }",
      "}",
      "",
      "android {",
    ].join("\n"),
  );

  const debugBlock =
    "        debug {\n            storeFile file('debug.keystore')";
  const releaseBlock = [
    "        release {",
    "            if (simplyurReleaseKeystoreFile.exists()) {",
    "                keyAlias simplyurReleaseKeystore['keyAlias']",
    "                keyPassword simplyurReleaseKeystore['keyPassword']",
    "                storeFile file(simplyurReleaseKeystore['storeFile'])",
    "                storePassword simplyurReleaseKeystore['storePassword']",
    "            }",
    "        }",
    debugBlock,
  ].join("\n");
  if (!t.includes(debugBlock)) {
    console.error("debug signing block not found");
    process.exit(1);
  }
  t = t.replace(debugBlock, releaseBlock);
}

t = t.replace(
  /(release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
  "$1signingConfig signingConfigs.release",
);

fs.writeFileSync(gradlePath, t);
console.log("gradle_patched");
