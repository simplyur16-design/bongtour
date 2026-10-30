#!/usr/bin/env node
// REGRESSION-FREEZE[build-next-font-retry]
// Railway/CI `next build` sometimes fails only because next/font/google gets a bad
// Google Fonts response at build time (e.g. "An error occurred in `next/font`." /
// "TypeError: Cannot read properties of null (reading '1')" in google/loader.js, or
// "Failed to fetch `X` from Google Fonts."). That is a network flake, not a code error.
// Retry the build up to MAX_ATTEMPTS times ONLY for that signature; any other failure
// exits immediately with the original exit code.
'use strict'
const { spawn } = require('node:child_process')
const path = require('node:path')

const MAX_ATTEMPTS = Number(process.env.NEXT_FONT_BUILD_MAX_ATTEMPTS || 3)
const RETRY_DELAY_MS = Number(process.env.NEXT_FONT_BUILD_RETRY_DELAY_MS || 20000)
const OUTPUT_TAIL_CHARS = 200000

function isNextFontFetchFlake(output) {
  const text = String(output || '')
  if (/An error occurred in `next\/font`/.test(text)) return true
  if (/Failed to fetch `[^`]+` from Google Fonts/.test(text)) return true
  if (/@next[\\/]font[\\/]dist[\\/]google[\\/]/.test(text) && /TypeError/.test(text)) return true
  return false
}

function runOnce() {
  return new Promise((resolve) => {
    const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next')
    const child = spawn(process.execPath, ['--max-old-space-size=8192', nextBin, 'build'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: process.env,
    })
    let tail = ''
    const keep = (chunk) => {
      tail += chunk.toString()
      if (tail.length > OUTPUT_TAIL_CHARS) tail = tail.slice(-OUTPUT_TAIL_CHARS)
    }
    child.stdout.on('data', (c) => { process.stdout.write(c); keep(c) })
    child.stderr.on('data', (c) => { process.stderr.write(c); keep(c) })
    child.on('close', (code, signal) => resolve({ code: code == null ? 1 : code, signal, output: tail }))
  })
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { code, signal, output } = await runOnce()
    if (code === 0) process.exit(0)
    if (signal || !isNextFontFetchFlake(output) || attempt === MAX_ATTEMPTS) {
      process.exit(code)
    }
    console.error(`[next-build-font-retry] attempt ${attempt}/${MAX_ATTEMPTS} failed on next/font Google Fonts fetch; retrying in ${RETRY_DELAY_MS}ms`)
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
  }
}

if (require.main === module) main()

module.exports = { isNextFontFetchFlake }
