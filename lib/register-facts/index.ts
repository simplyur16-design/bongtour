export type {
  RegisterFactFlightLeg,
  RegisterFactPriceRow,
  RegisterFactScheduleDay,
  SupplierRegisterFactBundle,
  SupplierRegisterFactSource,
} from '@/lib/register-facts/types'

export {
  collectModetourRegisterFacts,
  modetourFlightRoutesToFactLegs,
  modetourScheduleItemsToFactDays,
} from '@/lib/register-facts/modetour'

export {
  collectHanatourRegisterFacts,
  hanatourItnrSchdToFactDays,
} from '@/lib/register-facts/hanatour'

export {
  collectVerygoodtourRegisterFacts,
  extractVerygoodRegisterFactsFromHtml,
  parseVerygoodProCodeFromUrl,
} from '@/lib/register-facts/verygoodtour'

export { collectYbtourRegisterFacts } from '@/lib/register-facts/ybtour'

export {
  collectSupplierRegisterFacts,
  registerFactsSupportedSuppliers,
} from '@/lib/register-facts/collect'
