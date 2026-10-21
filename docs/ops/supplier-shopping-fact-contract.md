# 쇼핑 사실 필드 계약 (supplier-product-fact-ssot)

**없음 ≠ 정보 없음.** `shoppingCount` / `shoppingVisitCountTotal` = `0` → 없음, `null` → 정보 없음, `≥1` → 있음(n회).

## 저장

| 필드 | 의미 |
|------|------|
| `shoppingVisitCountTotal` | 방문 횟수 SSOT (칩·비교) |
| `shoppingCount` | 동일 값 동기화 (레거시) |
| `shoppingShopOptions` | 표 행 JSON |
| `hasShopping` | Product 컬럼 없음 → `rawMeta.structuredSignals.hasShopping` |

등록 write (7공급사 register-flow 공통): `buildRegisterProductFactWrite(parsed)`  
→ Product `shoppingCount` / `shoppingVisitCountTotal` **와** `rawMeta.structuredSignals.hasShopping` / `shoppingVisitCount`를 **동일 값**으로 쓴다.  
`hasShopping===false`면 **반드시 0**.

## 공급사

상세 횟수 규칙: [supplier-shopping-visit-count.md](./supplier-shopping-visit-count.md).

- `hanatour` / `modetour`: 횟수 ≠ 행 수. 행만 있고 횟수 없으면 unknown 유지 가능.
- `ybtour` / `verygoodtour`: 목록 행 수로 횟수 보강 가능.
- `kyowontour` / `lottetour` / `naeiltour`: 등록 파서 + 동일 스칼라 write.

## 공개

`resolveShoppingConsumption` + `shouldShowPublicShoppingSection`. 비교·감사는 `deriveShoppingFact`.

## verify

`lib/supplier-product-fact-ssot.test.ts` · freeze id `supplier-product-fact-ssot`
