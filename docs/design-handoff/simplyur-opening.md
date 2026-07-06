# Handoff: Simply UR — Opening [01]

## Overview
앱 cold start 첫 화면. 한국 여행 mood photo + Signal Pin + **Get Started** → Login 1b.

## Status
**기본 구현됨** (앱 `app/index.tsx`) — photo rotation, scrim, CTA wired.  
클로드: **픽셀 polish + 최종 사진 3장 + crossfade** HTML reference.

## Fidelity
Full-bleed photos + navy scrim `rgba(18,35,63,~0.58)`. CTA coral 56px. Poppins tagline uppercase.

## Layout
- Full bleed rotating photos (3)
- Scrim overlay
- Center: Signal Pin 44×53 coral
- Tagline: `ESSENTIAL SIMPLICITY FOR YOUR FOCUS`
- Bottom: **Get Started** → `/sign-in`

## Interaction
Get Started only (no Skip on opening — Skip is on Login).

## Assets
Operator final Korea photos → bundle in `assets/images/opening/`. No supplier branding in photos.

## 산출물
Polished iPhone frame + crossfade spec + HTML reference (optional zip)
