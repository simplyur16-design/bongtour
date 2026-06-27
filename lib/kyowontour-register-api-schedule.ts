/**
 * 교원이지(kyowontour) 등록 일정 표현 SSOT — routeText(a–g ` - `) · description(동선 1줄 + 분위기 2~3문장).
 * REGRESSION-FREEZE[kyowontour-schedule-expression]: routeText·description vibe — manifest
 */
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-kyowontour'
import { parseFactMealsListToScheduleFields } from '@/lib/register-schedule-meal-parse'
import {
  composeLottetourScheduleDescription,
  dedupeLottetourScheduleRoutePlaces,
  joinLottetourScheduleRouteText,
} from '@/lib/lottetour-register-api-schedule'

export function kyowontourFactDaysToRegisterSchedule(days: RegisterFactScheduleDay[]): RegisterScheduleDay[] {
  const maxDay = days.reduce((m, d) => Math.max(m, d.day), 0)
  return days.map((d) => {
    const routePlaces = dedupeLottetourScheduleRoutePlaces(d.places)
    const routeText = joinLottetourScheduleRouteText(routePlaces)
    const joinedBlob = [d.transportNote, routeText, ...routePlaces, ...d.places].filter(Boolean).join(' ')
    const title =
      routeText?.split(' - ')[0]?.trim() ||
      String(d.transportNote ?? '').split(';')[0]?.trim() ||
      (d.hotels[0] ?? '').trim() ||
      `${d.day}일차`
    const description = composeLottetourScheduleDescription({
      day: d.day,
      maxDay,
      routePlaces,
      joinedBlob,
    })
    const meals = parseFactMealsListToScheduleFields(d.meals)
    return {
      day: d.day,
      title,
      description,
      routeText,
      imageKeyword: '',
      imageKeyword2: null,
      hotelText: d.hotels.length > 0 ? d.hotels.join(' / ') : null,
      breakfastText: meals.breakfastText ?? null,
      lunchText: meals.lunchText ?? null,
      dinnerText: meals.dinnerText ?? null,
      mealSummaryText: meals.mealSummaryText ?? null,
    }
  })
}
