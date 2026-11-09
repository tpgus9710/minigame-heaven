/* =====================================================================
 *  🎵 요트 다이스 소리 — 소리 파일 없이 Web Audio 로 직접 만들어요
 *   · 배경음악: 이 게임을 위해 새로 지은 재즈 카페풍 곡 (일렉트릭 피아노 · 비브라폰 · 워킹 베이스 · 브러시 드럼, 32마디 ≈ 74초 반복)
 *     화면의 🎵 버튼으로 켜고 꺼요 (기억해요). 메뉴에서 소리를 끄면 음악도 꺼져요.
 *   · 효과음: 컵 속 주사위 달그락 · 탁! · 주사위 구르는 소리 · KEEP · 기록 · 족보 축하 · 요트 팡파르
 * ===================================================================== */
const YachtAudio = (() => {
  let noiseBuf = null, sfxBus = null, busCtx = null;
  const ctx = () => {
    if (typeof Sound === 'undefined') return null;
    Sound.unlock();
    const c = Sound.ctx;
    return c && c.state === 'running' ? c : null;
  };
  const allowed = () => typeof Sound !== 'undefined' && Sound.on && Sound.vol > 0;
  function bus(c) {
    if (busCtx !== c || !sfxBus) {
      busCtx = c; sfxBus = c.createGain(); sfxBus.connect(c.destination);
      const n = Math.floor(c.sampleRate * 1.2); noiseBuf = c.createBuffer(1, n, c.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    sfxBus.gain.value = Sound.vol * 0.55;
    return sfxBus;
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  /** 음 하나: 오실레이터 → (필터) → 엔벨로프 → 출력 */
  function tone(c, out, f, t, dur, o = {}) {
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
    if (o.detune) osc.detune.value = o.detune;
    const a = o.attack ?? 0.005, peak = o.gain ?? 0.3, rel = o.release ?? 0.12, end = t + Math.max(a, dur);
    // 엔벨로프: 올라가기 → (줄어들기) → 놓기. setTarget 은 지금 값에서 부드럽게 이어져서 '틱' 소리가 나지 않아요
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (o.sustain != null) g.gain.setTargetAtTime(Math.max(0.0002, peak * o.sustain), t + a, (o.decay || 0.3) / 3);
    g.gain.setTargetAtTime(0.0001, end, rel / 4);
    let node = osc;
    if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; fl.Q.value = o.q || 0.7; osc.connect(fl); node = fl; }
    node.connect(g); g.connect(out);
    osc.start(t); osc.stop(end + rel * 1.6 + 0.05);
    return { osc, g };
  }
  /** 잡음 한 번 (주사위 딸깍 · 브러시 · 심벌) */
  function noise(c, out, t, dur, o = {}) {
    const src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    src.buffer = noiseBuf; fl.type = o.type || 'bandpass'; fl.frequency.value = o.freq || 3000; fl.Q.value = o.q ?? 1;
    const peak = o.gain ?? 0.2, a = o.attack ?? 0.002;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    src.connect(fl); fl.connect(g); g.connect(out);
    src.start(t, Math.random() * 0.8); src.stop(t + a + dur + 0.02);
  }
  /** 주사위 '딸깍' 하나 (단단한 플라스틱 소리: 높은 잡음 + 짧은 음) */
  function click(c, out, t, k = 1, muff = false) {
    noise(c, out, t, 0.018 + Math.random() * 0.012, { freq: muff ? 1400 + Math.random() * 600 : 2600 + Math.random() * 2200, q: muff ? 2 : 5, gain: 0.32 * k });
    tone(c, out, (muff ? 900 : 1700) + Math.random() * 900, t, 0.006, { gain: 0.06 * k, release: 0.03, type: 'triangle' });
  }

  /* ───── 효과음 ───── */
  const sfx = {
    _shake: null,
    /** 컵 흔들기: 손을 뗄 때까지 달그락 (세기는 흔드는 대로 조금씩 변해요) */
    shakeStart() {
      const c = ctx(); if (!c || !allowed() || this._shake) return;
      const out = bus(c);
      let swing = 0;
      const tick = () => {
        const now = c.currentTime;
        swing++;
        // 컵 벽에 부딪히는 묵직한 소리 (흔들 때마다)
        if (swing % 3 === 0) noise(c, out, now + 0.01, 0.05, { freq: 420 + Math.random() * 160, q: 1.4, gain: 0.22 });
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) click(c, out, now + 0.01 + Math.random() * 0.06, 0.6 + Math.random() * 0.5, Math.random() < 0.55);
      };
      tick();
      this._shake = setInterval(tick, 75);
    },
    shakeStop() { clearInterval(this._shake); this._shake = null; },
    /** 탁! 컵을 테이블에 엎어요 (묵직한 쿵 + 나무 소리 + 안에서 주사위 몇 번 딸깍) */
    slam() {
      const c = ctx(); if (!c || !allowed()) return;
      const out = bus(c), t = c.currentTime + 0.005;
      tone(c, out, 150, t, 0.05, { to: 48, glide: 0.16, gain: 0.95, release: 0.22 });
      noise(c, out, t, 0.07, { freq: 950, q: 2.2, gain: 0.55 });
      noise(c, out, t, 0.03, { type: 'highpass', freq: 3000, q: 0.5, gain: 0.18 });
      for (let i = 0; i < 5; i++) click(c, out, t + 0.02 + i * 0.012 + Math.random() * 0.02, 0.5, true);
    },
    /** 주사위 공개: 데굴데굴 굴러 멈춰요 (주사위마다 두세 번 튀어요) */
    reveal(n = 5) {
      const c = ctx(); if (!c || !allowed()) return;
      const out = bus(c), t0 = c.currentTime + 0.02;
      for (let i = 0; i < n; i++) {
        let t = t0 + i * 0.045 + Math.random() * 0.03, k = 1, gap = 0.07 + Math.random() * 0.03;
        for (let b = 0; b < 3; b++) { click(c, out, t, k); t += gap; gap *= 0.62; k *= 0.55; }
      }
    },
    /** 남기지 않은 주사위를 컵에 담아요 */
    collect(n = 5) {
      const c = ctx(); if (!c || !allowed() || !n) return;
      const out = bus(c), t0 = c.currentTime + 0.01;
      for (let i = 0; i < n; i++) click(c, out, t0 + i * 0.05 + Math.random() * 0.02, 0.55, true);
    },
    keep() { const c = ctx(); if (!c || !allowed()) return; const out = bus(c), t = c.currentTime + 0.005; tone(c, out, 560, t, 0.06, { to: 980, glide: 0.06, gain: 0.22, release: 0.08 }); click(c, out, t, 0.5); },
    unkeep() { const c = ctx(); if (!c || !allowed()) return; const out = bus(c), t = c.currentTime + 0.005; tone(c, out, 760, t, 0.06, { to: 430, glide: 0.06, gain: 0.18, release: 0.08 }); click(c, out, t, 0.4); },
    select() { const c = ctx(); if (!c || !allowed()) return; tone(c, bus(c), 1320, c.currentTime + 0.005, 0.03, { gain: 0.12, release: 0.06 }); },
    /** 점수 기록: 맑은 종소리 두 번 (0점은 둔탁하게) */
    score(pts) {
      const c = ctx(); if (!c || !allowed()) return;
      const out = bus(c), t = c.currentTime + 0.01;
      if (!pts) { tone(c, out, 240, t, 0.12, { to: 150, glide: 0.18, gain: 0.3, type: 'triangle', release: 0.15 }); return; }
      [[1318.5, 0], [1760, 0.09]].forEach(([f, d]) => { tone(c, out, f, t + d, 0.05, { gain: 0.2, release: 0.5 }); tone(c, out, f * 2.76, t + d, 0.02, { gain: 0.03, release: 0.25 }); });
    },
    /** 족보 축하: 짧게 올라가는 화음 · 요트는 팡파르 */
    combo(kind) {
      const c = ctx(); if (!c || !allowed()) return;
      const out = bus(c), t = c.currentTime + 0.02;
      if (kind === 'yacht') {
        // 팡파르: 금관 느낌 (톱니파 + 저역 통과) 화음이 올라가요 + 반짝이
        const seq = [[60, 64, 67], [62, 65, 69], [64, 67, 72], [67, 72, 76]];
        seq.forEach((ch, i) => ch.forEach(m => tone(c, out, mtof(m), t + i * 0.16, i === 3 ? 0.55 : 0.12, { type: 'sawtooth', lp: 2400, gain: 0.07, attack: 0.02, release: 0.3 })));
        for (let i = 0; i < 10; i++) tone(c, out, mtof(84 + [0, 4, 7, 12, 16][i % 5]), t + 0.66 + i * 0.05, 0.02, { gain: 0.06, release: 0.2 });
        noise(c, out, t, 0.6, { type: 'highpass', freq: 6000, q: 0.5, gain: 0.05, attack: 0.3 });
        return;
      }
      const notes = { ls: [72, 76, 79, 84], ss: [72, 76, 79], full: [69, 72, 76], four: [67, 71, 74] }[kind] || [72, 76];
      notes.forEach((m, i) => tone(c, out, mtof(m), t + i * 0.075, 0.05, { gain: 0.14, release: 0.35, type: 'triangle' }));
    },
    bonus() {
      const c = ctx(); if (!c || !allowed()) return;
      const out = bus(c), t = c.currentTime + 0.02;
      [76, 79, 83, 88, 91].forEach((m, i) => tone(c, out, mtof(m), t + i * 0.06, 0.04, { gain: 0.12, release: 0.4 }));
    },
    turn() { const c = ctx(); if (!c || !allowed()) return; const out = bus(c), t = c.currentTime + 0.01; tone(c, out, 988, t, 0.05, { gain: 0.12, release: 0.3 }); tone(c, out, 1319, t + 0.1, 0.05, { gain: 0.12, release: 0.4 }); },
    end() {
      const c = ctx(); if (!c || !allowed()) return;
      const out = bus(c), t = c.currentTime + 0.02;
      [[67, 0], [72, 0.15], [76, 0.3], [79, 0.45], [84, 0.62]].forEach(([m, d]) => tone(c, out, mtof(m), t + d, d > 0.6 ? 0.5 : 0.1, { gain: 0.13, release: 0.4, type: 'triangle' }));
    },
  };

  /* ───── 배경음악 (새로 지은 곡 — 재즈 카페 스윙, C장조, 104 BPM) ───── */
  // 코드 (일렉트릭 피아노는 근음 없이 3 · 7 · 9 · 13음으로, 베이스가 근음) — v: 피아노 음, b: [근음, 3음, 5음] (베이스 음역)
  const CH = {
    C: { v: [52, 55, 59, 62], b: [36, 40, 43] }, Am: { v: [52, 55, 59, 60], b: [33, 36, 40] }, Dm: { v: [53, 57, 60, 64], b: [38, 41, 45] },
    G7: { v: [53, 57, 59, 64], b: [31, 35, 38] }, Em: { v: [55, 59, 62, 66], b: [40, 43, 47] }, A7: { v: [55, 59, 61, 66], b: [33, 37, 40] },
    F: { v: [57, 60, 64, 67], b: [41, 45, 48] }, Fm: { v: [56, 60, 63, 67], b: [41, 44, 48] }, Bb7: { v: [56, 60, 62, 67], b: [34, 38, 41] },
    C69: { v: [52, 57, 62, 67], b: [36, 40, 43] },
  };
  // 마디마다 코드 (두 개면 두 박씩)
  const A = [['C'], ['Am'], ['Dm'], ['G7'], ['Em'], ['A7'], ['Dm', 'G7'], ['C69']];
  const B = [['F'], ['Fm', 'Bb7'], ['Em'], ['A7'], ['Dm'], ['G7'], ['Em', 'A7'], ['Dm', 'G7']];
  // 비브라폰 가락: [시작 박(0 ~ 3.67, 스윙 8분음표는 .67), 길이(박), 음]
  const MA = [
    [[1, 0.67, 67], [1.67, 0.33, 69], [2, 1, 71], [3, 0.67, 74], [3.67, 0.33, 76]],
    [[0, 1.5, 72], [1.67, 0.33, 71], [2, 0.67, 69], [2.67, 0.33, 67], [3, 1, 64]],
    [[0.67, 0.33, 65], [1, 0.67, 69], [1.67, 0.33, 72], [2, 1, 76], [3, 1, 74]],
    [[0, 0.67, 71], [0.67, 0.33, 72], [1, 1, 74], [2, 1.6, 67]],
    [[1, 0.67, 67], [1.67, 0.33, 71], [2, 1, 74], [3, 0.67, 76], [3.67, 0.33, 79]],
    [[0, 1, 76], [1, 0.67, 73], [1.67, 0.33, 74], [2, 1, 76], [3, 1, 79]],
    [[0, 0.67, 77], [0.67, 0.33, 76], [1, 1, 74], [2, 0.67, 71], [2.67, 0.33, 69], [3, 1, 67]],
    [[0, 2.6, 72]],
  ];
  // 두 번째에는 끝을 위로 열어서 다음 부분으로 넘어가요
  const MA2 = MA.slice(0, 7).concat([[[0, 1, 72], [1, 0.67, 76], [1.67, 0.33, 79], [2, 1.6, 81]]]);
  const MB = [
    [[0, 2, 69], [2, 1, 72], [3, 1, 76]],
    [[0, 2, 75], [2, 1, 74], [3, 1, 68]],
    [[0, 2, 67], [2, 1, 71], [3, 1, 74]],
    [[0, 2, 73], [2, 0.67, 76], [2.67, 0.33, 74], [3, 1, 73]],
    [[0, 1, 74], [1, 0.67, 77], [1.67, 0.33, 76], [2, 2, 69]],
    [[0, 1, 71], [1, 1, 74], [2, 1, 77], [3, 1, 76]],
    [[0, 1, 76], [1, 1, 79], [2, 1, 73], [3, 1, 76]],
    [[0, 2, 74], [2, 1, 71], [3, 0.8, 67]],
  ];
  const SONG = [...A.map((c, i) => ({ c, m: MA[i] })), ...A.map((c, i) => ({ c, m: MA2[i] })), ...B.map((c, i) => ({ c, m: MB[i] })), ...A.map((c, i) => ({ c, m: MA[i] }))];
  const COMP = [[[0, 0.9], [2.67, 1.1]], [[0.67, 0.8], [2, 0.9]], [[0, 0.55], [1.67, 0.5], [3, 0.9]], [[0, 1.6], [3.67, 0.3]]];
  const BPM = 104, SPB = 60 / BPM;

  const music = {
    playing: false, bar: 0, t0: 0, timer: null, gain: null, comp: null,
    get on() { return typeof store === 'undefined' || store.get('ycBgm', '1') !== '0'; },
    set on(v) { if (typeof store !== 'undefined') store.set('ycBgm', v ? '1' : '0'); if (v) this.start(); else this.stop(); },
    start() {
      if (this.playing || !this.on || !allowed()) return;
      const c = ctx(); if (!c) return;
      bus(c);
      this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -18; this.comp.ratio.value = 3; this.comp.connect(c.destination);
      this.gain = c.createGain(); this.gain.gain.setValueAtTime(0.0001, c.currentTime);
      this.gain.gain.exponentialRampToValueAtTime(Math.max(0.001, Sound.vol * 0.5), c.currentTime + 1.5);
      this.gain.connect(this.comp);
      this.bar = 0; this.t0 = c.currentTime + 0.12; this.playing = true;
      this.tick();
      this.timer = setInterval(() => this.tick(), 90);
    },
    stop(fade = 0.7) {
      if (!this.playing) return;
      this.playing = false; clearInterval(this.timer);
      const c = Sound.ctx, g = this.gain, cp = this.comp;
      if (c && g) {
        try { g.gain.cancelScheduledValues(c.currentTime); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + fade); } catch { /* 무시 */ }
        setTimeout(() => { try { g.disconnect(); cp.disconnect(); } catch { /* 무시 */ } }, fade * 1000 + 300);
      }
      this.gain = null; this.comp = null;
    },
    /** 앞으로 0.35초 안에 시작할 마디를 미리 예약해요 */
    tick() {
      const c = Sound.ctx;
      if (!c || !this.gain || !allowed() || (typeof isScreen === 'function' && !isScreen('yacht')) || document.hidden) return this.stop(0.4);
        while (this.t0 + this.bar * 4 * SPB < c.currentTime + 0.35) { this.playBar(this.bar % SONG.length, this.t0 + this.bar * 4 * SPB); this.bar++; }
    },
    playBar(i, T) {
      const c = Sound.ctx, out = this.gain, bar = SONG[i], nxt = SONG[(i + 1) % SONG.length];
      const at = b => T + b * SPB;
      // 🎹 일렉트릭 피아노 (반주): 마디마다 리듬을 바꿔요
      const chords = bar.c.length === 2 ? [[bar.c[0], 0, 2], [bar.c[1], 2, 2]] : [[bar.c[0], 0, 4]];
      const comp = COMP[i % COMP.length];
      for (const [name, b0, len] of chords) {
        for (const [st, d] of comp) {
          if (st < b0 || st >= b0 + len) continue;
          for (const m of CH[name].v) {
            tone(c, out, mtof(m), at(st), d * SPB, { gain: 0.028, attack: 0.012, decay: 0.5, sustain: 0.45, release: 0.25, lp: 2200 });
            tone(c, out, mtof(m) * 2, at(st), d * SPB * 0.6, { gain: 0.008, attack: 0.008, release: 0.15, detune: 6 });
          }
        }
      }
      // 🎸 워킹 베이스: 근음 → 코드 음 → 다음 근음으로 반음 다가가기
      const walk = [];
      if (bar.c.length === 2) { const [p, q] = bar.c.map(n => CH[n].b); walk.push(p[0], p[2], q[0], q[1]); }
      else { const b = CH[bar.c[0]].b, v = i % 3; walk.push(b[0], v === 1 ? b[2] : b[1], v === 1 ? b[0] + 12 : b[2], b[1] + (v === 2 ? 2 : 0)); }
      const nr = CH[nxt.c[0]].b[0];
      walk[3] = i % 2 ? nr - 1 : nr + 1;
      walk.forEach((m, k) => {
        tone(c, out, mtof(m), at(k), SPB * 0.82, { type: 'triangle', gain: 0.14, attack: 0.004, decay: 0.25, sustain: 0.5, release: 0.08, lp: 820 });
        tone(c, out, mtof(m), at(k), SPB * 0.6, { gain: 0.07, attack: 0.004, release: 0.08 });
      });
      // 🥁 브러시 드럼: 라이드 스윙 · 2 · 4박에 하이햇과 브러시 · 1박에 살짝 킥
      [0, 1, 1.67, 2, 3, 3.67].forEach(b => noise(c, out, at(b), 0.14, { type: 'bandpass', freq: 7800, q: 0.9, gain: b % 1 ? 0.022 : 0.034 }));
      [1, 3].forEach(b => { noise(c, out, at(b), 0.03, { type: 'highpass', freq: 7000, q: 0.6, gain: 0.025 }); noise(c, out, at(b) - 0.02, 0.16, { type: 'bandpass', freq: 2600, q: 0.6, gain: 0.03, attack: 0.03 }); });
      if (i % 2 === 0) tone(c, out, 95, at(0), 0.06, { to: 48, glide: 0.12, gain: 0.12, release: 0.12 });
      // 🎵 비브라폰 가락 (트레몰로)
      for (const [st, d, m] of bar.m) {
        const f = mtof(m), t = at(st), dur = Math.max(0.12, d * SPB * 0.95);
        const v = tone(c, out, f, t, dur, { gain: 0.105, attack: 0.006, decay: 0.9, sustain: 0.35, release: 0.45 });
        tone(c, out, f * 4, t, 0.05, { gain: 0.016, release: 0.2 });
        const lfo = c.createOscillator(), lg = c.createGain();
        lfo.frequency.value = 5.2; lg.gain.value = 0.026; lfo.connect(lg); lg.connect(v.g.gain);
        lfo.start(t); lfo.stop(t + dur + 0.5);
      }
    },
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) music.stop(0.3);
    else if (typeof isScreen === 'function' && isScreen('yacht') && music.on) setTimeout(() => music.start(), 200);
  });
  return { sfx, music };
})();
