/** 봉 팁 tipKind — API에는 문자열로 저장 */
export const TIP_KIND_OPTIONS = [
  { value: 'visa', label: '비자' },
  { value: 'fx', label: '환전' },
  { value: 'manners', label: '매너' },
  { value: 'medical', label: '의료' },
  { value: 'safety', label: '안전' },
  { value: 'transport', label: '교통' },
  { value: 'utilities', label: '전기·통신' },
  { value: 'other', label: '기타' },
] as const
