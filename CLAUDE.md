# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start both Express API server (port 3001) and Vite dev server concurrently
npm run build    # Vite production build → dist/
npm run api      # Start Express API server only (port 3001)
```

There are no tests in this project.

## Environment Variables

Copy `.env.example` to `.env` and fill in:

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` — Supabase project credentials (exposed to browser via `VITE_` prefix)
- `ANTHROPIC_KEY` — Anthropic API key (server-side only, no `VITE_` prefix)

## Architecture

This is a Thai local government daily-subsidy tracking app for municipalities (เทศบาล) and sub-district administrative organizations (อบต.) in Warin Chamrap district.

**Frontend** (`src/App.jsx`) — single-file React 18 SPA built with Vite. All components live in this one file: `App`, `MTable`, `SumView`, `ChartView`, `SCard`. In dev, Vite proxies `/api/*` → `http://localhost:3001` (configured in `vite.config.js`).

**API server** (`api-server.js` + `api/extract.js`) — Express server that wraps the single `/api/extract` POST endpoint. In dev this runs locally; on Vercel it becomes a serverless function. The endpoint accepts a base64-encoded PDF or image, calls the Anthropic API (`claude-sonnet-4-6`) with a Thai-language prompt, and returns structured JSON with per-organization subsidy amounts.

**Database** — Supabase table `monthly_data` with columns `month` (primary key, format `{fiscalYear}_{monthName}` e.g. `2568_ตุลาคม`), `days` (array of day numbers), `table_data` (nested object), `history` (import log), `updated_at`.

**Deployment** — Vercel handles the frontend build (`npm run build`) and serves `api/extract.js` as a serverless function. `vercel.json` rewrites all non-API paths to `index.html` for SPA routing.

## Key Data Structures

**`DB` state** (in-memory, synced to Supabase):
```
{
  [monthName]: {
    days: string[],          // sorted day numbers e.g. ["1","5","15"]
    table: {
      [orgName]: {
        [day]: { p97: string, p3: string }  // 97% and 3% fund amounts
      }
    },
    history: [{ day, total_p97, total_p3, total_amount }]  // PDF import log
  }
}
```

**Fiscal year** uses Thai Buddhist Era (BE): October starts a new fiscal year, so the year increments if month ≥ October. Stored as Thai year string (e.g. `"2568"`).

## Important Conventions

- The 34 local organizations are hardcoded in two places: `src/App.jsx` (arrays `TESSABAN` and `OBT`) and `api/extract.js` (the `ORGS` array for the Claude prompt). Keep them in sync.
- Auto-save triggers 1200ms after any `DB` change via a debounced `useEffect`. The `dirty` ref tracks which month needs saving.
- `findOrg()` in `App.jsx` does fuzzy name matching between OCR output and the hardcoded org list — handles Thai prefix variants (เทศบาลตำบล → ตำบล, etc.).
- Theme is fully inline-styled via the `mkTheme(isDark)` function returning a flat token object `T`. No CSS files or CSS-in-JS library.
- Export to Excel actually generates a UTF-8 BOM CSV (not a real `.xlsx` file).
