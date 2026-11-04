/**
 * 방탈출 「억울한 피의자를 구하라」 실시간 대시보드 서버 (구글 앱스크립트) — 2026-11-04 오태식
 *
 * 배포 방법 (한 번만):
 *  1) https://script.google.com → 새 프로젝트 → 이 파일 내용을 통째로 붙여 넣기 → 저장
 *  2) 오른쪽 위 [배포] → [새 배포] → 유형 ⚙️ [웹 앱]
 *     - 실행 사용자: 나 / 액세스 권한: 모든 사용자  → [배포] → 권한 허용
 *  3) 나온 '웹 앱 URL'(https://script.google.com/macros/s/…/exec)을 오태식에게 알려 주기
 *
 * 저장: 스크립트 속성(작은 JSON 하나). 반을 새로 시작하면 이전 반 기록은 지워진다.
 * 선생님 설정은 처음 정한 비밀번호(PIN)로만 바꿀 수 있다.
 */

const MAX_TEAMS = 20;

function readState_() {
  const raw = PropertiesService.getScriptProperties().getProperty('state');
  return raw ? JSON.parse(raw) : { session: '', cls: '', teams: [], limitMin: 25, start: 0, progress: {} };
}
function writeState_(s) { PropertiesService.getScriptProperties().setProperty('state', JSON.stringify(s)); }
function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  const a = (e && e.parameter && e.parameter.a) || 'board';
  const s = readState_();
  if (a === 'config') return out_({ ok: true, session: s.session, cls: s.cls, teams: s.teams, limitMin: s.limitMin, start: s.start });
  return out_({ ok: true, session: s.session, cls: s.cls, teams: s.teams, limitMin: s.limitMin, start: s.start, progress: s.progress, now: Date.now() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // 여러 모둠이 동시에 풀어도 기록이 덮어써지지 않게
  try {
    const b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const props = PropertiesService.getScriptProperties();
    const s = readState_();

    if (b.a === 'setup') {
      const pin = String(b.pin || '');
      const saved = props.getProperty('pin');
      if (!pin) return out_({ ok: false, error: '비밀번호를 입력하세요' });
      if (saved && saved !== pin) return out_({ ok: false, error: '비밀번호가 다릅니다' });
      if (!saved) props.setProperty('pin', pin); // 처음 정한 비밀번호가 선생님 비밀번호
      const teams = (b.teams || []).map(String).map((t) => t.trim()).filter(Boolean).slice(0, MAX_TEAMS);
      if (!teams.length) return out_({ ok: false, error: '모둠을 1개 이상 입력하세요' });
      const next = { session: String(Date.now()), cls: String(b.cls || '').slice(0, 30), teams: teams, limitMin: Math.max(5, Math.min(120, Number(b.limitMin) || 25)), start: b.startNow ? Date.now() : 0, progress: {} };
      teams.forEach((t) => { next.progress[t] = { solved: {}, hints: 0, wrong: 0, final: 0 }; });
      writeState_(next);
      return out_({ ok: true, session: next.session });
    }

    if (b.a === 'start') { // 선생님이 '지금 시작'을 누른 시각부터 시간을 잰다
      if (props.getProperty('pin') !== String(b.pin || '')) return out_({ ok: false, error: '비밀번호가 다릅니다' });
      s.start = Date.now(); writeState_(s); return out_({ ok: true, start: s.start });
    }

    if (b.a === 'event') {
      if (b.session !== s.session) return out_({ ok: false, error: 'old-session' }); // 지난 반의 기기
      const p = s.progress[b.team];
      if (!p) return out_({ ok: false, error: 'no-team' });
      const now = Date.now();
      if (b.type === 'solve') { const q = Number(b.qr); if (q >= 1 && q <= 10 && !p.solved[q]) p.solved[q] = now; }
      if (b.type === 'hint') p.hints += 1;
      if (b.type === 'wrong') p.wrong += 1;
      if (b.type === 'final' && !p.final && Object.keys(p.solved).length >= 10) p.final = now;
      writeState_(s);
      return out_({ ok: true, progress: p });
    }
    return out_({ ok: false, error: 'unknown' });
  } finally {
    lock.releaseLock();
  }
}
