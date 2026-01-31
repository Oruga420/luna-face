/*
  LunaFace
  - No-build, single-page canvas face
  - Themes: minimal + kawaii
  - States: idle, blink, sleepy, sleeping, speaking, surprised, angry, happy
  - Controls:
      1 minimal, 2 kawaii
      i idle, b blink, y sleepy, z sleeping, s speaking
  - Click toggles theme
*/

(() => {
  const canvas = document.getElementById('face');
  const ctx = canvas.getContext('2d', { alpha: false });

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
  let state = 'idle';

  // Layout
  const layout = {
    cx: 0,
    cy: 0,
    r: 0,
  };

  // State vars
  let t0 = performance.now();

  // Blink
  let blink = {
    active: false,
    start: 0,
    dur: 120,
    nextAt: 0,
  };

  // Sleep
  let sleep = {
    breathPhase: 0,
    droolNextAt: 0,
    drool: null,
  };

  // Idle drift
  let drift = {
    x: 0,
    y: 0,
  };

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function nowMs() {
    return performance.now();
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
    if (state === 'sleeping') return 1; // eyes shut
    if (!blink.active) return 0;

    const t = (nowMs() - blink.start) / blink.dur;
    if (t >= 1) {
      blink.active = false;
      scheduleBlink();
      return 0;
    }

    // ease in-out triangle
    const tri = t < 0.5 ? (t / 0.5) : (1 - (t - 0.5) / 0.5);
    return tri;
  }

  function setState(next) {
    state = next;

    // Reset some state-specific timers
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
      // return to idle quickly
      window.setTimeout(() => {
        if (state === 'blink') setState('idle');
      }, 160);
    }
  }

  function toggleTheme() {
    theme = theme.name === 'minimal' ? Themes.kawaii : Themes.minimal;
  }

  function drawMinimalFace({ cx, cy, r }, blinkK, eyeShiftX, eyeShiftY, sleepiness) {
    const mood = {
      surprised: state === 'surprised',
      angry: state === 'angry',
      happy: state === 'happy',
    };

    // background
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    // square eyes
    const eyeW = r * 0.28;
    const eyeHOpen = r * 0.28;

    // surprised = taller eyes, angry/sleepy = squintier
    const eyeOpenBoost = mood.surprised ? 1.25 : 1.0;
    const eyeSquint = mood.angry ? 0.55 : 1.0;

    const eyeH = Math.max(
      3,
      eyeHOpen * eyeOpenBoost * (1 - blinkK) * (1 - sleepiness * 0.65) * eyeSquint
    );

    const gap = r * 0.38;
    const y = cy - r * 0.05 + eyeShiftY;

    ctx.fillStyle = theme.eye;
    ctx.fillRect(cx - gap - eyeW / 2 + eyeShiftX, y - eyeH / 2, eyeW, eyeH);
    ctx.fillRect(cx + gap - eyeW / 2 + eyeShiftX, y - eyeH / 2, eyeW, eyeH);

    // eyebrows (minimal lines)
    if (mood.angry || mood.surprised) {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = Math.max(2, r * 0.012);
      ctx.lineCap = 'round';
      const browY = y - r * 0.20;
      const browW = eyeW * 0.85;
      const tilt = mood.angry ? r * 0.08 : -r * 0.05;

      // left brow
      ctx.beginPath();
      ctx.moveTo(cx - gap - browW / 2 + eyeShiftX, browY - tilt);
      ctx.lineTo(cx - gap + browW / 2 + eyeShiftX, browY + tilt);
      ctx.stroke();

      // right brow
      ctx.beginPath();
      ctx.moveTo(cx + gap - browW / 2 + eyeShiftX, browY + tilt);
      ctx.lineTo(cx + gap + browW / 2 + eyeShiftX, browY - tilt);
      ctx.stroke();
    }

    // mouth (only if not sleeping)
    if (state !== 'sleeping') {
      const mouthY = cy + r * 0.35;
      if (mood.happy) {
        // bigger smile
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = Math.max(2, r * 0.012);
        ctx.beginPath();
        ctx.arc(cx, mouthY, r * 0.11, 0, Math.PI);
        ctx.stroke();
      } else if (mood.angry) {
        // flat line
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = Math.max(2, r * 0.012);
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.10, mouthY);
        ctx.lineTo(cx + r * 0.10, mouthY);
        ctx.stroke();
      } else if (mood.surprised) {
        // small O
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = Math.max(2, r * 0.012);
        ctx.beginPath();
        ctx.ellipse(cx, mouthY, r * 0.06, r * 0.08, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // default tiny smile
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.arc(cx, mouthY, r * 0.06, 0, Math.PI);
        ctx.fill();
      }
    }
  }

  function drawKawaiiFace({ cx, cy, r }, blinkK, eyeShiftX, eyeShiftY, sleepiness) {
    const mood = {
      surprised: state === 'surprised',
      angry: state === 'angry',
      happy: state === 'happy',
    };

    // background with subtle gradient
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, theme.bg);
    g.addColorStop(1, '#fff2fb');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // face bubble
    ctx.fillStyle = theme.face;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    const baseEyeR = r * 0.23;
    const eyeR = baseEyeR * (mood.surprised ? 1.15 : 1.0) * (mood.angry ? 0.95 : 1.0);
    const gap = r * 0.40;
    const eyeY = cy - r * 0.10 + eyeShiftY;

    const eyelid = Math.min(1, blinkK + sleepiness * 0.55 + (mood.angry ? 0.10 : 0));

    const drawEye = (x) => {
      // outer eye
      ctx.fillStyle = theme.eye;
      ctx.beginPath();
      ctx.ellipse(x + eyeShiftX, eyeY, eyeR, eyeR * (1 - eyelid * 0.85), 0, 0, Math.PI * 2);
      ctx.fill();

      // highlights
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

      // closed-eye line
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

    // eyebrows (kawaii)
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

    // blush (happy = stronger)
    const blushAlphaBoost = mood.happy ? 1.35 : 1.0;
    ctx.fillStyle = theme.blush.replace('0.35', (0.35 * blushAlphaBoost).toFixed(2));
    const blushR = r * 0.14;
    ctx.beginPath();
    ctx.arc(cx - r * 0.58, cy + r * 0.18, blushR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + r * 0.58, cy + r * 0.18, blushR, 0, Math.PI * 2);
    ctx.fill();

    // mouth
    const mouthY = cy + r * 0.38;
    ctx.strokeStyle = theme.mouth;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    if (state === 'speaking') {
      // small open mouth
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

      // tiny shine
      ctx.fillStyle = 'rgba(255,255,255,' + (d.a * 0.8).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(d.x - d.r * 0.25, d.y - d.r * 0.25, d.r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function tick() {
    const t = nowMs();
    const dt = Math.min(50, t - t0);
    t0 = t;

    // random blinking in idle/sleepy/speaking/happy
    if ((state === 'idle' || state === 'sleepy' || state === 'speaking' || state === 'happy') && !blink.active && t > blink.nextAt) {
      startBlink();
    }

    const b = blinkAmount();

    // eye drift
    if (state === 'idle' || state === 'speaking' || state === 'happy') {
      const k = state === 'speaking' ? 0.45 : (state === 'happy' ? 0.75 : 1);
      drift.x = Math.sin(t * 0.0012) * layout.r * 0.03 * k;
      drift.y = Math.sin(t * 0.0018) * layout.r * 0.015 * k;
    } else {
      drift.x = 0;
      drift.y = 0;
    }

    // sleepiness factor (droop)
    const sleepiness = state === 'sleepy' ? 0.7 : (state === 'sleeping' ? 1 : 0);
    const isSurprised = state === 'surprised';
    const isAngry = state === 'angry';

    // auto-reset mood states after a bit (so it doesn't get stuck)
    if ((isSurprised || isAngry) && !blink.active) {
      // subtle auto-return to idle after a short beat
      // (do it once per entry by scheduling when we first detect it)
      if (!window.__lunafaceMoodTimeout) {
        window.__lunafaceMoodTimeout = window.setTimeout(() => {
          window.__lunafaceMoodTimeout = null;
          if (state === 'surprised' || state === 'angry') setState('idle');
        }, isSurprised ? 1600 : 2200);
      }
    }

    // breathing pulse (sleeping)
    let bgPulse = 0;
    if (state === 'sleeping') {
      sleep.breathPhase += dt * 0.001;
      bgPulse = (Math.sin(sleep.breathPhase * 1.6) + 1) / 2; // 0..1

      // drool bubble spawn + animate
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
        // appear
        if (d.a < 1 && d.r < d.maxR) {
          d.a = Math.min(1, d.a + dt * 0.0022);
          d.r = Math.min(d.maxR, d.r + dt * d.grow * 0.02);
        } else if (d.age > d.hold) {
          // fade
          d.a = Math.max(0, d.a - dt * 0.0015);
          d.r = Math.max(0, d.r - dt * 0.004);
          if (d.a === 0) {
            sleep.drool = null;
            sleep.droolNextAt = t + rand(5000, 11000);
          }
        }
      }

      // pulse background tint by tweaking theme bg
      if (theme.name === 'minimal') {
        // shift minimal bg slightly darker/lighter
        // no mutation: just draw a rect overlay later
      }
    }

    // draw
    if (theme.name === 'minimal') {
      drawMinimalFace(layout, b, drift.x, drift.y + sleepiness * layout.r * 0.08, sleepiness);
      if (state === 'sleeping') {
        // subtle dark overlay for breathing
        ctx.fillStyle = 'rgba(0,0,0,' + (0.10 * bgPulse).toFixed(3) + ')';
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      }
    } else {
      drawKawaiiFace(layout, b, drift.x, drift.y + sleepiness * layout.r * 0.09, sleepiness);
      if (state === 'sleeping') {
        ctx.fillStyle = 'rgba(255,110,170,' + (0.06 * bgPulse).toFixed(3) + ')';
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      }
    }

    requestAnimationFrame(tick);
  }

  // Audio
  const audio = {
    hey: new Audio('audio/hey-oruga.mp3'),
    brotaSleep: new Audio('audio/brota-sleep.mp3'),
  };
  audio.hey.preload = 'auto';
  audio.brotaSleep.preload = 'auto';

  function safePlay(a) {
    try {
      a.currentTime = 0;
      a.play();
    } catch (_) {
      // browser may block autoplay until first user interaction
    }
  }

  function onKey(e) {
    const k = e.key.toLowerCase();
    if (k === '1') theme = Themes.minimal;
    if (k === '2') theme = Themes.kawaii;
    if (k === 'i') setState('idle');
    if (k === 'b') setState('blink');
    if (k === 'y') setState('sleepy');
    if (k === 'z') { setState('sleeping'); safePlay(audio.brotaSleep); }
    if (k === 's') setState('speaking');
    if (k === 'u') setState('surprised');
    if (k === 'a') setState('angry');
    if (k === 'h') setState('happy');
    if (k === 'p') safePlay(audio.hey);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKey);
  canvas.addEventListener('click', toggleTheme);

  resize();
  scheduleBlink();
  requestAnimationFrame(tick);
})();
