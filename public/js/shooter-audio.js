/* =====================================================================
 *  🎵 우주 슈팅 소리 (v14.1) — 소리 파일 없이 Web Audio 로 직접 만들어요 (옛날 오락기 느낌: 펄스파 · 삼각파 · 잡음)
 *   · 배경음악: 이 게임을 위해 새로 지은 곡 2개 — 스테이지(마단조 · 150 BPM · 16마디) · 보스(170 BPM · 8마디)
 *     판 아래 🎵 버튼으로 켜고 꺼요 (기억해요). 메뉴에서 소리를 끄면 음악도 꺼져요. 일시정지 · 위장 화면이면 같이 멈춰요.
 *   · 효과음: 사격 · 명중 · 쇠 튕김 · 크기별 폭발 · 보스 폭발 · 폭탄 · 경고 사이렌 · 레이저 · 아이템 · 스테이지 별 · 1UP · 스테이지 시작/끝 · 게임 오버
 * ===================================================================== */
const ShAudio = (() => {
  let noiseBuf = null, bus = null, comp = null, busCtx = null, pulse25 = null, pulse12 = null;
  const ctx = () => {
    if (typeof Sound === 'undefined') return null;
    Sound.unlock();
    const c = Sound.ctx;
    return c && c.state === 'running' ? c : null;
  };
  const allowed = () => typeof Sound !== 'undefined' && Sound.on && !Sound.hush && Sound.vol > 0;
  /** 펄스파 (오락기 소리): 높은 시간 비율 d */
  function pulseWave(c, d) {
    const n = 40, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) { re[k] = Math.sin(2 * Math.PI * k * d) / (Math.PI * k); im[k] = (1 - Math.cos(2 * Math.PI * k * d)) / (Math.PI * k); }
    return c.createPeriodicWave(re, im);
  }
  function setup(c) {
    if (busCtx !== c || !bus) {
      busCtx = c;
      comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.12; comp.connect(c.destination);
      bus = c.createGain(); bus.connect(comp);
      const n = Math.floor(c.sampleRate * 1.5); noiseBuf = c.createBuffer(1, n, c.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      pulse25 = pulseWave(c, 0.25); pulse12 = pulseWave(c, 0.125);
    }
    bus.gain.value = Sound.vol * 0.5;
    return bus;
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function tone(c, out, f, t, dur, o = {}) {
    const osc = c.createOscillator(), g = c.createGain();
    if (o.type === 'p25') osc.setPeriodicWave(pulse25); else if (o.type === 'p12') osc.setPeriodicWave(pulse12); else osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.glide || dur));
    if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib; lg.gain.value = f * 0.012; l.connect(lg); lg.connect(osc.frequency); l.start(t + 0.08); l.stop(t + dur + 0.2); }
    const a = o.attack ?? 0.003, peak = o.gain ?? 0.2, rel = o.release ?? 0.06, end = t + Math.max(a, dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (o.sustain != null) g.gain.setTargetAtTime(Math.max(0.0002, peak * o.sustain), t + a, (o.decay || 0.2) / 3);
    g.gain.setTargetAtTime(0.0001, end, rel / 4);
    let node = osc;
    if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; osc.connect(fl); node = fl; }
    node.connect(g); g.connect(out);
    osc.start(t); osc.stop(end + rel * 1.6 + 0.05);
    return g;
  }
  function noise(c, out, t, dur, o = {}) {
    const src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    src.buffer = noiseBuf; fl.type = o.type || 'bandpass'; fl.frequency.setValueAtTime(o.freq || 2000, t); fl.Q.value = o.q ?? 0.8;
    if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const peak = o.gain ?? 0.2, a = o.attack ?? 0.002;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    src.connect(fl); fl.connect(g); g.connect(out);
    src.start(t, Math.random() * 1.2); src.stop(t + a + dur + 0.03);
  }
  /** 효과음 하나: amp = 크기 (음악 위에서도 잘 들리게 효과마다 맞춰 둔 값) */
  const go = (fn, amp = 1) => {
    const c = ctx(); if (!c || !allowed()) return;
    try { const b = setup(c), g = c.createGain(); g.gain.value = amp; g.connect(b); fn(c, g, c.currentTime + 0.005); setTimeout(() => { try { g.disconnect(); } catch { /* 무시 */ } }, 4000); } catch { /* 소리는 없어도 게임은 돼요 */ }
  };

  /* ───── 효과음 ───── */
  const sfx = {
    shot(w) { go((c, o, t) => {
      if (w === 'L') { tone(c, o, 2400, t, 0.03, { type: 'sine', to: 1900, gain: 0.025, release: 0.03 }); return; }
      tone(c, o, w === 'M' ? 1100 : 1500, t, 0.035, { type: 'p25', to: w === 'M' ? 600 : 800, gain: 0.032, release: 0.03 });
    }, 8); },
    hit(big) { go((c, o, t) => {
      if (big) { tone(c, o, 900, t, 0.03, { type: 'square', to: 520, gain: 0.05, release: 0.04 }); noise(c, o, t, 0.025, { freq: 3500, q: 2, gain: 0.05 }); }
      else tone(c, o, 1700 + Math.random() * 300, t, 0.02, { type: 'triangle', to: 1100, gain: 0.06, release: 0.03 });
    }, 9); },
    clink() { go((c, o, t) => { tone(c, o, 3100, t, 0.03, { type: 'sine', gain: 0.05, release: 0.12 }); tone(c, o, 4300, t, 0.02, { type: 'sine', gain: 0.03, release: 0.1 }); }, 4); },
    kill(sz) { go((c, o, t) => {
      if (sz <= 1) { noise(c, o, t, 0.12, { freq: 1400, to: 300, q: 0.7, gain: 0.22 }); tone(c, o, 420, t, 0.08, { type: 'square', to: 70, glide: 0.12, gain: 0.07, lp: 1800 }); }
      else if (sz === 2) { noise(c, o, t, 0.3, { type: 'lowpass', freq: 2600, to: 200, gain: 0.32 }); tone(c, o, 220, t, 0.18, { type: 'square', to: 40, glide: 0.25, gain: 0.1, lp: 900 }); }
      else { noise(c, o, t, 0.55, { type: 'lowpass', freq: 1800, to: 90, gain: 0.42 }); tone(c, o, 140, t, 0.4, { type: 'sine', to: 32, glide: 0.5, gain: 0.32 }); noise(c, o, t + 0.12, 0.3, { type: 'lowpass', freq: 900, to: 120, gain: 0.2 }); }
    }, sz <= 1 ? 3.3 : sz === 2 ? 2.6 : 1.4); },
    boom(big) { this.kill(big ? 3 : 2); },
    bossDie() { go((c, o, t) => {
      noise(c, o, t, 2.2, { type: 'lowpass', freq: 3000, to: 60, gain: 0.5, attack: 0.01 });
      tone(c, o, 110, t, 1.8, { type: 'sine', to: 25, glide: 2, gain: 0.4, release: 0.4 });
      for (let i = 0; i < 6; i++) noise(c, o, t + 0.2 + i * 0.28, 0.25, { type: 'lowpass', freq: 1500, to: 150, gain: 0.25 });
    }); },
    bossEnd(big) { go((c, o, t) => {
      noise(c, o, t, big ? 1.6 : 0.9, { type: 'lowpass', freq: 4000, to: 50, gain: 0.55 });
      tone(c, o, 90, t, big ? 1.4 : 0.8, { type: 'sine', to: 22, glide: big ? 1.5 : 0.9, gain: 0.45, release: 0.5 });
      tone(c, o, 60, t + 0.05, 0.6, { type: 'square', to: 30, gain: 0.08, lp: 300 });
    }); },
    warn() { go((c, o, t) => {
      for (let i = 0; i < 6; i++) { tone(c, o, 620, t + i * 0.5, 0.24, { type: 'p25', gain: 0.07, release: 0.04, lp: 2600 }); tone(c, o, 465, t + i * 0.5 + 0.25, 0.24, { type: 'p25', gain: 0.07, release: 0.04, lp: 2600 }); }
      tone(c, o, 55, t, 3, { type: 'sawtooth', gain: 0.05, lp: 220, attack: 0.3, release: 0.3 });
    }, 3.5); },
    mid() { go((c, o, t) => { for (let i = 0; i < 2; i++) tone(c, o, 880, t + i * 0.16, 0.08, { type: 'p25', gain: 0.06 }); }, 4); },
    stage() { go((c, o, t) => {
      [64, 67, 71, 76].forEach((m, i) => tone(c, o, mtof(m), t + i * 0.07, 0.06, { type: 'p25', gain: 0.07 }));
      [64, 71, 76, 79].forEach(m => tone(c, o, mtof(m), t + 0.3, 0.5, { type: 'p12', gain: 0.04, release: 0.3 }));
    }, 3); },
    clear(all) { go((c, o, t) => {
      const seq = all ? [[72, 0], [76, 0.1], [79, 0.2], [84, 0.3], [79, 0.45], [84, 0.55], [88, 0.65]] : [[72, 0], [76, 0.1], [79, 0.2], [84, 0.32]];
      seq.forEach(([m, d], i) => tone(c, o, mtof(m), t + d, i === seq.length - 1 ? 0.6 : 0.08, { type: 'p25', gain: 0.08, release: 0.25, vib: i === seq.length - 1 ? 6 : 0 }));
      [60, 64, 67].forEach(m => tone(c, o, mtof(m), t + seq[seq.length - 1][1], 0.6, { type: 'triangle', gain: 0.1, release: 0.3 }));
    }, 1.7); },
    pick(k) { go((c, o, t) => {
      const seq = k === 'P' ? [72, 76, 79, 84] : k === 'B' ? [60, 67, 72] : k === 'L' ? [79, 84, 88, 91] : k === 'M' ? [74, 79, 83, 86] : [76, 81, 85, 88];
      seq.forEach((m, i) => tone(c, o, mtof(m), t + i * 0.045, 0.04, { type: 'p25', gain: 0.07, release: 0.06 }));
    }, 3.5); },
    formation() { go((c, o, t) => { [84, 91, 96].forEach((m, i) => tone(c, o, mtof(m), t + i * 0.06, 0.05, { type: 'p12', gain: 0.07, release: 0.12 })); }, 4.4); },
    bomb() { go((c, o, t) => {
      noise(c, o, t, 1.4, { type: 'lowpass', freq: 5000, to: 80, gain: 0.55, attack: 0.02 });
      tone(c, o, 160, t, 1.2, { type: 'sine', to: 30, glide: 1.3, gain: 0.45, release: 0.3 });
      noise(c, o, t, 0.5, { type: 'highpass', freq: 3000, to: 8000, gain: 0.12, attack: 0.15 });
    }); },
    /** 스테이지 별 하나 (i: 0 · 1 · 2 → 점점 높게) */
    star(i) { go((c, o, t) => { const m = [84, 88, 91][i] || 91; tone(c, o, mtof(m), t, 0.08, { type: 'p25', gain: 0.08, release: 0.2 }); tone(c, o, mtof(m + 12), t + 0.05, 0.1, { type: 'sine', gain: 0.05, release: 0.3 }); }, 3); },
    die() { go((c, o, t) => {
      tone(c, o, 700, t, 0.6, { type: 'square', to: 60, glide: 0.7, gain: 0.12, lp: 2200 });
      noise(c, o, t, 0.8, { type: 'lowpass', freq: 3000, to: 100, gain: 0.45 });
      tone(c, o, 100, t, 0.5, { type: 'sine', to: 30, gain: 0.35 });
    }); },
    respawn() { go((c, o, t) => { [64, 71, 76].forEach((m, i) => tone(c, o, mtof(m), t + i * 0.06, 0.05, { type: 'p12', gain: 0.05 })); }, 3); },
    extend() { go((c, o, t) => { [84, 88, 91, 96, 91, 96].forEach((m, i) => tone(c, o, mtof(m), t + i * 0.07, 0.06, { type: 'p25', gain: 0.08, release: 0.1 })); }, 3.3); },
    eshot() { go((c, o, t) => { tone(c, o, 640, t, 0.03, { type: 'p25', to: 380, gain: 0.025, lp: 2000 }); }, 7); },
    laserWarn() { go((c, o, t) => { for (let i = 0; i < 3; i++) tone(c, o, 1320, t + i * 0.18, 0.06, { type: 'p25', gain: 0.05 }); }, 5); },
    laserOn() { go((c, o, t) => { tone(c, o, 180, t, 0.7, { type: 'sawtooth', gain: 0.08, lp: 1500, vib: 22 }); noise(c, o, t, 0.7, { freq: 2400, q: 1.5, gain: 0.08 }); }, 3.3); },
    split() { go((c, o, t) => { tone(c, o, 500, t, 0.05, { type: 'square', to: 1200, gain: 0.05, lp: 3000 }); }, 3.5); },
    dash() { go((c, o, t) => { noise(c, o, t, 0.3, { freq: 600, to: 3000, q: 1.2, gain: 0.08, attack: 0.05 }); }, 14); },
    phase() { go((c, o, t) => { tone(c, o, 300, t, 0.3, { type: 'square', to: 120, gain: 0.08, lp: 1200 }); noise(c, o, t, 0.4, { type: 'lowpass', freq: 1200, to: 200, gain: 0.25 }); }, 2.3); },
    over() { go((c, o, t) => { [[76, 0], [72, 0.22], [69, 0.44], [64, 0.7]].forEach(([m, d], i) => tone(c, o, mtof(m), t + d, i === 3 ? 0.8 : 0.18, { type: 'p25', gain: 0.08, release: 0.3, vib: i === 3 ? 5 : 0 })); tone(c, o, mtof(40), t + 0.7, 0.9, { type: 'triangle', gain: 0.12, release: 0.4 }); }, 2); },
  };

  /* ───── 배경음악 (새로 지은 곡) ───── */
  // 마디마다 코드 (둘이면 반 마디씩) · 가락: [시작(16분음표), 길이, 음]
  const CH = {
    Em: [40, 47, 52, 55, 59], D: [38, 45, 50, 54, 57], G: [43, 50, 55, 59, 62], B: [35, 42, 47, 51, 54], C: [36, 43, 48, 52, 55], Am: [33, 40, 45, 48, 52], B7: [35, 42, 45, 51, 57],
    F: [41, 48, 53, 57, 60], Gs: [43, 50, 55, 59, 62],
  };
  const SONGS = {
    stage: {
      bpm: 150, lead: 'p25',
      bars: [
        [['Em'], [[0, 4, 76], [4, 2, 76], [6, 2, 78], [8, 4, 79], [12, 4, 83]]],
        [['D'], [[0, 6, 81], [6, 2, 79], [8, 4, 78], [12, 4, 74]]],
        [['Em'], [[0, 4, 76], [4, 2, 76], [6, 2, 78], [8, 4, 79], [12, 4, 83]]],
        [['G', 'B'], [[0, 6, 86], [6, 2, 84], [8, 8, 83]]],
        [['C'], [[0, 4, 84], [4, 2, 83], [6, 2, 81], [8, 4, 79], [12, 4, 76]]],
        [['D'], [[0, 4, 78], [4, 2, 79], [6, 2, 81], [8, 8, 83]]],
        [['Am', 'B'], [[0, 4, 81], [4, 2, 79], [6, 2, 78], [8, 4, 76], [12, 4, 75]]],
        [['Em'], [[0, 12, 76]]],
        [['G'], [[0, 4, 83], [4, 2, 81], [6, 2, 79], [8, 4, 81], [12, 4, 83]]],
        [['Am'], [[0, 4, 84], [4, 4, 83], [8, 8, 81]]],
        [['Em'], [[0, 4, 79], [4, 2, 78], [6, 2, 76], [8, 4, 78], [12, 4, 79]]],
        [['D', 'B7'], [[0, 8, 81], [8, 8, 83]]],
        [['C'], [[0, 6, 88], [6, 2, 86], [8, 4, 83], [12, 4, 79]]],
        [['D'], [[0, 4, 81], [4, 2, 83], [6, 2, 81], [8, 4, 79], [12, 4, 78]]],
        [['Am', 'B'], [[0, 4, 76], [4, 4, 79], [8, 4, 83], [12, 4, 87]]],
        [['Em'], [[0, 12, 88]]],
      ],
      drums: k => ({ kick: [0, 8, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], open: [14] }),
      bass: 'drive',
    },
    boss: {
      bpm: 170, lead: 'p25',
      bars: [
        [['Em'], [[0, 2, 76], [3, 1, 76], [4, 2, 77], [6, 2, 79], [8, 2, 77], [10, 2, 76], [12, 2, 74], [14, 2, 76]]],
        [['Em'], [[0, 4, 83], [4, 4, 82], [8, 4, 81], [12, 4, 79]]],
        [['F'], [[0, 2, 77], [3, 1, 77], [4, 2, 79], [6, 2, 81], [8, 2, 79], [10, 2, 77], [12, 2, 76], [14, 2, 77]]],
        [['F'], [[0, 4, 84], [4, 4, 83], [8, 4, 81], [12, 4, 80]]],
        [['Em'], [[0, 3, 88], [3, 1, 86], [4, 2, 88], [6, 2, 83], [8, 2, 79], [10, 2, 76], [12, 2, 79], [14, 2, 83]]],
        [['F'], [[0, 3, 84], [3, 1, 83], [4, 2, 84], [6, 2, 81], [8, 2, 77], [10, 2, 76], [12, 2, 77], [14, 2, 81]]],
        [['G'], [[0, 4, 79], [4, 4, 81], [8, 4, 83], [12, 4, 86]]],
        [['Em', 'B'], [[0, 8, 88], [8, 4, 87], [12, 4, 83]]],
      ],
      drums: k => ({ kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], open: [] }),
      bass: 'ostinato',
    },
  };

  const music = {
    playing: null, bar: 0, t0: 0, timer: null, gain: null, mcomp: null,
    get on() { return typeof store === 'undefined' || store.get('shBgm', '1') !== '0'; },
    set on(v) { if (typeof store !== 'undefined') store.set('shBgm', v ? '1' : '0'); if (!v) this.stop(0.4); },
    play(name) {
      if (this.playing === name && this.gain) return;
      this.stop(0.25);
      if (!this.on || !allowed()) { this.want = name; return; }
      const c = ctx(); if (!c) { this.want = name; return; }
      setup(c);
      this.mcomp = c.createDynamicsCompressor(); this.mcomp.threshold.value = -16; this.mcomp.ratio.value = 3; this.mcomp.connect(c.destination);
      this.gain = c.createGain(); this.gain.gain.setValueAtTime(0.0001, c.currentTime);
      this.gain.gain.exponentialRampToValueAtTime(Math.max(0.001, Sound.vol * 0.42), c.currentTime + 0.6);
      this.gain.connect(this.mcomp);
      this.playing = name; this.want = name; this.bar = 0; this.t0 = c.currentTime + 0.1;
      this.tick();
      this.timer = setInterval(() => this.tick(), 90);
    },
    stop(fade = 0.5) {
      this.want = null;
      if (!this.playing) return;
      this.playing = null; clearInterval(this.timer);
      const c = Sound.ctx, g = this.gain, cp = this.mcomp;
      if (c && g) {
        try { g.gain.cancelScheduledValues(c.currentTime); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + fade); } catch { /* 무시 */ }
        setTimeout(() => { try { g.disconnect(); cp.disconnect(); } catch { /* 무시 */ } }, fade * 1000 + 400);
      }
      this.gain = null; this.mcomp = null;
    },
    tick() {
      const c = Sound.ctx, song = SONGS[this.playing];
      if (!c || !this.gain || !song) return;
      if (!this.on || typeof Sound === 'undefined' || !Sound.on || !Sound.vol || (typeof isScreen === 'function' && !isScreen('shooter')) || document.hidden) { const w = this.playing; this.stop(0.3); this.want = w; return; }
      if (Sound.hush) return;                                         // 일시정지 · 위장: 소리판이 멈춰 있어요 (풀리면 그 자리에서 이어서)
      const SPB = 60 / song.bpm, barLen = 4 * SPB;
      while (this.t0 + this.bar * barLen < c.currentTime + 0.35) { this.playBar(song, this.bar % song.bars.length, this.t0 + this.bar * barLen, SPB / 4); this.bar++; }
    },
    playBar(song, i, T, st) {
      const c = Sound.ctx, out = this.gain, [chords, mel] = song.bars[i];
      const at = s => T + s * st;
      // 🥁 드럼 (잡음 + 낮은 음)
      const D = song.drums(i);
      for (const s of D.kick) { tone(c, out, 150, at(s), 0.05, { type: 'sine', to: 42, glide: 0.11, gain: 0.5, release: 0.08 }); }
      for (const s of D.snare) { noise(c, out, at(s), 0.12, { type: 'bandpass', freq: 1800, q: 0.6, gain: 0.22 }); tone(c, out, 210, at(s), 0.03, { type: 'triangle', to: 150, gain: 0.08 }); }
      for (const s of D.hat) noise(c, out, at(s), D.open.includes(s) ? 0.12 : 0.025, { type: 'highpass', freq: 7500, q: 0.5, gain: s % 4 === 0 ? 0.05 : 0.03 });
      if (song.bpm > 160 && i % 2 === 1) for (const s of [6, 14]) noise(c, out, at(s), 0.05, { type: 'bandpass', freq: 2200, q: 0.8, gain: 0.08 });
      // 🎸 베이스 (삼각파)
      for (let s = 0; s < 16; s += song.bass === 'ostinato' ? 1 : 2) {
        const ch = CH[chords.length === 2 && s >= 8 ? chords[1] : chords[0]], root = ch[0];
        let m = root;
        if (song.bass === 'drive') m = (s / 2) % 2 ? root + 12 : root;
        else m = [0, 0, 12, 0, 1, 0, 12, 0, 0, 0, 12, 0, 3, 0, 1, 0][s] + root;
        tone(c, out, mtof(m), at(s), st * (song.bass === 'ostinato' ? 0.8 : 1.7), { type: 'triangle', gain: 0.2, release: 0.04 });
      }
      // ✨ 펼침화음 (얇은 펄스 · 작게)
      for (let s = 0; s < 16; s++) {
        const ch = CH[chords.length === 2 && s >= 8 ? chords[1] : chords[0]], m = ch[2 + (s % 3)] + 12;
        tone(c, out, mtof(m), at(s), st * 0.7, { type: 'p12', gain: 0.022, release: 0.03 });
      }
      // 🎵 가락 (펄스 25% · 비브라토 · 메아리 한 번)
      for (const [s, len, m] of mel) {
        const dur = len * st * 0.92;
        tone(c, out, mtof(m), at(s), dur, { type: song.lead, gain: 0.075, release: 0.06, sustain: 0.7, decay: 0.25, vib: len >= 6 ? 5.5 : 0 });
        tone(c, out, mtof(m), at(s) + st * 3, Math.min(dur, st * 2), { type: song.lead, gain: 0.02, release: 0.05 });
      }
    },
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { const w = music.playing; music.stop(0.2); music.want = w; }
    else if (music.want && typeof isScreen === 'function' && isScreen('shooter') && music.on) setTimeout(() => music.play(music.want), 200);
  });
  return { sfx, music, _songs: SONGS };
})();
