# LunaFace

Next.js app for LunaFace:
- Camera eye tracking in-browser (MediaPipe via CDN)
- Mood states + reactions
- Optional Groq director via `/api/groq`

## Dev

```bash
npm install
npm run dev
```

## Vercel env vars

- GROQ_API_KEY
- GROQ_MODEL (optional)

Privacy: camera stays local. Only small numeric expression scores are sent to `/api/groq`.
