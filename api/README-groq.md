# Groq mood director (optional)

This LunaFace build can call an optional endpoint:

- `POST /api/groq`

The browser sends compact expression signals (no video):
```json
{
  "currentState": "idle",
  "theme": "kawaii",
  "expr": {"smile":0.2,"mouthOpen":0.1,"browsUp":0.0,"browFurrow":0.0}
}
```

Return:
```json
{ "state": "happy", "play": "hey" }
```

## Important

Do NOT call Groq directly from the browser or you'll leak the API key.
Implement this as a Vercel Serverless Function (API route) so the key stays in env vars.

Example states allowed:
- `idle`, `sleepy`, `sleeping`, `speaking`, `surprised`, `angry`, `happy`, `lol`

You said you'll add keys in Vercel. Great.
