import { execFileSync } from 'child_process'
import fs from 'node:fs'
import path from 'node:path'

function fileExists(p: string): boolean {
  if (!p) return false
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

/** Python subprocess cwd / PYTHONPATH — `BONGTOUR_REPO_ROOT` 우선 */
export function resolvePythonRepoRoot(): string {
  const fromEnv = (process.env.BONGTOUR_REPO_ROOT ?? '').trim()
  if (fromEnv && fileExists(fromEnv)) return path.resolve(fromEnv)

  const marker = path.join('scripts', 'calendar_e2e_scraper_hanatour', 'main.py')
  let dir = path.resolve(process.cwd())
  for (let i = 0; i < 12; i++) {
    if (fileExists(path.join(dir, marker))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

function venvPythonCandidates(repoRoot: string): string[] {
  if (process.platform === 'win32') {
    return [
      path.join(repoRoot, '.venv', 'Scripts', 'python.exe'),
      path.join(repoRoot, '.venv', 'Scripts', 'python'),
    ]
  }
  return [
    path.join(repoRoot, '.venv', 'bin', 'python3'),
    path.join(repoRoot, '.venv', 'bin', 'python'),
  ]
}

function resolveOnPath(command: string): string | null {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('where.exe', [command], {
        encoding: 'utf8',
        timeout: 10_000,
        windowsHide: true,
      })
      for (const line of out.split(/\r?\n/)) {
        const p = line.trim()
        if (p && fileExists(p)) return p
      }
      return null
    }
    const out = execFileSync('which', [command], { encoding: 'utf8', timeout: 10_000 })
    const p = out.trim().split(/\r?\n/)[0]?.trim()
    return p && fileExists(p) ? p : null
  } catch {
    return null
  }
}

export type PythonResolution = {
  executable: string
  repoRoot: string
  source: 'env' | 'venv' | 'path' | 'default'
  envConfigured: string
}

/** 진단·로그용 — 실제로 spawn에 쓰는 해석 결과 */
export function resolvePythonResolution(): PythonResolution {
  const repoRoot = resolvePythonRepoRoot()
  const envConfigured = (
    process.env.HANATOUR_PYTHON ??
    process.env.PYTHON ??
    process.env.PYTHON_EXECUTABLE ??
    ''
  ).trim()

  if (envConfigured && fileExists(envConfigured)) {
    return { executable: envConfigured, repoRoot, source: 'env', envConfigured }
  }

  for (const candidate of venvPythonCandidates(repoRoot)) {
    if (fileExists(candidate)) {
      return { executable: candidate, repoRoot, source: 'venv', envConfigured }
    }
  }

  const platformCmd = process.platform === 'win32' ? 'python' : 'python3'
  const onPath = resolveOnPath(platformCmd)
  if (onPath) {
    if (envConfigured) {
      console.warn(
        `[resolve-python] configured interpreter missing (${envConfigured}); using PATH ${onPath}`
      )
    }
    return { executable: onPath, repoRoot, source: 'path', envConfigured }
  }

  if (envConfigured) {
    console.warn(
      `[resolve-python] configured interpreter missing (${envConfigured}); trying bare ${platformCmd}`
    )
  }

  return { executable: platformCmd, repoRoot, source: 'default', envConfigured }
}

export function resolvePythonExecutable(): string {
  return resolvePythonResolution().executable
}
