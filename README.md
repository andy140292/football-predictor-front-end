# Futbol con U App

Frontend web app to predict football match outcomes. Users sign in with a Supabase magic-link email, pick a home and away team from a searchable list, and request predictions from the backend API. Results are shown per model with win/draw probabilities.

## Features
- Supabase email OTP login (magic link)
- Team search with autocomplete
- Match outcome probabilities (home/draw/away) across multiple models
- Responsive UI with reveal animations

## Tech Stack
- React + Vite
- Tailwind CSS
- Supabase (auth)

## Requirements
- Node.js 18+ (recommended)
- A Supabase project with email auth enabled

## Setup
1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file from `.env.example` and set:
```bash
VITE_API_BASE_URL=https://api.futbolconu.com
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_KEY=your_supabase_anon_key
```

3. Run the dev server:
```bash
npm run dev
```

## API Configuration
- `VITE_API_BASE_URL` is the production API URL.
- If not set, the app defaults to:
  - `/api` in development (uses the Vite proxy in `vite.config.js`)
  - `https://api.futbolconu.com` in production

## Production Deployment (Cloudflare Pages + Fly API)
Use this setup:
- Web: `https://futbolconu.com` and `https://www.futbolconu.com` on Cloudflare Pages
- API: `https://api.futbolconu.com` on Fly (`futbolconu-predictor`)

Cloudflare Pages settings:
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables:
  - `VITE_API_BASE_URL=https://api.futbolconu.com`
  - `VITE_SUPABASE_URL=...`
  - `VITE_SUPABASE_KEY=...`

Routing:
- `public/_redirects` includes SPA fallback for client-side routes.

Backend requirements:
- Update backend `ALLOWED_ORIGINS` to include:
  - `https://futbolconu.com`
  - `https://www.futbolconu.com`

Supabase Auth requirements:
- Site URL: `https://futbolconu.com`
- Redirect URLs:
  - `https://futbolconu.com`
  - `https://www.futbolconu.com`

## Scripts
- `npm run dev` - start the development server
- `npm run build` - build for production
- `npm run preview` - preview the production build
- `npm run lint` - run ESLint
- `./scripts/verify_production_deploy.sh` - verify domain/HTTPS/API/CORS after deployment
