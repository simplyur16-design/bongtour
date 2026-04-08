/**
 * Google Sheet IMAGE_ASSETS 탭 append (보조 기록). 실패해도 업로드 성공은 유지하고 로그·DB 플래그로 재시도.
 */

import { JWT } from 'google-auth-library'

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

export const IMAGE_ASSETS_SHEET_HEADERS = [
  'id',
  'entity_type',
  'entity_id',
  'entity_name_kr',
  'entity_name_en',
  'supplier_name',
  'service_type',
  'image_role',
  'is_primary',
  'sort_order',
  'file_name',
  'file_ext',
  'mime_type',
  'storage_bucket',
  'storage_path',
  'public_url',
  'alt_kr',
  'alt_en',
  'title_kr',
  'title_en',
  'source_type',
  'source_note',
  'upload_status',
  'uploaded_by',
  'uploaded_at',
  'updated_at',
] as const

export type ImageAssetSheetRow = {
  id: string
  entity_type: string
  entity_id: string
  entity_name_kr: string
  entity_name_en: string
  supplier_name: string
  service_type: string
  image_role: string
  is_primary: boolean
  sort_order: number
  file_name: string
  file_ext: string
  mime_type: string
  storage_bucket: string
  storage_path: string
  public_url: string
  alt_kr: string
  alt_en: string
  title_kr: string
  title_en: string
  source_type: string
  source_note: string
  upload_status: string
  uploaded_by: string
  uploaded_at: string
  updated_at: string
}

function getJwtClient(): JWT {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  if (!clientEmail || !privateKeyRaw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL 및 GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY 가 필요합니다.')
  }
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n')
  return new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [SHEETS_SCOPE],
  })
}

function rowToValues(r: ImageAssetSheetRow): string[] {
  return [
    r.id,
    r.entity_type,
    r.entity_id,
    r.entity_name_kr,
    r.entity_name_en,
    r.supplier_name,
    r.service_type,
    r.image_role,
    r.is_primary ? 'TRUE' : 'FALSE',
    String(r.sort_order),
    r.file_name,
    r.file_ext,
    r.mime_type,
    r.storage_bucket,
    r.storage_path,
    r.public_url,
    r.alt_kr,
    r.alt_en,
    r.title_kr,
    r.title_en,
    r.source_type,
    r.source_note,
    r.upload_status,
    r.uploaded_by,
    r.uploaded_at,
    r.updated_at,
  ]
}

/**
 * IMAGE_ASSETS 탭에 한 행 append. 스프레드시트에 동일 이름 탭이 있어야 함.
 */
export async function appendImageAssetSheetRow(row: ImageAssetSheetRow): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim()
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID 가 설정되지 않았습니다.')
  }
  const jwt = getJwtClient()
  const { access_token: accessToken } = await jwt.authorize()
  if (!accessToken) {
    throw new Error('Google 액세스 토큰을 얻지 못했습니다.')
  }
  const range = encodeURIComponent('IMAGE_ASSETS!A:A')
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
  const body = {
    values: [rowToValues(row)],
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Sheets append HTTP ${res.status}: ${text.slice(0, 500)}`)
  }
}
