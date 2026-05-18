/**
 * tsx 스크립트용 — `.env` 후 `.env.local` 로드 (prisma import 전에 호출).
 * Windows 콘솔에서 한글 로그가 깨지지 않도록 UTF-8 코드 페이지를 맞춘다.
 */
import dotenv from 'dotenv'
import { execSync } from 'node:child_process'
import path from 'node:path'

if (process.platform === 'win32') {
  try {
    execSync('chcp 65001 >nul', { stdio: 'ignore', windowsHide: true })
  } catch {
    /* ignore */
  }
  if (typeof process.stdout.setEncoding === 'function') {
    process.stdout.setEncoding('utf8')
  }
  if (typeof process.stderr.setEncoding === 'function') {
    process.stderr.setEncoding('utf8')
  }
}

const root = process.cwd()
dotenv.config({ path: path.join(root, '.env') })
dotenv.config({ path: path.join(root, '.env.local'), override: true })
