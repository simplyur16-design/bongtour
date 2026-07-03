/**
 * REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]
 */
import { describe, expect, it } from 'vitest'
import {
  REGISTER_GEMINI_SCHEDULE_IMAGE_KEYWORD_RESOLVE_BLOCK,
  REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK,
  REGISTER_SCHEDULE_EXTRACT_IMAGE_KEYWORD_LINE,
} from './register-schedule-image-keyword-prompt'

describe('register-schedule-image-keyword-prompt SSOT', () => {
  it('직역·번역 대신 정식 영문 고유명 resolve 규칙', () => {
    expect(REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK).toMatch(/직역·의역·번역 금지/)
    expect(REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK).toMatch(/Po Nagar Cham Towers/)
    expect(REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK).toMatch(/Datanla Waterfalls/)
    expect(REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK).not.toMatch(/번역해 채운다/)
  })

  it('Gemini resolve block — literal translation forbidden', () => {
    expect(REGISTER_GEMINI_SCHEDULE_IMAGE_KEYWORD_RESOLVE_BLOCK).toMatch(/Do NOT translate Korean/)
    expect(REGISTER_GEMINI_SCHEDULE_IMAGE_KEYWORD_RESOLVE_BLOCK).toMatch(/standard English proper name/)
  })

  it('schedule extract line — canonical naming hint', () => {
    expect(REGISTER_SCHEDULE_EXTRACT_IMAGE_KEYWORD_LINE).toMatch(/직역 금지/)
  })
})
