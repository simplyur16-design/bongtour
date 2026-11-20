import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const root = path.resolve(__dirname, "..", "..");
const patcher = require(path.join(root, "scripts", "patch-android-release-signing.js")) as {
  patchBuildGradle: (src: string, o: { keystorePropsPath: string; versionName: string; versionCode: number }) => string;
  inspectBuildGradle: (src: string) => {
    hasReleaseSigningConfig: boolean;
    debugBuildTypeSigning: string | null;
    releaseBuildTypeSigning: string | null;
    versionName: string | null;
    versionCode: number | null;
  };
  readAppVersion: (p: string) => { versionName: string; versionCode: unknown };
  resolveVersionCode: (appValue: unknown, env?: string) => number;
};

const fixture = (name: string) => readFileSync(path.join(root, "scripts", "__fixtures__", name), "utf8");
const app = patcher.readAppVersion(path.join(root, "app.json"));
const appJson = JSON.parse(readFileSync(path.join(root, "app.json"), "utf8"));
const opts = {
  keystorePropsPath: "D:\\fixture-only\\keystore.properties",
  versionName: app.versionName,
  versionCode: patcher.resolveVersionCode(app.versionCode),
};

/** Reproduces the previous script's buggy final regex, to check repair of already-patched files. */
const OLD_BUGGY = (t: string) =>
  t.replace(/(release \{[\s\S]*?)signingConfig signingConfigs\.debug/, "$1signingConfig signingConfigs.release");

describe("patch-android-release-signing", () => {
  it("reads versionName/versionCode from app.json", () => {
    expect(app.versionName).toBe(appJson.expo.version);
    expect(app.versionCode).toBe(appJson.expo.android.versionCode);
    expect(patcher.resolveVersionCode(16, "")).toBe(16);
    expect(patcher.resolveVersionCode(16, "17")).toBe(17);
    expect(() => patcher.resolveVersionCode(undefined)).toThrow();
  });

  for (const name of ["expo-sdk51-app.build.gradle", "expo-sdk57-app.build.gradle"]) {
    describe(name, () => {
      const src = fixture(name);

      it("pristine template signs release with debug (the bug's precondition)", () => {
        const r = patcher.inspectBuildGradle(src);
        expect(r.hasReleaseSigningConfig).toBe(false);
        expect(r.releaseBuildTypeSigning).toBe("debug");
      });

      it("adds signingConfigs.release and wires buildTypes.release to it", () => {
        const out = patcher.patchBuildGradle(src, opts);
        const r = patcher.inspectBuildGradle(out);
        expect(r.hasReleaseSigningConfig).toBe(true);
        expect(r.releaseBuildTypeSigning).toBe("release");
        expect(r.debugBuildTypeSigning).toBe("debug");
        expect(r.versionName).toBe(appJson.expo.version);
        expect(r.versionCode).toBe(appJson.expo.android.versionCode);
        expect(out).not.toMatch(/versionName "1\.0\.0"/);
        expect(out).toContain("file('D:/fixture-only/keystore.properties')");
        expect(out).toContain("storePassword simplyurReleaseKeystore['storePassword']");
        expect(out.match(/def simplyurReleaseKeystoreFile/g)).toHaveLength(1);
      });

      it("is idempotent", () => {
        const once = patcher.patchBuildGradle(src, opts);
        expect(patcher.patchBuildGradle(once, opts)).toBe(once);
      });

      it("handles CRLF line endings", () => {
        const out = patcher.patchBuildGradle(src.replace(/\n/g, "\r\n"), opts);
        expect(out).not.toMatch(/[^\r]\n/);
        expect(patcher.inspectBuildGradle(out).releaseBuildTypeSigning).toBe("release");
      });

      it("repairs a file already broken by the old script", () => {
        // old script: insert release signingConfig after `signingConfigs {`, then buggy regex
        const broken = OLD_BUGGY(
          patcher
            .patchBuildGradle(src, opts)
            .replace(/^(\s*)signingConfig signingConfigs\.release/m, "$1signingConfig signingConfigs.debug"),
        );
        expect(patcher.inspectBuildGradle(broken).debugBuildTypeSigning).toBe("release");
        const r = patcher.inspectBuildGradle(patcher.patchBuildGradle(broken, opts));
        expect(r.debugBuildTypeSigning).toBe("debug");
        expect(r.releaseBuildTypeSigning).toBe("release");
      });
    });
  }
});
