/**
 * 관리자 문의 접수 LMS 1회 실발송 (.env.local 의 Solapi 설정 사용).
 * npx tsx scripts/send-admin-inquiry-test-lms-once.ts
 */
import path from 'path'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  const { ADMIN_INQUIRY_LMS_TEST_FIXTURE, buildAdminInquiryShortAlertLine } = await import(
    '@/lib/admin-inquiry-lms-content'
  )
  const { parseSolapiReceiverPhones, sendAdminInquiryNotification } = await import(
    '@/lib/notification-service'
  )

  const receivers = parseSolapiReceiverPhones()
  const preview = buildAdminInquiryShortAlertLine(ADMIN_INQUIRY_LMS_TEST_FIXTURE)
  console.log('[send-admin-inquiry-test-lms] receivers:', receivers.length)
  console.log('[send-admin-inquiry-test-lms] preview:', preview)

  const result = await sendAdminInquiryNotification(ADMIN_INQUIRY_LMS_TEST_FIXTURE)
  console.log('[send-admin-inquiry-test-lms] result:', JSON.stringify(result, null, 2))

  if (result.skipped) {
    process.exit(1)
  }
  if (result.failed.length > 0) {
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('[send-admin-inquiry-test-lms] fatal', e)
  process.exit(1)
})
