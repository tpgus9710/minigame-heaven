/* =====================================================================
 *  🔄 새 버전으로 갈아타기 (서버: lib/handoff.js)
 *   server:drain  새 버전이 준비됐어요 → 게임 중이면 위쪽에 안내 (이 판이 끝나면 같은 방 그대로 옮겨요)
 *   server:move   옮길 차례 → 이사 표를 이 탭에 맡기고 새로 고침 → 새 서버에서 같은 방으로 (room:rejoin)
 *                 싱글 게임 중이거나 계정 창이 열려 있으면 끝난 뒤에 옮겨요
 * ===================================================================== */
const Mover = {
  pending: null, moving: false,
  banner(html) {
    let el = document.getElementById('mover');
    if (!el) { el = document.createElement('div'); el.id = 'mover'; el.setAttribute('role', 'status'); document.body.append(el); }
    el.innerHTML = `<i></i><span>${html}</span>`;
    el.classList.add('show');
  },
  hide() { const el = document.getElementById('mover'); if (el) el.classList.remove('show'); },
  /** 지금 새로 고치면 곤란한가요? (싱글 게임 중 · 계정 창 · 방에서 게임 중) */
  busy() {
    const gaming = document.body.classList.contains('gaming');
    return (!!S.solo && gaming) || (!!S.code && !!S.room && S.room.isStarted && gaming) || (typeof Acct !== 'undefined' && !!Acct.ui.view);
  },
  go(d) {
    if (this.moving) return;
    if (!d.ticket && this.busy()) {                     // 방 밖: 하던 걸 끝낸 뒤에
      this.pending = d;
      this.banner('🔄 새 버전이 준비됐어요 · 지금 하는 게임이 끝나면 새로 고칠게요');
      return;
    }
    this.moving = true; this.pending = null;
    try {
      sessionStorage.removeItem('mgRecover');           // 옛 서버 자리로 돌아가려 하지 않게 (js/core.js)
      if (d.ticket) sessionStorage.setItem('mgMove', JSON.stringify({ t: Date.now(), ticket: d.ticket, code: d.code || '' }));
    } catch { /* 보관함을 못 쓰면 방 코드로 다시 들어와요 */ }
    this.banner(d.ticket ? `🔄 새 버전으로 옮기는 중… <small>방 ${esc(d.code || '')} 그대로</small>` : '🔄 새 버전으로 바꾸는 중…');
    setTimeout(() => location.replace(location.pathname), 400);
  },
};
socket.on('server:drain', () => {
  if (Mover.moving) return;
  if (S.code && S.room && S.room.isStarted) Mover.banner('🔄 새 버전 준비 완료 · 이 판이 끝나면 같은 방 그대로 옮겨요');
});
socket.on('server:move', d => Mover.go(d || {}));
setInterval(() => { if (Mover.pending && !Mover.busy()) Mover.go(Mover.pending); }, 1500);
/* 새로 고친 뒤: 이사 표가 있으면 새 서버에서 같은 방으로 (계정 인사가 끝난 다음에) */
(() => {
  let mv = null;
  try { mv = JSON.parse(sessionStorage.getItem('mgMove') || 'null'); sessionStorage.removeItem('mgMove'); } catch { /* 무시 */ }
  if (!mv || !mv.ticket || Date.now() - mv.t > 120000) return;
  Mover.banner(`🔄 새 버전에서 방 ${esc(mv.code || '')}으로 돌아가는 중…`);
  const send = async () => {
    socket.off('connect', send);
    try { if (typeof Acct !== 'undefined') await (Acct.helloP || Acct.hello()); } catch { /* 손님으로 */ }
    socket.emit('room:rejoin', { ticket: mv.ticket });
  };
  if (socket.connected) send(); else socket.on('connect', send);
})();
socket.on('server:rejoined', d => {
  Mover.hide();
  if (d && d.ok) toast('🔄 새 버전으로 옮겨 왔어요! 같은 방이에요.', 'good');
  else toast(d && d.why === 'started' ? '방이 벌써 새 게임을 시작했어요. 끝나면 방 코드로 들어와 주세요.'
    : d && d.why === 'full' ? '방이 가득 찼어요. 방 코드로 다시 들어가 주세요.' : '예전 방으로 돌아가지 못했어요. 방 코드로 다시 들어가 주세요.', 'error');
});
