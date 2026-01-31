import Script from 'next/script'

export default function Page() {
  return (
    <>
      <canvas id="face" />
      <div id="hud">
        <div>
          <strong>LunaFace</strong> (click canvas to toggle theme)
        </div>
        <div className="keys">
          Keys: 1 minimal | 2 kawaii | i idle | b blink | y sleepy | z sleep | s speaking | u surprised | a angry | h happy | l lol | p play voice | c camera
        </div>
      </div>
      <Script type="module" src="/face.js" strategy="afterInteractive" />
    </>
  )
}
