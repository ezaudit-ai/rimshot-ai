# rimshot.ai

AI punchline/comeback generator where the rimshot sound is optional.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy

This repo is Next.js-ready for Vercel.

## Rimshot sound (day one)

- If `/public/rimshot.mp3` exists, the Rimshot button plays it.
- If not, the app synthesizes a rimshot sting so the button still works.

Use your own royalty-free rimshot file if you add `public/rimshot.mp3`.
