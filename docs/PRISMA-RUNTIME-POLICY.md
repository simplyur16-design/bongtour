# Prisma Runtime Policy

## Current standard (must keep)
- Connection mode: direct DB connection (local dev uses SQLite `file:./dev.db`).
- Client import: use `@prisma/client` from app code.
- Path alias: `@prisma/client` is mapped to `./prisma-gen-runtime` in `tsconfig.json`.
- Prisma singleton: `new PrismaClient()` only (`lib/prisma.ts`).

## Forbidden for this project
- `withAccelerate()` in runtime code.
- Data Proxy / Accelerate-only client mode for local runtime.
- Using `prisma generate --no-engine` as normal regeneration flow.

## Standard commands
- Regenerate client: `npm run prisma:generate`
- Start clean dev server: `npm run dev:clean`

## Windows file-lock handling (EPERM on query_engine rename)
1. Stop dev server first (`npm run dev`/`npm run dev:clean` process).
2. Run `npm run prisma:generate`.
3. Start server again with `npm run dev:clean`.

If `EPERM ... query_engine-windows.dll.node rename` appears:
- Ensure all Node dev processes are stopped.
- Re-run `npm run prisma:generate`.
- Keep runtime output separated as `prisma-gen-runtime` (do not collapse back to locked output paths).
