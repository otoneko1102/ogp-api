```bash
npm install
npm run dev
```

Open: http://localhost:3090

## Usage

GET /?url={ENCODED_URL}

Example:

```bash
curl -s "http://localhost:3090/?url=https%3A%2F%2Fexample.com" | jq .
```

Response JSON:

- title: string
- description: string
- image: string | null
- siteName: string
- favicon: string
- url: string
- isFallback: boolean

Notes:

- The server caches fetched OGP results for 30 minutes (server-side). The response also includes `Cache-Control: public, max-age=1800` for client caching.
- You can specify the language used for fetching metadata with the `lang` query parameter (supported values: `en`, `ja`). Example: `/?url=...&lang=ja`. The server keeps separate caches per language. The default language is set in `src/config.ts` (`DEFAULT_LANG`).
- If fetching fails, a lightweight fallback object is returned with `isFallback: true`. Fallback results are cached for a short default period (1 minute) and can be configured via the `OGP_FALLBACK_TTL_MS` environment variable (milliseconds).
## Running with PM2

A sample PM2 ecosystem file (`ecosystem.config.cjs`) is included in the repository. This file runs the compiled app from `dist/index.js` in **fork** mode (one process) so the in-memory cache behaves predictably.

Example usage:

```bash
# 1. Build the project
npm run build

# 2. Start with PM2 in production mode
pm2 start ecosystem.config.cjs --env production

# Useful commands
pm2 status
pm2 logs ogp-api
pm2 restart ogp-api --update-env
pm2 stop ogp-api
```
