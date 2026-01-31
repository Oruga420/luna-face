/*
  LunaFace (v2)
  - No-build, single-page canvas face
  - Themes: minimal + kawaii
  - States: idle, blink, sleepy, sleeping, speaking, surprised, angry, happy, lol
  - Controls:
      1 minimal, 2 kawaii
      i idle, b blink, y sleepy, z sleeping, s speaking
      u surprised, a angry, h happy, l lol
      p play voice
      c toggle camera
  - Click toggles theme

  Optional features:
  - Camera tracking (MediaPipe Face Landmarker)
    - Tracks face center to steer eye direction
    - Extracts rough expression signals (smile/mouth open/brows up)
    - Calls optional /api/groq "mood director" (serverless) to pick a state

  Notes:
  - Runs fully in browser for camera + vision.
  - If you enable the mood director, you SHOULD proxy Groq via Vercel API routes
    so the API key stays secret.
*/

const canvas = document.getElementById('face');
// alpha:true so CSS theme backgrounds (incl. Unicorn) can show through.
const ctx = canvas.getContext('2d', { alpha: true });

const DPR = () => Math.max(1, Math.floor(window.devicePixelRatio || 1));

const Themes = {
  minimal: {
    name: 'minimal',
    bg: '#f39aa3',
    eye: '#121212',
    face: null,
    blush: null,
    mouth: null,
  },
  kawaii: {
    name: 'kawaii',
    bg: '#ffd7f0',
    eye: '#161616',
    face: 'rgba(255,255,255,0.85)',
    blush: 'rgba(255,120,180,0.35)',
    mouth: '#ff4fa6',
  },
};

let theme = Themes.minimal;

function getUiThemeMode() {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'dark' || t === 'light' || t === 'unicorn' ? t : 'dark';
}

function syncThemeFromDom() {
  const mode = getUiThemeMode();
  // Map UI theme to canvas theme.
  // dark -> minimal, light -> kawaii, unicorn -> kawaii (but transparent bg so CSS shows)
  theme = mode === 'dark' ? Themes.minimal : Themes.kawaii;
  return mode;
}
let state = 'idle';

// Layout
const layout = { cx: 0, cy: 0, r: 0 };

let t0 = performance.now();

// Blink
let blink = { active: false, start: 0, dur: 120, nextAt: 0 };

// Sleep
let sleep = { breathPhase: 0, droolNextAt: 0, drool: null };

// Idle drift / look steering
let drift = { x: 0, y: 0 };
let look = { x: 0, y: 0, tx: 0, ty: 0 }; // x/y current, tx/ty target

// Camera / vision
let cam = {
  enabled: false,
  video: null,
  stream: null,
  lastFaceAt: 0,
  faceX: 0,
  faceY: 0,
  expr: { smile: 0, mouthOpen: 0, browsUp: 0, browFurrow: 0 },
  // mediapipe
  ready: false,
  landmarker: null,
  lastVisionAt: 0,
  // mood director
  directorEnabled: true,
  lastDirectorAt: 0,
  directorCooldownMs: 1200,
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function nowMs() {
  return performance.now();
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function resize() {
  const dpr = DPR();
  const w = Math.floor(window.innerWidth);
  const h = Math.floor(window.innerHeight);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  layout.cx = w / 2;
  layout.cy = h / 2;
  layout.r = Math.min(w, h) * 0.34;
}

function scheduleBlink() {
  const base = state === 'sleepy' ? 4500 : 2800;
  const jitter = state === 'sleepy' ? 4500 : 2600;
  blink.nextAt = nowMs() + base + rand(0, jitter);
}

function startBlink() {
  blink.active = true;
  blink.start = nowMs();
  blink.dur = state === 'sleepy' ? 160 : 120;
}

function blinkAmount() {
  if (state === 'sleeping') return 1;
  if (!blink.active) return 0;

  const t = (nowMs() - blink.start) / blink.dur;
  if (t >= 1) {
    blink.active = false;
    scheduleBlink();
    return 0;
  }

  const tri = t < 0.5 ? (t / 0.5) : (1 - (t - 0.5) / 0.5);
  return tri;
}

function setState(next) {
  state = next;

  if (state === 'sleeping') {
    sleep.breathPhase = 0;
    sleep.drool = null;
    sleep.droolNextAt = nowMs() + rand(3000, 8000);
    blink.active = false;
  } else {
    sleep.drool = null;
    scheduleBlink();
  }

  if (state === 'blink') {
    startBlink();
    window.setTimeout(() => {
      if (state === 'blink') setState('idle');
    }, 160);
  }

  // auto-return for reactive moods
  if (state === 'surprised' || state === 'angry' || state === 'lol') {
    clearTimeout(window.__lunafaceMoodTimeout);
    window.__lunafaceMoodTimeout = window.setTimeout(() => {
      window.__lunafaceMoodTimeout = null;
      if (state === 'surprised' || state === 'angry' || state === 'lol') setState('idle');
    }, state === 'surprised' ? 1400 : (state === 'lol' ? 2000 : 2200));
  }
}

function toggleTheme() {
  // Keep legacy controls compatible: cycle the UI theme (dark -> light -> unicorn).
  const cur = getUiThemeMode();
  const next = cur === 'dark' ? 'light' : cur === 'light' ? 'unicorn' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('arena-theme', next); } catch (_) {}
  syncThemeFromDom();
}

// Audio (optional)
const audio = {
  // Use absolute paths so it works the same on Vercel/prod.
  hey: new Audio('/audio/hey-oruga.mp3'),
  brotaSleep: new Audio('/audio/brota-sleep.mp3'),
};
audio.hey.preload = 'auto';
audio.brotaSleep.preload = 'auto';

function safePlay(a) {
  try {
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch((e) => console.warn('Audio play blocked/failed:', e));
    }
  } catch (e) {
    console.warn('Audio play error:', e);
  }
}

function drawMinimalFace({ cx, cy, r }, blinkK, eyeShiftX, eyeShiftY, sleepiness, uiMode) {
  const mood = {
    surprised: state === 'surprised',
    angry: state === 'angry',
    happy: state === 'happy',
    lol: state === 'lol',
  };

  if (uiMode !== 'unicorn') {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  const eyeW = r * 0.28;
  const eyeHOpen = r * 0.28;

  const eyeOpenBoost = mood.surprised ? 1.25 : 1.0;
  const eyeSquint = mood.angry ? 0.55 : 1.0;

  const eyeH = Math.max(3, eyeHOpen * eyeOpenBoost * (1 - blinkK) * (1 - sleepiness * 0.65) * eyeSquint);
  const gap = r * 0.38;
  const y = cy - r * 0.05 + eyeShiftY;

  ctx.fillStyle = theme.eye;
  ctx.fillRect(cx - gap - eyeW / 2 + eyeShiftX, y - eyeH / 2, eyeW, eyeH);
  ctx.fillRect(cx + gap - eyeW / 2 + eyeShiftX, y - eyeH / 2, eyeW, eyeH);

  // eyebrows
  if (mood.angry || mood.surprised) {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = Math.max(2, r * 0.012);
    ctx.lineCap = 'round';
    const browY = y - r * 0.20;
    const browW = eyeW * 0.85;
    const tilt = mood.angry ? r * 0.08 : -r * 0.05;

    ctx.beginPath();
    ctx.moveTo(cx - gap - browW / 2 + eyeShiftX, browY - tilt);
    ctx.lineTo(cx - gap + browW / 2 + eyeShiftX, browY + tilt);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + gap - browW / 2 + eyeShiftX, browY + tilt);
    ctx.lineTo(cx + gap + browW / 2 + eyeShiftX, browY - tilt);
    ctx.stroke();
  }

  // mouth
  if (state !== 'sleeping') {
    const mouthY = cy + r * 0.35;
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = Math.max(2, r * 0.012);
    ctx.lineCap = 'round';

    if (mood.happy) {
      ctx.beginPath();
      ctx.arc(cx, mouthY, r * 0.11, 0, Math.PI);
      ctx.stroke();
    } else if (mood.angry) {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.10, mouthY);
      ctx.lineTo(cx + r * 0.10, mouthY);
      ctx.stroke();
    } else if (mood.surprised) {
      ctx.beginPath();
      ctx.ellipse(cx, mouthY, r * 0.06, r * 0.08, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (mood.lol) {
      ctx.beginPath();
      ctx.ellipse(cx, mouthY, r * 0.10, r * 0.12, 0, 0, Math.PI);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(cx, mouthY, r * 0.06, 0, Math.PI);
      ctx.stroke();
    }
  }
}

function drawKawaiiFace({ cx, cy, r }, blinkK, eyeShiftX, eyeShiftY, sleepiness, uiMode) {
  const mood = {
    surprised: state === 'surprised',
    angry: state === 'angry',
    happy: state === 'happy',
    lol: state === 'lol',
  };

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  if (uiMode !== 'unicorn') {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, theme.bg);
    g.addColorStop(1, '#fff2fb');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.fillStyle = theme.face;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
  ctx.fill();

  const baseEyeR = r * 0.23;
  const eyeR = baseEyeR * (mood.surprised ? 1.15 : 1.0) * (mood.angry ? 0.95 : 1.0);
  const gap = r * 0.40;
  const eyeY = cy - r * 0.10 + eyeShiftY;

  const eyelid = Math.min(1, blinkK + sleepiness * 0.55 + (mood.angry ? 0.12 : 0));

  const drawEye = (x) => {
    ctx.fillStyle = theme.eye;
    ctx.beginPath();
    ctx.ellipse(x + eyeShiftX, eyeY, eyeR, eyeR * (1 - eyelid * 0.85), 0, 0, Math.PI * 2);
    ctx.fill();

    if (eyelid < 0.9) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(x + eyeShiftX - eyeR * 0.25, eyeY - eyeR * 0.25, eyeR * 0.22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.70)';
      ctx.beginPath();
      ctx.arc(x + eyeShiftX + eyeR * 0.10, eyeY - eyeR * 0.38, eyeR * 0.10, 0, Math.PI * 2);
      ctx.fill();
    }

    if (eyelid > 0.92) {
      ctx.strokeStyle = 'rgba(20,20,20,0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - eyeR + eyeShiftX, eyeY);
      ctx.lineTo(x + eyeR + eyeShiftX, eyeY);
      ctx.stroke();
    }
  };

  drawEye(cx - gap);
  drawEye(cx + gap);

  if (mood.angry || mood.surprised) {
    ctx.strokeStyle = 'rgba(30,30,30,0.35)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const browY = eyeY - r * 0.22;
    const browW = eyeR * 1.6;
    const tilt = mood.angry ? r * 0.06 : -r * 0.04;

    ctx.beginPath();
    ctx.moveTo(cx - gap - browW / 2, browY - tilt);
    ctx.lineTo(cx - gap + browW / 2, browY + tilt);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + gap - browW / 2, browY + tilt);
    ctx.lineTo(cx + gap + browW / 2, browY - tilt);
    ctx.stroke();
  }

  const blushAlphaBoost = mood.happy || mood.lol ? 1.45 : 1.0;
  const blushFill = theme.blush.replace('0.35', (0.35 * blushAlphaBoost).toFixed(2));
  ctx.fillStyle = blushFill;
  const blushR = r * 0.14;
  ctx.beginPath();
  ctx.arc(cx - r * 0.58, cy + r * 0.18, blushR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + r * 0.58, cy + r * 0.18, blushR, 0, Math.PI * 2);
  ctx.fill();

  const mouthY = cy + r * 0.38;
  ctx.strokeStyle = theme.mouth;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  if (state === 'speaking') {
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, r * 0.07, r * 0.05, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (mood.happy) {
    ctx.beginPath();
    ctx.arc(cx, mouthY - r * 0.01, r * 0.08, 0, Math.PI);
    ctx.stroke();
  } else if (mood.angry) {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.08, mouthY);
    ctx.lineTo(cx + r * 0.08, mouthY);
    ctx.stroke();
  } else if (mood.surprised) {
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, r * 0.06, r * 0.08, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (mood.lol) {
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, r * 0.10, r * 0.12, 0, 0, Math.PI);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.06, mouthY);
    ctx.lineTo(cx + r * 0.06, mouthY);
    ctx.stroke();
  }

  // drool bubble when sleeping
  if (state === 'sleeping' && sleep.drool) {
    const d = sleep.drool;
    ctx.fillStyle = 'rgba(120, 210, 255, ' + d.a.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,' + (d.a * 0.8).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(d.x - d.r * 0.25, d.y - d.r * 0.25, d.r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- MediaPipe Face Landmarker (CDN) ---
// We only load it if camera is enabled.
async function loadMediaPipe() {
  if (cam.ready) return;

  // Free CDN-hosted ESM build
  // https://www.jsdelivr.com/package/npm/@mediapipe/tasks-vision
  const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs');

  const { FilesetResolver, FaceLandmarker } = vision;
  const fileset = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
  );

  cam.landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      // This model file is hosted by MediaPipe
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
      delegate: 'GPU',
    },
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false,
    runningMode: 'VIDEO',
    numFaces: 1,
  });

  cam.ready = true;
}

async function enableCamera() {
  if (cam.enabled) return;

  cam.video = document.createElement('video');
  cam.video.autoplay = true;
  cam.video.playsInline = true;
  cam.video.muted = true;

  cam.stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: false,
  });

  cam.video.srcObject = cam.stream;
  await cam.video.play();

  await loadMediaPipe();

  cam.enabled = true;
  cam.lastVisionAt = 0;
  cam.lastDirectorAt = 0;
}

function disableCamera() {
  cam.enabled = false;
  if (cam.stream) {
    cam.stream.getTracks().forEach((t) => t.stop());
  }
  cam.stream = null;
  cam.video = null;
  look.tx = 0;
  look.ty = 0;
}

function blendshapeScore(name) {
  if (!cam.blendshapes) return 0;
  const c = cam.blendshapes.categories.find((x) => x.categoryName === name);
  return c ? c.score : 0;
}

function updateExpressionsFromBlendshapes() {
  // These are approximate signals from MediaPipe blendshapes.
  // https://developers.google.com/mediapipe/solutions/vision/face_landmarker
  const smile = Math.max(
    blendshapeScore('mouthSmileLeft'),
    blendshapeScore('mouthSmileRight')
  );
  const mouthOpen = Math.max(
    blendshapeScore('jawOpen'),
    blendshapeScore('mouthOpen')
  );
  const browsUp = Math.max(
    blendshapeScore('browInnerUp'),
    blendshapeScore('browOuterUpLeft'),
    blendshapeScore('browOuterUpRight')
  );
  const browFurrow = Math.max(
    blendshapeScore('browDownLeft'),
    blendshapeScore('browDownRight')
  );

  cam.expr = {
    smile: clamp(smile, 0, 1),
    mouthOpen: clamp(mouthOpen, 0, 1),
    browsUp: clamp(browsUp, 0, 1),
    browFurrow: clamp(browFurrow, 0, 1),
  };
}

function updateLookFromFaceBox() {
  // We estimate face position using landmark 1 (nose tip-ish) if available.
  // This is a cheap proxy for where the user is.
  const lm = cam.landmarks;
  if (!lm || !lm.length) return;

  const nose = lm[1] || lm[0];
  if (!nose) return;

  // normalized 0..1
  const nx = nose.x;
  const ny = nose.y;

  // Map to look target in pixels
  // center is (0.5, 0.5)
  const dx = (nx - 0.5) * 2;
  const dy = (ny - 0.5) * 2;

  look.tx = clamp(dx, -1, 1);
  look.ty = clamp(dy, -1, 1);
}

async function maybeCallDirector() {
  if (!cam.directorEnabled) return;

  const t = nowMs();
  if (t - cam.lastDirectorAt < cam.directorCooldownMs) return;
  cam.lastDirectorAt = t;

  const payload = {
    currentState: state,
    theme: theme.name,
    expr: cam.expr,
  };

  try {
    const res = await fetch('/api/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return;
    const out = await res.json();
    if (out && out.state && typeof out.state === 'string') {
      const allowed = new Set(['idle','sleepy','sleeping','speaking','surprised','angry','happy','lol']);
      if (allowed.has(out.state)) setState(out.state);
    }

    if (out && out.play === 'hey') safePlay(audio.hey);
    if (out && out.play === 'sleep') safePlay(audio.brotaSleep);
  } catch (_) {
    // ignore
  }
}

async function runVisionFrame() {
  if (!cam.enabled || !cam.ready || !cam.video) return;

  const t = nowMs();
  // Limit vision compute rate
  if (t - cam.lastVisionAt < 90) return;
  cam.lastVisionAt = t;

  const res = cam.landmarker.detectForVideo(cam.video, t);
  if (!res) return;

  if (res.faceLandmarks && res.faceLandmarks.length) {
    cam.lastFaceAt = t;
    cam.landmarks = res.faceLandmarks[0];
    cam.blendshapes = res.faceBlendshapes ? res.faceBlendshapes[0] : null;

    updateLookFromFaceBox();
    updateExpressionsFromBlendshapes();

    // Quick heuristic: if no director, trigger states locally
    if (!cam.directorEnabled) {
      if (cam.expr.mouthOpen > 0.55 && cam.expr.smile > 0.35) setState('lol');
      else if (cam.expr.smile > 0.55) setState('happy');
      else if (cam.expr.browsUp > 0.45) setState('surprised');
      else if (cam.expr.browFurrow > 0.55) setState('angry');
    } else {
      // Let director pick state
      await maybeCallDirector();
    }
  } else {
    // No face detected recently: relax look
    if (t - cam.lastFaceAt > 1500) {
      look.tx = 0;
      look.ty = 0;
    }
  }
}

function tick() {
  const t = nowMs();
  const dt = Math.min(50, t - t0);
  t0 = t;

  // Vision
  runVisionFrame();

  // Smooth look steering
  look.x = lerp(look.x, look.tx, 0.08);
  look.y = lerp(look.y, look.ty, 0.08);

  // blinking
  if ((state === 'idle' || state === 'sleepy' || state === 'speaking' || state === 'happy') && !blink.active && t > blink.nextAt) {
    startBlink();
  }
  const b = blinkAmount();

  // eye drift baseline
  if (state === 'idle' || state === 'speaking' || state === 'happy') {
    const k = state === 'speaking' ? 0.45 : (state === 'happy' ? 0.75 : 1);
    drift.x = Math.sin(t * 0.0012) * layout.r * 0.03 * k;
    drift.y = Math.sin(t * 0.0018) * layout.r * 0.015 * k;
  } else {
    drift.x = 0;
    drift.y = 0;
  }

  const sleepiness = state === 'sleepy' ? 0.7 : (state === 'sleeping' ? 1 : 0);

  // sleeping breath + drool
  let bgPulse = 0;
  if (state === 'sleeping') {
    sleep.breathPhase += dt * 0.001;
    bgPulse = (Math.sin(sleep.breathPhase * 1.6) + 1) / 2;

    if (t > sleep.droolNextAt && !sleep.drool) {
      sleep.drool = {
        x: layout.cx + layout.r * 0.18,
        y: layout.cy + layout.r * 0.52,
        r: 2,
        a: 0.0,
        grow: rand(0.35, 0.55),
        maxR: layout.r * rand(0.06, 0.09),
        hold: rand(900, 1600),
        age: 0,
      };
    }

    if (sleep.drool) {
      const d = sleep.drool;
      d.age += dt;
      if (d.a < 1 && d.r < d.maxR) {
        d.a = Math.min(1, d.a + dt * 0.0022);
        d.r = Math.min(d.maxR, d.r + dt * d.grow * 0.02);
      } else if (d.age > d.hold) {
        d.a = Math.max(0, d.a - dt * 0.0015);
        d.r = Math.max(0, d.r - dt * 0.004);
        if (d.a === 0) {
          sleep.drool = null;
          sleep.droolNextAt = t + rand(5000, 11000);
        }
      }
    }
  }

  // Eye steering combines drift + camera look
  const steerX = drift.x + look.x * layout.r * 0.06;
  const steerY = drift.y + look.y * layout.r * 0.03;

  const uiMode = syncThemeFromDom();
  if (uiMode === 'unicorn') {
    // transparent background so CSS gradient + Unicorn layer show through
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  if (theme.name === 'minimal') {
    drawMinimalFace(layout, b, steerX, steerY + sleepiness * layout.r * 0.08, sleepiness, uiMode);
    if (state === 'sleeping') {
      ctx.fillStyle = 'rgba(0,0,0,' + (0.10 * bgPulse).toFixed(3) + ')';
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    }
  } else {
    drawKawaiiFace(layout, b, steerX, steerY + sleepiness * layout.r * 0.09, sleepiness, uiMode);
    if (state === 'sleeping') {
      ctx.fillStyle = 'rgba(255,110,170,' + (0.06 * bgPulse).toFixed(3) + ')';
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    }
  }

  requestAnimationFrame(tick);
}

function onKey(e) {
  const k = e.key.toLowerCase();
  if (k === '1') theme = Themes.minimal;
  if (k === '2') theme = Themes.kawaii;
  if (k === 'i') setState('idle');
  if (k === 'b') setState('blink');
  if (k === 'y') setState('sleepy');
  if (k === 'z') {
    setState('sleeping');
    safePlay(audio.brotaSleep);
  }
  if (k === 's') setState('speaking');
  if (k === 'u') setState('surprised');
  if (k === 'a') setState('angry');
  if (k === 'h') setState('happy');
  if (k === 'l') setState('lol');
  if (k === 'p') safePlay(audio.hey);
  if (k === 'c') {
    if (cam.enabled) disableCamera();
    else enableCamera();
  }
}

window.addEventListener('resize', resize);
window.addEventListener('keydown', onKey);
canvas.addEventListener('click', toggleTheme);

// Mobile/touch controls
(function bindControls() {
  const root = document.getElementById('controls');
  if (!root) return;

  root.addEventListener('click', async (e) => {
    const t = e.target;
    if (!t || !(t instanceof HTMLElement)) return;
    const action = t.getAttribute('data-action');
    if (!action) return;

    // Any user interaction unlocks audio on mobile
    try { await audio.hey.play().then(() => { audio.hey.pause(); audio.hey.currentTime = 0; }); } catch (_) {}

    if (action === 'theme') toggleTheme();
    if (action === 'camera') {
      if (cam.enabled) disableCamera();
      else enableCamera();
    }
    if (action === 'voice') safePlay(audio.hey);

    if (action === 'idle') setState('idle');
    if (action === 'happy') setState('happy');
    if (action === 'lol') setState('lol');
    if (action === 'surprised') setState('surprised');
    if (action === 'angry') setState('angry');
    if (action === 'sleep') { setState('sleeping'); safePlay(audio.brotaSleep); }
  });
})();

resize();
scheduleBlink();
requestAnimationFrame(tick);
