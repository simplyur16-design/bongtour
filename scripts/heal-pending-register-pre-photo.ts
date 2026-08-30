import Module from 'node:module'
import { register } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

register(pathToFileURL(join(process.cwd(), 'scripts/stub-server-only.mjs')).href)
const load = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load
;(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function (
  request: unknown,
  parent: unknown,
  isMain: unknown,
) {
  if (request === 'server-only') return {}
  return load.call(this, request, parent, isMain)
}

void (async () => {
  await import('./load-env-for-scripts')
  const { runRegisterPrePhotoDailyJob } = await import('../lib/register-pre-photo-daily-job')
  const { healPendingRegisterPrePhoto } = await import('../lib/register-pending-pre-photo-self-heal')

  const dryRun = process.argv.includes('--dry-run')
  const probe = !process.argv.includes('--no-probe')
  const ingest = process.argv.includes('--ingest')
  const suppliersArg = process.argv.find((a) => a.startsWith('--suppliers='))?.slice('--suppliers='.length)
  const perSupplierArg = process.argv.find((a) => a.startsWith('--per-supplier='))?.slice('--per-supplier='.length)
  const limitArg = process.argv.find((a) => a.startsWith('--limit='))?.slice('--limit='.length)
  const idArg = process.argv.find((a) => a.startsWith('--id='))?.slice('--id='.length)
  const onlySuppliers = suppliersArg
    ? suppliersArg.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    : undefined
  const perSupplierRaw = Number(perSupplierArg)
  const perSupplier = Number.isFinite(perSupplierRaw) && perSupplierRaw >= 1 ? Math.floor(perSupplierRaw) : undefined
  const limitRaw = Number(limitArg)
  const healLimit = Number.isFinite(limitRaw) && limitRaw >= 1 ? Math.floor(limitRaw) : 200
  const productId = idArg?.trim() || undefined

  console.error('[register-pre-photo-daily] boot', { ingest, dryRun, probe, onlySuppliers, perSupplier, healLimit, productId, pid: process.pid })

  try {
    if (ingest) {
      const result = await runRegisterPrePhotoDailyJob({
        dryRun,
        probeImageUrls: probe,
        onlySuppliers,
        perSupplier,
        healLimit: 200,
      })
      console.log('[register-pre-photo-daily]', result)
      const emptyIngest = !dryRun && result.ingest.created < 1
      process.exit(result.heal.failed + result.ingest.failed > 0 || emptyIngest ? 1 : 0)
    } else {
      const result = await healPendingRegisterPrePhoto({
        limit: healLimit,
        dryRun,
        probeImageUrls: probe,
        productId,
      })
      console.log('[heal-pending-register-pre-photo]', result)
      process.exit(result.failed > 0 ? 1 : 0)
    }
  } catch (e) {
    console.error(ingest ? '[register-pre-photo-daily] failed' : '[heal-pending-register-pre-photo] failed', e)
    process.exit(1)
  }
})()
