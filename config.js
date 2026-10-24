/*
  공유 게시판 저장소 연결
  ─────────────────────
  ① 수파베이스(우선): SUPABASE_URL 과 SUPABASE_KEY(Publishable key 또는 anon key)를 넣으면 수파베이스에 저장돼요.
     표·함수는 supabase/schema.sql 을 수파베이스 SQL Editor에서 한 번 실행해 만들어요.
  ② 구글 Apps Script(예비): 수파베이스 칸이 비어 있으면 BOARD_API_URL(구글 시트)로 저장돼요.
  둘 다 비워 두면 게시판은 '미리보기 모드'(그 기기 안에만 저장)로 동작해요.
  ※ 이 파일을 바꾸면 index.html 의 config.js?v= 숫자도 바꿔 주세요(브라우저 캐시 때문).
*/
window.SUPABASE_URL = "";
window.SUPABASE_KEY = "";
window.BOARD_API_URL = "https://script.google.com/macros/s/AKfycbwnni1wMLqWC9gYcLuSOo1CDn6F94eQj4XeIH1dEBWRrtxYXmVrwaXCGC5sj92gvyio/exec";
