-- 4차-A: 추천 시스템 코드 폐기 — DB 템플릿 비활성화 (DROP 금지)
UPDATE bongsim_coupon
   SET is_active = false, updated_at = now()
 WHERE code IN ('__TPL_REFERRAL_INVITEE', '__TPL_REFERRAL_INVITER');
