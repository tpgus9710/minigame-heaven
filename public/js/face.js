/* =====================================================================
 *  얼굴 인식 엔진 (face.js) — 영천GO 키오스크와 같은 방식
 *   ① SCRFD det_500m        얼굴 상자 + 눈·코·입꼬리 5점 (얼굴 주변을 한 번 더 봐서 점을 정확하게)
 *   ② 5점을 표준 위치에 맞춰 112×112 로 자르기 (닮음 변환)
 *   ③ ArcFace MobileFaceNet  얼굴 특징값 512개 (길이 1로 맞춤)
 *  정면이 아니거나 너무 작은 얼굴은 버려요. 여러 장면의 특징값을 모아 평균을 써요.
 *  계산은 모두 이 브라우저 안에서 해요. 서버에는 특징값(숫자 512개)만 보내고 사진은 보내지 않아요.
 *  모델: InsightFace buffalo_s (비상업 연구용) · 실행기: onnxruntime-web 1.20.1 (MIT)
 * ===================================================================== */
'use strict';
const FaceAI = (() => {
  const ORT = '/vendor/ort-1.20.1/', MODELS = '/models/face-1/';
  // 받을 파일 (받는 크기 · 압축을 푼 크기) — 진행률 표시용
  const FILES = {
    det: { url: MODELS + 'det_500m.f16.onnx', net: 1.28, raw: 1280341 },
    rec: { url: MODELS + 'w600k_mbf.f16.onnx', net: 6.82, raw: 6822165 },
    wasm: { url: ORT + 'ort-wasm-simd-threaded.wasm', net: 3.0, raw: 11246032 },
  };
  const DST = [[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]];
  const DET = 320, REF = 224;          // 전체 화면 검출 크기 · 얼굴 주변 다시 보기 크기
  let det = null, rec = null, loading = null;

  const mk = n => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
  const cvDet = mk(DET), cvRef = mk(REF), cvAli = mk(112);
  const cx = c => c.getContext('2d', { willReadFrequently: true });
  const xDet = cx(cvDet), xRef = cx(cvRef), xAli = cx(cvAli);

  function script(src) {
    return new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => no(new Error('파일을 받지 못했어요'));
      document.head.append(s);
    });
  }
  /** 여러 파일을 받으면서 전체 진행률(0~1)을 알려줘요 */
  async function download(onProgress) {
    const frac = {}, keys = Object.keys(FILES), total = keys.reduce((a, k) => a + FILES[k].net, 0);
    const report = () => onProgress(keys.reduce((a, k) => a + FILES[k].net * Math.min(1, frac[k] || 0), 0) / total);
    const one = async k => {
      const res = await fetch(FILES[k].url);
      if (!res.ok) throw new Error(`모델 파일을 받지 못했어요 (${res.status})`);
      if (!res.body || !res.body.getReader) { const b = new Uint8Array(await res.arrayBuffer()); frac[k] = 1; report(); return b; }
      const rd = res.body.getReader(), parts = [];
      let n = 0;
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        parts.push(value); n += value.length; frac[k] = n / FILES[k].raw; report();
      }
      const out = new Uint8Array(n);
      let o = 0;
      for (const p of parts) { out.set(p, o); o += p.length; }
      return out;
    };
    const bufs = await Promise.all(keys.map(one));
    return Object.fromEntries(keys.map((k, i) => [k, bufs[i]]));
  }

  /** 모델 준비 (처음 한 번 약 11MB, 그다음은 브라우저에 보관된 파일 사용) */
  function load(onProgress = () => {}) {
    if (det && rec) return Promise.resolve();
    if (!loading) {
      loading = (async () => {
        const simd = typeof WebAssembly === 'object' && WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
        if (!simd) { const e = new Error('이 브라우저는 얼굴 인식을 지원하지 않아요. 브라우저(또는 iOS)를 최신 버전으로 업데이트해 주세요.'); e.unsupported = true; throw e; }
        const [, buf] = await Promise.all([window.ort ? null : script(ORT + 'ort.wasm.min.js'), download(onProgress)]);
        const ort = window.ort;
        ort.env.logLevel = 'error';
        ort.env.wasm.numThreads = 1;                       // 여러 스레드는 특별한 서버 설정이 필요해서 1개로
        ort.env.wasm.wasmPaths = ORT;
        ort.env.wasm.wasmBinary = buf.wasm;
        const opt = { executionProviders: ['wasm'], graphOptimizationLevel: 'all', logSeverityLevel: 3 };
        det = await ort.InferenceSession.create(buf.det, opt);
        rec = await ort.InferenceSession.create(buf.rec, opt);
        await rec.run({ [rec.inputNames[0]]: new ort.Tensor('float32', new Float32Array(3 * 112 * 112), [1, 3, 112, 112]) });   // 첫 계산 준비
      })();
      loading.catch(() => { loading = null; det = rec = null; });
    }
    return loading;
  }

  /** 캔버스 → 모델 입력 (RGB, (값-mean)/std, 1×3×n×n) */
  function tensor(ctx, n, mean, std) {
    const d = ctx.getImageData(0, 0, n, n).data, m = n * n, f = new Float32Array(3 * m);
    for (let i = 0, j = 0; i < m; i++, j += 4) { f[i] = (d[j] - mean) / std; f[i + m] = (d[j + 1] - mean) / std; f[i + 2 * m] = (d[j + 2] - mean) / std; }
    return new window.ort.Tensor('float32', f, [1, 3, n, n]);
  }

  const area = f => (f.box[2] - f.box[0]) * (f.box[3] - f.box[1]);
  function nms(list, thr = 0.4) {
    list.sort((a, b) => b.score - a.score);
    const keep = [];
    for (const f of list) {
      const ok = keep.every(k => {
        const w = Math.max(0, Math.min(f.box[2], k.box[2]) - Math.max(f.box[0], k.box[0]) + 1);
        const h = Math.max(0, Math.min(f.box[3], k.box[3]) - Math.max(f.box[1], k.box[1]) + 1);
        const A = (b => (b[2] - b[0] + 1) * (b[3] - b[1] + 1));
        return (w * h) / (A(f.box) + A(k.box) - w * h) <= thr;
      });
      if (ok) keep.push(f);
    }
    return keep;
  }

  /** SCRFD 결과 풀기 (보폭 8·16·32, 위치마다 앵커 2개) → 입력 좌표의 얼굴 목록 */
  async function runDet(ctx, n, thresh = 0.5) {
    const out = await det.run({ [det.inputNames[0]]: tensor(ctx, n, 127.5, 128) });
    const o = det.outputNames.map(k => out[k].data);
    const faces = [];
    [8, 16, 32].forEach((st, i) => {
      const sc = o[i], bb = o[i + 3], kp = o[i + 6], gw = n / st;
      for (let k = 0; k < sc.length; k++) {
        if (sc[k] < thresh) continue;
        const loc = k >> 1, ax = (loc % gw) * st, ay = Math.floor(loc / gw) * st;
        const kps = [];
        for (let p = 0; p < 5; p++) kps.push([ax + kp[k * 10 + p * 2] * st, ay + kp[k * 10 + p * 2 + 1] * st]);
        faces.push({ score: sc[k], box: [ax - bb[k * 4] * st, ay - bb[k * 4 + 1] * st, ax + bb[k * 4 + 2] * st, ay + bb[k * 4 + 3] * st], kps });
      }
    });
    return nms(faces);
  }

  const dims = src => [src.videoWidth || src.naturalWidth || src.width, src.videoHeight || src.naturalHeight || src.height];

  /** 화면 전체에서 얼굴 찾기 (insightface 와 같은 방법: 비율 유지 축소 + 오른쪽·아래 검은 여백) → 원래 좌표, 큰 얼굴부터 */
  async function detect(src) {
    const [w, h] = dims(src);
    let nw, nh;
    if (h / w > 1) { nh = DET; nw = Math.floor(DET / (h / w)); } else { nw = DET; nh = Math.floor(DET * (h / w)); }
    const s = nh / h;
    xDet.setTransform(1, 0, 0, 1, 0, 0);
    xDet.fillStyle = '#000'; xDet.fillRect(0, 0, DET, DET);
    xDet.drawImage(src, 0, 0, w, h, 0, 0, nw, nh);
    const faces = await runDet(xDet, DET);
    for (const f of faces) { f.box = f.box.map(v => v / s); f.kps = f.kps.map(([x, y]) => [x / s, y / s]); }
    return faces.sort((a, b) => area(b) - area(a));
  }

  /** 얼굴 주변을 정사각형으로 크게 잘라 다시 검출 → 더 정확한 5점 (원래 좌표) */
  async function refine(src, f) {
    const [x1, y1, x2, y2] = f.box, side = Math.max(x2 - x1, y2 - y1) * 1.6;
    const x0 = (x1 + x2) / 2 - side / 2, y0 = (y1 + y2) / 2 - side / 2, s = REF / side;
    xRef.setTransform(1, 0, 0, 1, 0, 0);
    xRef.fillStyle = '#000'; xRef.fillRect(0, 0, REF, REF);
    xRef.setTransform(s, 0, 0, s, -x0 * s - 0.5 * s + 0.5, -y0 * s - 0.5 * s + 0.5);    // OpenCV warpAffine 과 같은 픽셀 기준
    xRef.drawImage(src, 0, 0);
    xRef.setTransform(1, 0, 0, 1, 0, 0);
    const g = (await runDet(xRef, REF)).sort((a, b) => area(b) - area(a))[0];
    return g ? g.kps.map(([x, y]) => [x / s + x0, y / s + y0]) : f.kps;
  }

  /** 5점 → 표준 5점 닮음 변환 (최소제곱, 복소수 꼴) [a_re, a_im, b_re, b_im] */
  function similarity(kps) {
    let zx = 0, zy = 0, wx = 0, wy = 0;
    for (let i = 0; i < 5; i++) { zx += kps[i][0]; zy += kps[i][1]; wx += DST[i][0]; wy += DST[i][1]; }
    zx /= 5; zy /= 5; wx /= 5; wy /= 5;
    let nr = 0, ni = 0, dd = 0;
    for (let i = 0; i < 5; i++) {
      const ax = kps[i][0] - zx, ay = kps[i][1] - zy, bx = DST[i][0] - wx, by = DST[i][1] - wy;
      nr += bx * ax + by * ay; ni += by * ax - bx * ay; dd += ax * ax + ay * ay;
    }
    const ar = nr / dd, ai = ni / dd;
    return [ar, ai, wx - (ar * zx - ai * zy), wy - (ar * zy + ai * zx)];
  }

  /** 112×112 로 맞춰 자른 얼굴 → 특징값 512개 + 밝기 */
  async function embed(src, kps) {
    const [ar, ai, br, bi] = similarity(kps);
    xAli.setTransform(1, 0, 0, 1, 0, 0);
    xAli.fillStyle = '#000'; xAli.fillRect(0, 0, 112, 112);
    xAli.setTransform(ar, ai, -ai, ar, br - 0.5 * (ar - ai) + 0.5, bi - 0.5 * (ai + ar) + 0.5);
    xAli.drawImage(src, 0, 0);
    xAli.setTransform(1, 0, 0, 1, 0, 0);
    const px = xAli.getImageData(28, 28, 56, 56).data;           // 얼굴 가운데 밝기
    let lum = 0;
    for (let i = 0; i < px.length; i += 4) lum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    lum /= px.length / 4;
    const out = await rec.run({ [rec.inputNames[0]]: tensor(xAli, 112, 127.5, 127.5) });
    const v = Float32Array.from(out[rec.outputNames[0]].data);
    let n = 0;
    for (const x of v) n += x * x;
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= n;
    return { v, lum };
  }

  /** 정면 여부: 좌우(코가 두 눈 가운데서 벗어난 정도) · 기울기 · 위아래 */
  function pose(k) {
    const [le, re, no, lm, rm] = k;
    const ex = re[0] - le[0], ey = re[1] - le[1], ed = Math.hypot(ex, ey) || 1, ux = ex / ed, uy = ey / ed;
    const mx = (le[0] + re[0]) / 2, my = (le[1] + re[1]) / 2;
    const nx = no[0] - mx, ny = no[1] - my;
    const yaw = (nx * ux + ny * uy) / (ed / 2);
    const mouth = ((lm[0] + rm[0]) / 2 - mx) * -uy + ((lm[1] + rm[1]) / 2 - my) * ux;
    const pitch = (nx * -uy + ny * ux) / (mouth || 1);
    return { yaw, roll: Math.atan2(ey, ex) * 180 / Math.PI, pitch };
  }

  /**
   * 지금 화면 한 장 살펴보기 → { problem, box, emb, ... }
   * problem: 'none' 얼굴 없음 · 'many' 여러 명 · 'small' 너무 멀리 · 'edge' 화면 밖 · 'blur' 흐림
   *          'side' 정면 아님 · 'tilt' 기울어짐 · 'dark' 어두움 · null 좋아요(emb 있음)
   */
  async function analyze(src) {
    if (!det) throw new Error('먼저 load() 를 불러 주세요');
    const [w, h] = dims(src);
    if (!w || !h) return { problem: 'none', w, h };
    const faces = await detect(src);
    const f = faces[0];
    if (!f) return { problem: 'none', w, h };
    const r = { w, h, box: f.box, score: f.score, count: faces.length };
    const fw = f.box[2] - f.box[0], fh = f.box[3] - f.box[1];
    if (faces.length > 1 && area(faces[1]) > 0.3 * area(f)) return { ...r, problem: 'many' };
    if (fw < 0.16 * Math.min(w, h) || fw < 56) return { ...r, problem: 'small' };
    if (f.box[0] < -0.08 * fw || f.box[1] < -0.12 * fh || f.box[2] > w + 0.08 * fw || f.box[3] > h + 0.12 * fh) return { ...r, problem: 'edge' };
    if (f.score < 0.6) return { ...r, problem: 'blur' };
    const kps = await refine(src, f);
    const p = pose(kps);
    if (Math.abs(p.roll) > 25) return { ...r, kps, pose: p, problem: 'tilt' };
    if (Math.abs(p.yaw) > 0.5 || p.pitch < 0.3 || p.pitch > 1.0) return { ...r, kps, pose: p, problem: 'side' };
    const e = await embed(src, kps);
    if (e.lum < 45) return { ...r, kps, pose: p, problem: 'dark' };
    return { ...r, kps, pose: p, lum: e.lum, emb: e.v, problem: null };
  }

  /** 여러 장면의 특징값 평균 (서로 너무 다른 장면은 빼요) → { v, n } 또는 null */
  function average(list, keep = 0.6) {
    if (!list.length) return null;
    const mean = vs => {
      const m = new Float32Array(512);
      for (const v of vs) for (let i = 0; i < 512; i++) m[i] += v[i];
      let n = 0; for (const x of m) n += x * x; n = Math.sqrt(n) || 1;
      for (let i = 0; i < 512; i++) m[i] /= n;
      return m;
    };
    const dot = (a, b) => { let s = 0; for (let i = 0; i < 512; i++) s += a[i] * b[i]; return s; };
    let m = mean(list);
    const good = list.filter(v => dot(v, m) >= keep);
    if (good.length < Math.ceil(list.length * 0.6)) return null;
    m = mean(good);
    return { v: m, n: good.length };
  }
  /** 서버로 보낼 모양 (소수 5자리 숫자 배열) */
  const pack = v => Array.from(v, x => Math.round(x * 1e5) / 1e5);

  return { load, ready: () => !!(det && rec), analyze, detect, refine, embed, similarity, pose, average, pack };
})();
