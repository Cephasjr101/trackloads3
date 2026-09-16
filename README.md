# LoadMatch — Empty Truck Marketplace (MVP)

Frontend for matching trucks returning empty with shippers who need the reverse
route (e.g. a truck runs Accra → Kumasi, a shipper needs Kumasi → Accra).

**This version talks to the live backend** at
`https://trackloadadmin.onrender.com` — it is no longer a localStorage demo.
Trucks, loads, matching, contracts, escrow, tracking and proof of delivery are
all real API calls.

---

## Run it

It's a static site — no build step, no npm install.

```bash
# any static server works, e.g.
python3 -m http.server 8080
# then open http://localhost:8080
```

Opening `index.html` directly off the filesystem (`file://`) will fail on API
calls — browsers block cross-origin requests from `file://`. Use a local server.

The backend allows these origins out of the box (see `server.js` →
`DEFAULT_ORIGINS`): `https://empty-trackload.onrender.com`,
`http://localhost:8080`, `http://127.0.0.1:8080`.

**Demo logins** (password `demo1234` for both):
- Carrier: `kwame@asantehaulage.example`
- Shipper: `ama@owusufurniture.example`

**Backend cold starts:** Render's free tier spins services down when idle. The
first request after a quiet period can take 30–60 seconds. That is not a bug.

---

## How the frontend connects to the backend

Every page sets the backend URL before loading the API client:

```html
<script>window.LOADMATCH_API_BASE = 'https://trackloadadmin.onrender.com';</script>
<script src="assets/js/api-client.js"></script>
<script src="assets/js/main.js"></script>
<script src="assets/js/data.js"></script>
<script src="assets/js/pages.js"></script>
<script src="assets/js/chatbot.js"></script>
```

**Script order matters.** `api-client.js` defines `window.LoadMatchAPI`, which
`pages.js` and `chatbot.js` both depend on. If it loads late or fails to parse,
every dynamic feature silently does nothing.

To point at a different backend, change `LOADMATCH_API_BASE` on each page (or
edit the default in `api-client.js`).

---

## File map

| File | Role |
|---|---|
| `assets/js/api-client.js` | All backend calls. Exposes `window.LoadMatchAPI`; stores the session token in `localStorage` under `lm_token`. |
| `assets/js/main.js` | Nav toggle, footer year, cookie consent + GA gating. Holds `LM.CONFIG` (commission band, analytics ID). |
| `assets/js/data.js` | Shared constants only (city list). Matching/pricing live on the backend. |
| `assets/js/pages.js` | Marketplace, forms, dashboard logic — all wired to the API. |
| `assets/js/chatbot.js` | The LoadMatch Assistant widget (see below). |
| `assets/css/style.css` | All styling, including the assistant widget. |

---

## The LoadMatch Assistant (chat widget)

A floating button on every page opens an assistant for carriers and shippers.

**What it is:** a rule-based assistant wired to the real API. It matches
keywords and runs guided flows.

**What it is not:** an LLM. There is no model or API key behind it. Free-text
questions outside its patterns get a fallback reply with quick-reply buttons.

It can:
- answer FAQs (verification, commission, escrow, GPS, OTP/POD)
- run a **live** price estimate via `GET /api/pricing/estimate`
- log a visitor in and list their real matches
- route people to the right page

To upgrade it to a real LLM, add a backend route that proxies to your model
provider (keeping the API key server-side — never in this frontend) and have
`chatbot.js` call that route instead of its keyword table.

---

## Feature checklist

| Requirement | Where |
|---|---|
| Matching engine (reverse-route priority, capacity, dates, budget) | **Backend** `matching.js`; surfaced via Marketplace → "Run matching" (`GET /api/matches/run`) |
| Truck & driver verification | Status badges from the `trucks.status` column; `POST /api/trucks/:id/verify` is **admin-only and has no frontend UI yet** |
| Cargo details | `post-load.html` → `POST /api/loads` |
| Pricing | Backend `estimateRoutePrice()`; assistant exposes it live |
| GPS tracking | Dashboard → GPS Tracking tab (`/api/matches/:id/tracking`) |
| Digital contracts | Dashboard → Digital Contract tab (generate + e-sign) |
| Payment + 3–10% commission | Dashboard → Payment tab (escrow fund, payout breakdown) |
| Proof of delivery | Dashboard → POD tab (6-digit OTP; releases escrow) |
| Privacy policy | `privacy.html` |
| Terms & conditions | `terms.html` |
| Secrets off the frontend | Only the public GA ID lives in `main.js`. Session tokens are issued by the backend. No secrets in this repo. |
| Force HTTPS | Render serves HTTPS automatically. `.htaccess` (Apache), `netlify.toml`, `vercel.json` included for other hosts. |
| Cookie consent banner | Fixed bottom banner; GA only loads after acceptance |
| Meta titles & descriptions | Every page `<head>` |
| Social preview images | `assets/img/og-image.png` (1200×630), wired to OG + Twitter cards |
| Favicon | `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `site.webmanifest` |
| Sitemap / robots | `sitemap.xml`, `robots.txt` |
| Alt text | SVGs carry `aria-label`; decorative icons are `aria-hidden` |
| Page load speed | No frameworks or CDNs; long cache headers on `/assets/*` |
| Color contrast | `#111827` on white ≈ 15.8:1; white on `#116B4F` ≈ 5.4:1 |
| Mobile friendly | Responsive grid, hamburger nav, `clamp()` typography |
| Custom 404 | `404.html` |
| Form validation | Inline `aria-invalid` errors; email/phone/date/number checks; password match |
| Spam protection | Honeypot + 2.5s fill-time trap + math CAPTCHA (`pages.js`) |
| Analytics | GA4 gated behind consent; set `ANALYTICS_ID` in `main.js` |
| One clear CTA | Landing page converges on post-a-load / list-a-truck |

---

## Accounts

There is no separate signup page. The truck and load forms create the account
inline on first submit (`POST /api/auth/register`), then fall back to
`POST /api/auth/login` if the email already exists. The dashboard shows a login
card when no session token is present.

---

## Deploy

**Render (current setup)** — the frontend is a Static Site, the backend a
separate Web Service. Render terminates HTTPS and issues certificates for you,
so no redirect config is needed. Set the static site's publish directory to the
repo root.

`netlify.toml`, `vercel.json` and `.htaccess` are included if you move hosts.
Netlify and Vercel also handle http→https themselves; those files mainly carry
security and cache headers.

---

## Before going to production

1. **Admin verification UI.** `POST /api/trucks/:id/verify` requires an admin
   account, and there is no signup path for `role: 'admin'` — you must set it
   directly in SQL. No frontend screen calls it yet, so every truck stays
   `pending`.
2. **`devOnlyOtp`.** The POD endpoint returns the OTP in its response because no
   SMS gateway is wired up. Anyone with match access can read it. Wire up an SMS
   provider and delete that field.
3. **Escrow is simulated.** `escrow/fund` flips a status; no money moves.
   Integrate Paystack/Flutterwave and only mark `escrowed` after a verified
   webhook.
4. **SQLite on Render is ephemeral.** Every redeploy wipes `data/loadmatch.db`
   back to seed unless you attach a Render Disk (and set `DB_PATH`) or move to
   Postgres.
5. **Distances are a lookup table.** `routeDistanceKm()` covers 8 cities with
   hardcoded estimates. Swap for Google Routes, Mapbox or OSRM.
6. **No rate limiting** on the API. The frontend has spam traps; the backend
   will accept scripted requests happily.
7. **Set your GA ID** in `main.js` (`ANALYTICS_ID`), or leave the placeholder to
   keep analytics off.

---

## Troubleshooting

**Nothing loads / lists are empty.** Open DevTools → Console. If you see
`LoadMatchAPI missing`, `api-client.js` didn't load or didn't parse — check the
Network tab for a 404 on that file and confirm script order.

**CORS errors.** The backend's `CORS_ORIGIN` env var, when set, *overrides* the
built-in defaults. If it doesn't include your frontend's exact origin, the
browser blocks the response. Either include it or unset the variable.

**Requests never appear in the Network tab.** The page's JS isn't running at
all — look for a syntax error in the Console.

**Everything hangs for ~a minute, then works.** Render cold start. Expected on
the free tier.
