# Kamadhenu — React Native app

Expo + expo-router frontend for the Kamadhenu FastAPI backend
(`github.com/ayushnp/kamadhenu` → `/backend`).

## Run it

```bash
npm install
cp .env.example .env     # set EXPO_PUBLIC_API_URL
npx expo start
```

`EXPO_PUBLIC_API_URL` points at the FastAPI host **without** `/api/v1` — the client adds that.

| Where you run the app | Value |
|---|---|
| Android emulator | `http://10.0.2.2:8000` |
| iOS simulator | `http://localhost:8000` |
| Physical device | `http://<laptop-lan-ip>:8000` |

The backend already sets `allow_origins=["*"]`, so no CORS work is needed.

## Opening sequence

`src/components/CowSplash.tsx` — the calf walks in from the left, tucks its head under the
mother's udder and suckles, she lowers her head to lick it, then the wordmark settles in.
About 4.3s, tap anywhere to skip, and it collapses to a static frame when the OS
reduce-motion setting is on. Drawn as react-native-svg paths (no image assets) and driven by
Reanimated shared values on animated `<G>` props.

## Screens → endpoints

| Screen | Calls |
|---|---|
| `(auth)/login` | `POST /auth/login` → `GET /users/me` |
| `(auth)/register` | `POST /auth/register`, then login |
| `(tabs)/index` | `GET /cows/` (farmers; staff get a lookup-first dashboard, since the backend returns `[]` for non-farmers) |
| `(tabs)/lookup` | `GET /cows/lookup?barcode=|pashu_aadhar=|tag_number=` |
| `(tabs)/profile` | `GET /users/me`, `PATCH /users/me` |
| `cow/[id]` | `GET /cows/{id}` (returns `CowWithHistory`, so health + vaccines come in one call) |
| `cow/new` | `POST /cows/`, `PATCH /cows/{id}` |
| `cow/health` | `POST /cows/{id}/health/` |
| `cow/vaccination` | `POST /cows/{id}/vaccinations/` |
| `staff` | `POST /users/staff`, `GET /users/?role=`, `PATCH /users/{id}/deactivate` |

Trailing slashes on the collection routes are deliberate — FastAPI's routes are declared that
way and a missing slash costs a redirect that drops the `Authorization` header on some clients.

## Roles

Four roles come back on `/users/me`: `farmer`, `inspector`, `doctor`, `authority`.
Farmers see their own herd and can add animals; staff start from lookup and can write records
against any animal; authority additionally gets the staff-accounts screen. Route guarding is
server-side — the UI just doesn't show what the API would refuse.

## Layout

```
app/                 expo-router file routes
src/api/             client.ts (fetch + JWT + FastAPI error shapes), index.ts (endpoints), types.ts
src/components/      CowSplash.tsx, ui.tsx (Button, Field, Card, Badge, Segmented, Banner, Empty)
src/lib/             auth.tsx (session context), format.ts (dates, due-date maths)
src/theme/           colors, type scale, spacing
```

The token lives in `expo-secure-store` and is attached by `src/api/client.ts`; a 401 clears it
and the router gate drops you back to login.

## Not built yet

- `GET /cows/farmer/{farmer_id}` is wired in `src/api/index.ts` but has no screen — the natural
  next one is a farmer directory for inspectors.
- Dates are typed as `YYYY-MM-DD` text fields. Swap in `@react-native-community/datetimepicker`
  when you want a picker; `src/lib/format.ts` already validates the format.
- The mastitis risk score the project is named for isn't an endpoint yet. When it lands, the cow
  detail header is where it goes — the badge row there is already built for it.
