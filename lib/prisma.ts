import { PrismaClient } from '@prisma/client'
import { withPrismaConnectionLimit } from '@/lib/prisma-connection-limit'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

const debugQueryLogEnabled = process.env.DEBUG_QUERY_LOG === '1'

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    datasources: {
      db: {
        // DATABASE_URL 은 import 시점이 아니라 첫 쿼리 시점에 읽는다.
        url: withPrismaConnectionLimit(process.env.DATABASE_URL),
      },
    },
    ...(debugQueryLogEnabled ? { log: [{ emit: 'event', level: 'query' as const }] } : {}),
  })
  return client
}

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma
  const client = createPrismaClient()
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
  return client
}

/**
 * 지연 생성 프록시. 모듈을 import 하는 것만으로는 PrismaClient 를 만들지 않는다.
 * DATABASE_URL 없이 도는 단위 테스트·빌드 단계가 import 만으로 죽지 않도록 한다.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient()
    const value = Reflect.get(client as object, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
  set(_target, prop, value) {
    return Reflect.set(getPrismaClient() as object, prop, value)
  },
  has(_target, prop) {
    return Reflect.has(getPrismaClient() as object, prop)
  },
  // Object.keys(prisma) 로 델리게이트 목록을 찍는 진단 코드가 있어 열거도 위임한다.
  ownKeys() {
    return Reflect.ownKeys(getPrismaClient() as object)
  },
  getOwnPropertyDescriptor(_target, prop) {
    const desc = Reflect.getOwnPropertyDescriptor(getPrismaClient() as object, prop)
    return desc ? { ...desc, configurable: true } : undefined
  },
  getPrototypeOf() {
    return Reflect.getPrototypeOf(getPrismaClient() as object)
  },
})
