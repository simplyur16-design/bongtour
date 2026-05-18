/**
 * tsx 스크립트용 — `.env` 후 `.env.local` 로드 (prisma import 전에 호출).
 */
import dotenv from 'dotenv'
import path from 'node:path'

const root = process.cwd()
dotenv.config({ path: path.join(root, '.env') })
dotenv.config({ path: path.join(root, '.env.local'), override: true })
