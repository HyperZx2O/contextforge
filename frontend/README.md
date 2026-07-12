# ContextForge Frontend

React + Vite frontend for ContextForge — a typed knowledge graph tool for literature reviews.

## Prerequisites

- Node.js 18+
- npm

## Quick start

```bash
npm install
npm run dev
```

Opens at `http://localhost:3000`. The landing page is at `/`, the workspace at `/app`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm test` | Run unit tests (vitest) |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend API URL |
| `VITE_USE_MOCK_API` | `false` | Set to `true` to use mock data (used by `start.bat`) |

## Project structure

```
frontend/
  src/
    components/    — Shared UI components (GraphCanvas, Skeleton, ErrorBoundary, etc.)
    landing/       — Landing page (marketing site)
    store/         — Zustand state management
    hooks/         — Custom React hooks
    api/           — API client and mock data
    constants/     — Color mappings, shared constants
    styles/        — Design tokens (tokens.css)
  public/          — Static assets (favicon, og-image)
  context/         — Design docs (gitignored)
```

## Design system

Visual baseline lives in `context/design.md` — Linear-style dark canvas (`#010102`), lavender accent (`#5e6ad2`), 4-step surface ladder, hairline borders. All colors, spacing, and motion tokens are defined in `src/styles/tokens.css`.
