/**
 * One-off: map Tailwind default colors in admin product detail page to bt tokens.
 * Run: node scripts/bt-replace-admin-product-detail.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, '../app/admin/products/[id]/page.tsx')
let s = fs.readFileSync(file, 'utf8')

const pairs = [
  [/text-red-300/g, 'text-bt-danger'],
  [/text-red-200/g, 'text-bt-danger'],
  [/text-emerald-300/g, 'text-bt-badge-domestic-text'],
  [/text-emerald-200/g, 'text-bt-badge-domestic-text'],
  [/text-amber-200/g, 'text-bt-badge-freeform-text'],
  [/text-amber-300\/80/g, 'text-bt-warning'],
  [/text-amber-300/g, 'text-bt-warning'],
  [/border-amber-700/g, 'border-bt-warning'],
  [/bg-amber-950\/40/g, 'bg-bt-badge-freeform/40'],
  [/border-amber-600/g, 'border-bt-warning'],
  [/hover:bg-amber-900\/50/g, 'hover:bg-bt-badge-freeform/30'],
  [/bg-emerald-950\/50/g, 'bg-bt-badge-domestic/25'],
  [/border-emerald-800/g, 'border-bt-success'],
  [/hover:text-white/g, 'hover:text-bt-inverse'],
  [/bg-slate-950/g, 'bg-bt-strong'],
  [/bg-slate-900\/95/g, 'bg-bt-title/95'],
  [/bg-slate-900\/50/g, 'bg-bt-title/50'],
  [/bg-slate-900/g, 'bg-bt-title'],
  [/bg-slate-800\/50/g, 'bg-bt-title/50'],
  [/bg-slate-800/g, 'bg-bt-title'],
  [/bg-slate-700/g, 'bg-bt-title'],
  [/border-slate-800/g, 'border-bt-border-strong'],
  [/border-slate-700/g, 'border-bt-border-strong'],
  [/border-slate-600/g, 'border-bt-border-strong'],
  [/text-slate-100/g, 'text-bt-inverse'],
  [/text-slate-200/g, 'text-bt-inverse'],
  [/text-slate-300/g, 'text-bt-inverse/90'],
  [/text-slate-400/g, 'text-bt-meta'],
  [/text-slate-500/g, 'text-bt-subtle'],
  [/placeholder:text-slate-500/g, 'placeholder:text-bt-subtle'],
  [/text-slate-600/g, 'text-bt-muted'],
  [/text-slate-700/g, 'text-bt-body'],
  [/text-slate-800/g, 'text-bt-strong'],
  [/bg-slate-600/g, 'bg-bt-muted'],
  [/hover:bg-slate-500/g, 'hover:bg-bt-meta'],
  [/text-\\[#0f172a\\]/g, 'text-bt-title'],
  [/border-\\[#0f172a\\]/g, 'border-bt-strong'],
  [/bg-\\[#0f172a\\]/g, 'bg-bt-cta-primary'],
  [/hover:bg-\\[#1e293b\\]/g, 'hover:bg-bt-cta-primary-hover'],
]

for (const [re, to] of pairs) {
  s = s.replace(re, to)
}

// Buttons: emerald / amber primary fills
s = s.replace(
  /rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50/g,
  'rounded-lg bg-bt-cta-primary px-4 py-2 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover disabled:opacity-50'
)
s = s.replace(
  /rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50/g,
  'rounded-lg bg-bt-cta-accent px-4 py-2 text-sm font-medium text-bt-cta-accent-text hover:brightness-95 disabled:opacity-50'
)

fs.writeFileSync(file, s)
console.log('Updated', file)
