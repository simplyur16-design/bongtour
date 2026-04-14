/**
 * 공급사 이름 없는 브리지 — `parse-and-register-*-handler` 교차 import 검사에서
 * `-ybtour` 등 타 공급사 토큰 경로를 직접 쓰지 않기 위한 얇은 re-export.
 */
export type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
export { stripRegisterInternalArtifacts } from '@/lib/register-llm-schema-ybtour'
