# Simple Collection Manager

Simple Collection Manager is an independent Next.js application for assembling, importing, reviewing, and publishing
Nexus Mods collections. Users connect with Nexus Mods OAuth 2.0 using Authorization Code + PKCE; API credentials are
never entered into or exposed to browser JavaScript.

This project is not affiliated with, endorsed by, or operated by Nexus Mods.

## Features

- Nexus Mods OAuth sign-in with PKCE, encrypted server-side token storage, refresh-token rotation, and logout revocation
  of the local session.
- Mod search, Nexus URL resolution, file/version selection, and collection installation ordering.
- Bounded `collection.json` and ZIP import.
- Nexus collection manifest generation and publishing through the connected account.
- Local browser storage for editable collection drafts and preferences.
- Mock mode for UI development without live Nexus requests.

## Requirements

- Node.js 22 and npm 10+
- Cloudflare Workers/OpenNext and a D1 database for OAuth sessions
- A Nexus Mods OAuth application and registered callback URL
- A unique random `NEXUS_SESSION_SECRET` of at least 32 characters

## Local setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Uncomment and fill in the OAuth client ID and a unique session secret in `.env.local` when testing real OAuth. Optional
variables are intentionally absent rather than assigned empty values. The application has no fallback secret. A regular
Next.js development server does not expose the Cloudflare D1 binding; use mock mode for UI-only work or
`wrangler`/OpenNext when testing a real OAuth session.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXUS_SESSION_SECRET` | Yes | Encrypts OAuth tokens and temporary OAuth state; minimum 32 characters. |
| `NEXUS_OAUTH_CLIENT_ID` | Yes | Public Nexus OAuth client identifier. |
| `NEXUS_OAUTH_CLIENT_SECRET` | If issued | Confidential client secret; store only as a platform secret. |
| `NEXUS_OAUTH_REDIRECT_URI` | Production | Exact callback registered with Nexus Mods. |
| `NEXUS_OAUTH_AUTH_URL` | No | Defaults to `https://users.nexusmods.com/oauth/authorize`. |
| `NEXUS_OAUTH_TOKEN_URL` | No | Defaults to `https://users.nexusmods.com/oauth/token`. |
| `NEXUS_ALLOWED_OAUTH_HOSTS` | No | Exact HTTPS OAuth host allowlist; defaults to `users.nexusmods.com`. |
| `NEXUS_API_BASE` / `NEXUS_API_V3_BASE` | No | Nexus API bases. |
| `NEXUS_ALLOWED_API_HOSTS` | No | Exact HTTPS Bearer-token host allowlist; defaults to `api.nexusmods.com`. |
| `NEXUS_MOCK_MODE` | No | Uses sample data when `true`. |
| `NEXT_PUBLIC_SITE_URL` | Production | Canonical public origin used by OAuth redirects. |

Optional collection/search templates and category variables are documented in `.env.example`. Templates cannot bypass
the HTTPS host allowlist.

## D1 setup

Apply every migration before deploying the OAuth application:

```bash
npx wrangler d1 migrations apply collection-manager --remote
```

OAuth access and refresh tokens are encrypted before being written to D1. The browser receives only a random HttpOnly,
`SameSite=Lax` session ID. Sessions have an absolute 30-day lifetime; expired rows are deleted automatically during
session access, and logout removes both the D1 row and cookies.

## Security controls

- OAuth state and PKCE verifier are stored in an encrypted HttpOnly cookie for at most 10 minutes. `returnTo` accepts
  only same-origin absolute paths.
- Bearer tokens can only be sent to exact approved Nexus HTTPS hosts on port 443. OAuth client data has a separate exact
  host allowlist.
- Nexus and OAuth requests time out after 10 seconds; signed archive uploads time out after 30 seconds.
- Imports accept JSON or ZIP files up to 8 MB. Manifests are limited to 2 MB and 2,000 items. ZIP64, encrypted,
  multi-volume, excessive-entry, duplicate-manifest, high-ratio, and unsupported-compression archives are rejected.
- State-changing API calls require the same browser origin. API routes have body limits and per-client rate limits.
- Responses include CSP, HSTS, clickjacking, MIME-sniffing, referrer, opener, and permissions protections.

The application rate limiter is per worker instance. Add a distributed Cloudflare rate-limit rule for high-volume public
traffic.

## Validation and deployment

```bash
npm run check
npm run build
npm run cf:build
npm audit --omit=dev
```

Configure these as Cloudflare secrets, never as plain `wrangler.jsonc` variables:

```text
NEXUS_SESSION_SECRET
NEXUS_OAUTH_CLIENT_ID
NEXUS_OAUTH_CLIENT_SECRET (when applicable)
```

Then deploy with `npm run cf:deploy`. Review the privacy policy whenever OAuth scopes, hosting, logging, analytics, or
retention behavior changes.

## Project map

```text
app/api/auth/nexus/       OAuth start and callback routes
lib/oauth-session.ts      PKCE, encrypted D1 sessions, refresh and retention cleanup
lib/nexus.ts              Restricted Nexus Bearer-token client
app/api/collections/import Bounded collection importer
middleware.ts             Same-origin checks, rate limiting and request limits
migrations/               D1 schema and indexes
```

## License

No open-source license is currently granted by this repository. Unless a license is added, copyright remains with the
project owner. Never report security issues with live OAuth codes, tokens, cookies, or personal data.
