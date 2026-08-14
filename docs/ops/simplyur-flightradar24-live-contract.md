# Simplyur × FlightRadar24 live flight (scaffold)

REGRESSION-FREEZE: `simplyur-flightradar24-live`

Docs: [FR24 API endpoints overview](https://fr24api.flightradar24.com/docs/endpoints/overview)

## Status

Prepared, **not live**. Do not sign up from this repo. No token in git.

When an operator later creates a FR24 API token:

| Env | Role |
|-----|------|
| `FR24_API_TOKEN` | Server only. Bearer token. Never `NEXT_PUBLIC_*`. |
| `SIMPLYUR_FLIGHT_LIVE_PUSH` | `1` to allow Expo push after live deltas. Default off. |

Base: `https://fr24api.flightradar24.com` · header `Accept-Version: v1`.

Used later: `GET /api/live/flight-positions/full?flights={flight}` (Trip Inbox `flight_no`). Optional `GET /api/flight-tracks`.

## App

- `GET /api/simplyur/flights/live?flight=KE123` — login required; **503** `fr24_not_configured` until token exists.
- Push uses existing `SimplyurDevicePushToken` / Expo. No send without token + push flag.
- Without a token the client **must not** call FR24.

## Out of scope until signup

- Paid FR24 plan / quota
- Background poller / cron
- Storing live positions in our DB
