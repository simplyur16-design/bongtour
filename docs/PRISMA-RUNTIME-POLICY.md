# Prisma runtime policy

## Client generation

- `prisma/schema.prisma` `generator client` uses the **default output** (`node_modules/.prisma/client`).
- Do **not** set a custom `output` path (e.g. `prisma-gen-runtime`) — it increases Windows DLL lock issues with AV/IDE indexing.

## Imports

- Application code: `import { PrismaClient } from '@prisma/client'` (see `lib/prisma.ts`).
- Do not import from `prisma-gen-runtime` or legacy `prisma-gen`.

## Checks

```bash
npm run verify:prisma-runtime-policy
npx prisma validate
npx prisma generate
```

## After changing generator (local Windows)

```powershell
Remove-Item -Recurse -Force prisma-gen-runtime -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.prisma -ErrorAction SilentlyContinue
npx prisma generate
```

## Forbidden

- `withAccelerate()` in runtime code
- `--no-engine` in scripts (outside docs)
- Custom generator `output` under the repo root
