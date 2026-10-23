/**
 * 수학 AI 스튜디오 — 공유 게시판 저장소 (Google Apps Script)
 *
 * 설치 (3분)
 * 1. 게시판 구글 시트를 연다 → 메뉴 [확장 프로그램] → [Apps Script]
 * 2. 원래 있던 코드를 모두 지우고 이 파일 내용을 통째로 붙여 넣는다 → 저장(디스크 아이콘)
 * 3. 오른쪽 위 [배포] → [새 배포] → 톱니바퀴에서 [웹 앱]
 *      실행 사용자: 나   /   액세스 권한이 있는 사용자: 모든 사용자
 *    → [배포] → 권한 승인(내 계정 선택 → 고급 → 이동 → 허용)
 * 4. 나오는 '웹 앱 URL'(https://script.google.com/macros/s/.../exec)을 복사해
 *    사이트의 config.js 안 BOARD_API_URL 따옴표 사이에 붙여 넣는다.
 *
 * 코드를 고친 뒤에는 [배포] → [배포 관리] → 연필 → 버전: 새 버전 → [배포] 해야 반영된다.
 */

const TEACHER_KEY = '2022';            // 선생님 모드 비밀번호 (사이트의 선생님 메뉴와 같게)
const LIMIT = { name: 12, title: 30, desc: 120, text: 200, url: 400 };
const BLOCKED = ['바보', '멍청', '죽어', '꺼져', '병신', '시발', '씨발', 'ㅅㅂ', 'ㅂㅅ', '개새', '존나', '좆', '지랄', '닥쳐', '찐따', '애미', '느금'];
const POST_HEAD = ['id', 'time', 'name', 'title', 'unit', 'type', 'desc', 'url', 'color', 'likes', 'wows', 'hidden', 'cls'];
const COMMENT_HEAD = ['id', 'postId', 'time', 'name', 'kind', 'text', 'hidden'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'ping') return out({ ok: true, time: new Date().toISOString() });
  return out(listAll(p.key === TEACHER_KEY));
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: '보낸 내용을 읽을 수 없어요.' }); }
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (err) { return out({ ok: false, error: '사람이 많아요. 잠시 뒤 다시 눌러 주세요.' }); }
  try {
    switch (body.action) {
      case 'post':    return out(addPost(body));
      case 'comment': return out(addComment(body));
      case 'react':   return out(react(body));
      case 'hide':    return out(setHidden(body));
      default:        return out({ ok: false, error: '알 수 없는 요청이에요.' });
    }
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 읽기 ---------- */
function listAll(isTeacher) {
  const posts = rows('posts', POST_HEAD).filter(r => r.id && (isTeacher || !truthy(r.hidden))).map(r => ({
    id: String(r.id), time: iso(r.time), name: String(r.name), title: String(r.title), unit: String(r.unit),
    type: String(r.type), desc: String(r.desc), url: String(r.url), color: String(r.color),
    likes: Number(r.likes) || 0, wows: Number(r.wows) || 0, hidden: truthy(r.hidden), cls: String(r.cls || '')
  }));
  const comments = rows('comments', COMMENT_HEAD).filter(r => r.id && (isTeacher || !truthy(r.hidden))).map(r => ({
    id: String(r.id), postId: String(r.postId), time: iso(r.time), name: String(r.name),
    kind: String(r.kind), text: String(r.text), hidden: truthy(r.hidden)
  }));
  posts.sort((a, b) => (a.time < b.time ? 1 : -1));
  comments.sort((a, b) => (a.time > b.time ? 1 : -1));
  return { ok: true, posts: posts, comments: comments, teacher: !!isTeacher, now: new Date().toISOString() };
}

/* ---------- 쓰기 ---------- */
function addPost(b) {
  const name = clean(b.name, LIMIT.name), title = clean(b.title, LIMIT.title), desc = clean(b.desc, LIMIT.desc);
  const url = String(b.url || '').trim().slice(0, LIMIT.url);
  if (!name || !title) return { ok: false, error: '이름과 프로그램 이름을 써 주세요.' };
  if (!/^https:\/\/[^\s<>"']+$/i.test(url)) return { ok: false, error: '링크는 https:// 로 시작해야 해요. 캔바에서 복사한 주소를 그대로 붙여 넣어 주세요.' };
  if (bad(name + title + desc)) return { ok: false, error: '고운 말로 다시 써 주세요.' };
  const id = 'p' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  sheet('posts', POST_HEAD).appendRow([id, new Date().toISOString(), name, title, clean(b.unit, 20), clean(b.type, 20), desc, url, clean(b.color, 20), 0, 0, false, clean(b.cls, 10)]);
  return { ok: true, id: id };
}

function addComment(b) {
  const name = clean(b.name, LIMIT.name), text = clean(b.text, LIMIT.text), postId = clean(b.postId, 20);
  const kind = ['good', 'wow', 'idea'].indexOf(b.kind) >= 0 ? b.kind : 'good';
  if (!name || !text || !postId) return { ok: false, error: '이름과 남길 말을 써 주세요.' };
  if (bad(name + text)) return { ok: false, error: '고운 말로 다시 써 주세요.' };
  const id = 'c' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  sheet('comments', COMMENT_HEAD).appendRow([id, postId, new Date().toISOString(), name, kind, text, false]);
  return { ok: true, id: id };
}

function react(b) {
  const col = b.kind === 'wow' ? 'wows' : 'likes';
  const sh = sheet('posts', POST_HEAD);
  const data = sh.getDataRange().getValues();
  const head = data[0], idCol = head.indexOf('id'), c = head.indexOf(col);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(b.postId)) {
      const v = (Number(data[i][c]) || 0) + 1;
      sh.getRange(i + 1, c + 1).setValue(v);
      return { ok: true, value: v };
    }
  }
  // 선생님 예시 작품(ex-…)은 처음 반응이 올 때 줄을 만든다
  if (/^ex-[a-z]+$/.test(String(b.postId))) {
    const row = POST_HEAD.map(k => k === 'id' ? String(b.postId) : k === 'name' ? '선생님 예시' : k === 'title' ? String(b.postId) : (k === 'likes' || k === 'wows') ? 0 : k === 'hidden' ? false : '');
    row[POST_HEAD.indexOf(col)] = 1;
    sh.appendRow(row);
    return { ok: true, value: 1 };
  }
  return { ok: false, error: '작품을 찾을 수 없어요.' };
}

function setHidden(b) {
  if (b.key !== TEACHER_KEY) return { ok: false, error: '선생님 비밀번호가 맞지 않아요.' };
  const isComment = b.target === 'comment';
  const sh = isComment ? sheet('comments', COMMENT_HEAD) : sheet('posts', POST_HEAD);
  const data = sh.getDataRange().getValues();
  const head = data[0], idCol = head.indexOf('id'), hCol = head.indexOf('hidden');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(b.id)) {
      sh.getRange(i + 1, hCol + 1).setValue(!!b.hidden);
      return { ok: true };
    }
  }
  return { ok: false, error: '찾을 수 없어요.' };
}

/* ---------- 도우미 ---------- */
function sheet(name, head) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
function rows(name, head) {
  const values = sheet(name, head).getDataRange().getValues();
  const h = values.shift() || [];
  return values.map(v => { const o = {}; h.forEach((k, i) => o[k] = v[i]); return o; });
}
function clean(s, n) { return String(s == null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); }
function bad(s) { const t = String(s).replace(/\s/g, ''); return BLOCKED.some(w => t.indexOf(w) >= 0); }
function truthy(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function iso(v) { return v instanceof Date ? v.toISOString() : String(v || ''); }
function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
