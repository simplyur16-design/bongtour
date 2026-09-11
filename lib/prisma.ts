import { PrismaClient } from '@prisma/client'
import {
  resolvePrismaReadConnectionLimit,
  withPrismaConnectionLimit,
} from '@/lib/prisma-connection-limit'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  prismaRead?: PrismaClient
  prismaReadIsAlias?: boolean
}

const debugQueryLogEnabled = process.env.DEBUG_QUERY_LOG === '1'

function createPrismaClient(url: string | undefined): PrismaClient {
  const client = new PrismaClient({
    datasources: {
      db: {
        // DATABASE_URL 은 import 시점이 아니라 첫 쿼리 시점에 읽는다.
        url,
      },
    },
    ...(debugQueryLogEnabled ? { log: [{ emit: 'event', level: 'query' as const }] } : {}),
  })
  return client
}

/**
 * REGRESSION-FREEZE[prisma-client-singleton]: always cache on globalThis — Proxy get마다
 * 새 PrismaClient 를 만들면 production 에서 Supavisor EMAXCONN(200) 으로 전체 db_error.
 * (구코드는 NODE_ENV===production 일 때 global 미저장 → 요청마다 풀 누수)
 */
function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma
  const client = createPrismaClient(withPrismaConnectionLimit(process.env.DATABASE_URL))
  globalForPrisma.prisma = client
  return client
}

/**
 * Heavy read path (supplier sweep due-select). Uses DATABASE_URL_READ when set;
 * otherwise aliases the write singleton so we do not open a second pool on primary.
 * REGRESSION-FREEZE[prisma-read-write-split]: prismaRead fallback — manifest
 */
function getPrismaReadClient(): PrismaClient {
  if (globalForPrisma.prismaRead) return globalForPrisma.prismaRead
  const readRaw = process.env.DATABASE_URL_READ?.trim()
  const writeRaw = process.env.DATABASE_URL?.trim()
  if (!readRaw || readRaw === writeRaw) {
    const write = getPrismaClient()
    globalForPrisma.prismaRead = write
    globalForPrisma.prismaReadIsAlias = true
    return write
  }
  const client = createPrismaClient(
    withPrismaConnectionLimit(readRaw, { limit: resolvePrismaReadConnectionLimit() }),
  )
  globalForPrisma.prismaRead = client
  globalForPrisma.prismaReadIsAlias = false
  return client
}

/**
 * 지연 생성 프록시. 모듈을 import 하는 것만으로는 PrismaClient 를 만들지 않는다.
 * DATABASE_URL 없이 도는 단위 테스트·빌드 단계가 import 만으로 죽지 않도록 한다.
 */
function makeLazyPrismaProxy(getClient: () => PrismaClient): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop, receiver) {
      const client = getClient()
      const value = Reflect.get(client as object, prop, receiver)
      return typeof value === 'function' ? value.bind(client) : value
    },
    set(_target, prop, value) {
      return Reflect.set(getClient() as object, prop, value)
    },
    has(_target, prop) {
      return Reflect.has(getClient() as object, prop)
    },
    ownKeys() {
      return Reflect.ownKeys(getClient() as object)
    },
    getOwnPropertyDescriptor(_target, prop) {
      const desc = Reflect.getOwnPropertyDescriptor(getClient() as object, prop)
      return desc ? { ...desc, configurable: true } : undefined
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(getClient() as object)
    },
  })
}

export const prisma: PrismaClient = makeLazyPrismaProxy(getPrismaClient)

/** Sweep due-select / heavy reads. Same as `prisma` until DATABASE_URL_READ is set. */
export const prismaRead: PrismaClient = makeLazyPrismaProxy(getPrismaReadClient)
