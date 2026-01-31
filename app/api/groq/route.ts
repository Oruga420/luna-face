export const runtime = 'nodejs'

type ReqBody = {
  currentState?: string
  theme?: string
  expr?: {
    smile?: number
    mouthOpen?: number
    browsUp?: number
    browFurrow?: number
  }
}

type Decision = { state: string; play?: 'hey' | 'sleep' | null }

const ALLOWED = new Set(['idle', 'surprised', 'angry', 'happy', 'lol'])

function clamp01(x: unknown) {
  const n = typeof x === 'number' ? x : Number(x)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function heuristic(body: ReqBody): Decision {
  const e = body.expr || {}
  const smile = clamp01(e.smile)
  const mouthOpen = clamp01(e.mouthOpen)
  const browsUp = clamp01(e.browsUp)
  const browFurrow = clamp01(e.browFurrow)

  if (mouthOpen > 0.6 && smile > 0.35) return { state: 'lol', play: null }
  if (smile > 0.6) return { state: 'happy', play: null }
  if (browsUp > 0.5) return { state: 'surprised', play: null }
  if (browFurrow > 0.6) return { state: 'angry', play: null }
  return { state: 'idle', play: null }
}

export async function POST(request: Request) {
  let body: ReqBody
  try {
    body = (await request.json()) as ReqBody
  } catch {
    return Response.json({ state: 'idle', play: null } satisfies Decision)
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return Response.json(heuristic(body))

  const e = body.expr || {}
  const features = {
    smile: clamp01(e.smile),
    mouthOpen: clamp01(e.mouthOpen),
    browsUp: clamp01(e.browsUp),
    browFurrow: clamp01(e.browFurrow),
  }

  const system =
    'You are a tiny state director for an animated face. Choose exactly one state from: idle, surprised, angry, happy, lol. ' +
    'Return ONLY strict JSON: {"state":"<state>","play":null|"hey"|"sleep"}. No extra keys.'

  const user =
    `Expression scores: ${JSON.stringify(features)}\n` +
    `Current state: ${String(body.currentState || 'idle')}\n` +
    `Theme: ${String(body.theme || 'kawaii')}\n\n` +
    'Rules:\n' +
    '- If mouthOpen high and smile medium/high: lol\n' +
    '- If smile high: happy\n' +
    '- If browsUp high: surprised\n' +
    '- If browFurrow high: angry\n' +
    '- Otherwise: idle\n'

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        temperature: 0.2,
        max_tokens: 60,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })

    if (!resp.ok) return Response.json(heuristic(body))

    const data = await resp.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') return Response.json(heuristic(body))

    const parsed = JSON.parse(content)
    const s = String(parsed?.state || 'idle')
    const play = parsed?.play === 'hey' || parsed?.play === 'sleep' ? parsed.play : null

    return Response.json({ state: ALLOWED.has(s) ? s : 'idle', play })
  } catch {
    return Response.json(heuristic(body))
  }
}
