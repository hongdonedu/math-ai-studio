-- 수학 AI 스튜디오 — 공유 게시판 저장소 (Supabase)
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여 넣고 Run.
-- 표(posts, comments, app_settings)는 직접 읽고 쓸 수 없게 막아 두고,
-- 사이트는 아래 board_* 함수(RPC)로만 읽고 쓴다. (욕설 거르기·선생님 비밀번호 확인을 서버에서 함)

create extension if not exists pgcrypto;

create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
insert into public.app_settings (key, value) values ('teacher_key', '2022')
  on conflict (key) do nothing;          -- 선생님 비밀번호: Table Editor → app_settings 에서 바꿀 수 있음

create table if not exists public.posts (
  id         text primary key,
  created_at timestamptz not null default now(),
  name       text not null default '',
  title      text not null default '',
  unit       text not null default '',
  ptype      text not null default '',
  descr      text not null default '',
  url        text not null default '',
  color      text not null default 'violet',
  likes      integer not null default 0,
  wows       integer not null default 0,
  hidden     boolean not null default false,
  cls        text not null default ''
);

create table if not exists public.comments (
  id         text primary key,
  post_id    text not null,
  created_at timestamptz not null default now(),
  name       text not null default '',
  kind       text not null default 'good',
  body       text not null default '',
  hidden     boolean not null default false
);
create index if not exists comments_post_id_idx on public.comments (post_id);

alter table public.app_settings enable row level security;
alter table public.posts        enable row level security;
alter table public.comments     enable row level security;
revoke all on public.app_settings, public.posts, public.comments from anon, authenticated;

/* ---------- 도우미 ---------- */
create or replace function public.board_clean(s text, n int) returns text
language sql immutable set search_path = public as $$
  select left(btrim(regexp_replace(regexp_replace(coalesce(s, ''), '[<>]', '', 'g'), '\s+', ' ', 'g')), n)
$$;

create or replace function public.board_bad(s text) returns boolean
language sql immutable set search_path = public as $$
  select exists (
    select 1
    from unnest(array['바보','멍청','죽어','꺼져','병신','시발','씨발','ㅅㅂ','ㅂㅅ','개새','존나','좆','지랄','닥쳐','찐따','애미','느금']) as w
    where position(w in regexp_replace(coalesce(s, ''), '\s', '', 'g')) > 0
  )
$$;

create or replace function public.board_is_teacher(k text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(k is not null and k = (select value from public.app_settings where key = 'teacher_key'), false)
$$;

/* ---------- 읽기 ---------- */
create or replace function public.board_list(p_key text default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  t boolean := public.board_is_teacher(p_key);
begin
  return json_build_object(
    'ok', true,
    'teacher', t,
    'now', now(),
    'posts', coalesce((
      select json_agg(json_build_object(
        'id', p.id, 'time', p.created_at, 'name', p.name, 'title', p.title, 'unit', p.unit,
        'type', p.ptype, 'desc', p.descr, 'url', p.url, 'color', p.color,
        'likes', p.likes, 'wows', p.wows, 'hidden', p.hidden, 'cls', p.cls
      ) order by p.created_at desc)
      from public.posts p where t or not p.hidden), '[]'::json),
    'comments', coalesce((
      select json_agg(json_build_object(
        'id', c.id, 'postId', c.post_id, 'time', c.created_at, 'name', c.name,
        'kind', c.kind, 'text', c.body, 'hidden', c.hidden
      ) order by c.created_at)
      from public.comments c where t or not c.hidden), '[]'::json)
  );
end $$;

/* ---------- 쓰기 ---------- */
create or replace function public.board_add_post(
  p_name text, p_title text, p_url text,
  p_unit text default '', p_type text default '', p_desc text default '',
  p_color text default 'violet', p_cls text default ''
) returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  v_name  text := public.board_clean(p_name, 12);
  v_title text := public.board_clean(p_title, 30);
  v_desc  text := public.board_clean(p_desc, 120);
  v_url   text := left(btrim(coalesce(p_url, '')), 400);
  v_id    text;
begin
  if v_name = '' or v_title = '' then
    return json_build_object('ok', false, 'error', '이름과 프로그램 이름을 써 주세요.');
  end if;
  if v_url !~* '^https://[^\s<>"'']+$' then
    return json_build_object('ok', false, 'error', '링크는 https:// 로 시작해야 해요. 캔바에서 복사한 주소를 그대로 붙여 넣어 주세요.');
  end if;
  if public.board_bad(v_name || v_title || v_desc) then
    return json_build_object('ok', false, 'error', '고운 말로 다시 써 주세요.');
  end if;
  v_id := 'p' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  insert into public.posts (id, name, title, unit, ptype, descr, url, color, cls)
  values (v_id, v_name, v_title, public.board_clean(p_unit, 20), public.board_clean(p_type, 20), v_desc, v_url,
          coalesce(nullif(public.board_clean(p_color, 20), ''), 'violet'), public.board_clean(p_cls, 10));
  return json_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.board_add_comment(
  p_post_id text, p_name text, p_text text, p_kind text default 'good'
) returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  v_name text := public.board_clean(p_name, 12);
  v_text text := public.board_clean(p_text, 200);
  v_post text := public.board_clean(p_post_id, 20);
  v_kind text := case when p_kind in ('good', 'wow', 'idea') then p_kind else 'good' end;
  v_id   text;
begin
  if v_name = '' or v_text = '' or v_post = '' then
    return json_build_object('ok', false, 'error', '이름과 남길 말을 써 주세요.');
  end if;
  if public.board_bad(v_name || v_text) then
    return json_build_object('ok', false, 'error', '고운 말로 다시 써 주세요.');
  end if;
  v_id := 'c' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  insert into public.comments (id, post_id, name, kind, body) values (v_id, v_post, v_name, v_kind, v_text);
  return json_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.board_react(p_post_id text, p_kind text default 'like') returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  v int;
begin
  if p_kind = 'wow' then
    update public.posts set wows = wows + 1 where id = p_post_id returning wows into v;
  else
    update public.posts set likes = likes + 1 where id = p_post_id returning likes into v;
  end if;
  if v is not null then
    return json_build_object('ok', true, 'value', v);
  end if;
  -- 선생님 예시 작품(ex-…)은 처음 반응이 올 때 줄을 만든다
  if p_post_id ~ '^ex-[a-z]+$' then
    insert into public.posts (id, name, title, likes, wows)
    values (p_post_id, '선생님 예시', p_post_id,
            case when p_kind = 'wow' then 0 else 1 end,
            case when p_kind = 'wow' then 1 else 0 end)
    on conflict (id) do update set
      likes = public.posts.likes + case when p_kind = 'wow' then 0 else 1 end,
      wows  = public.posts.wows  + case when p_kind = 'wow' then 1 else 0 end;
    return json_build_object('ok', true, 'value', 1);
  end if;
  return json_build_object('ok', false, 'error', '작품을 찾을 수 없어요.');
end $$;

create or replace function public.board_set_hidden(
  p_key text, p_target text, p_id text, p_hidden boolean
) returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  n int;
begin
  if not public.board_is_teacher(p_key) then
    return json_build_object('ok', false, 'error', '선생님 비밀번호가 맞지 않아요.');
  end if;
  if p_target = 'comment' then
    update public.comments set hidden = coalesce(p_hidden, false) where id = p_id;
  else
    update public.posts set hidden = coalesce(p_hidden, false) where id = p_id;
  end if;
  get diagnostics n = row_count;
  if n = 0 then
    return json_build_object('ok', false, 'error', '찾을 수 없어요.');
  end if;
  return json_build_object('ok', true);
end $$;

/* ---------- 권한: 사이트(anon)는 board_* 함수만 부를 수 있다 ---------- */
revoke execute on function public.board_clean(text, int)   from public, anon, authenticated;
revoke execute on function public.board_bad(text)          from public, anon, authenticated;
revoke execute on function public.board_is_teacher(text)   from public, anon, authenticated;
revoke execute on function public.board_list(text) from public;
revoke execute on function public.board_add_post(text, text, text, text, text, text, text, text) from public;
revoke execute on function public.board_add_comment(text, text, text, text) from public;
revoke execute on function public.board_react(text, text) from public;
revoke execute on function public.board_set_hidden(text, text, text, boolean) from public;
grant execute on function public.board_list(text) to anon, authenticated;
grant execute on function public.board_add_post(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.board_add_comment(text, text, text, text) to anon, authenticated;
grant execute on function public.board_react(text, text) to anon, authenticated;
grant execute on function public.board_set_hidden(text, text, text, boolean) to anon, authenticated;
