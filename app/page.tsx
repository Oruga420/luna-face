import Script from 'next/script'

export default function Page() {
  return (
    <>
      <canvas id="face" />

      {/* Mobile friendly tap controls (also works on desktop) */}
      <div id="controls">
        <button data-action="camera">Camera</button>
        <button data-action="theme">Theme</button>
        <button data-action="idle">Idle</button>
        <button data-action="happy">Happy</button>
        <button data-action="lol">LOL</button>
        <button data-action="surprised">Surprised</button>
        <button data-action="angry">Angry</button>
        <button data-action="sleep">Sleep</button>
        <button data-action="voice">Voice</button>
      </div>

      <div id="hud">
        <div>
          <strong>LunaFace</strong> (tap Theme, or tap canvas to toggle)
        </div>
        <div className="keys">
          Keys: 1 minimal | 2 kawaii | i idle | b blink | y sleepy | z sleep | s speaking | u surprised | a angry | h happy | l lol | p play voice | c camera
        </div>
      </div>

      <Script type="module" src="/face.js" strategy="afterInteractive" />
    </>
  )
}
