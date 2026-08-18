-- ============================================================
-- ⑧ 访问统计：谁打开了请柬（每打开一次记一条）
--
-- 使用：在 Supabase 左侧 SQL Editor → New query，
--       把本文件整段复制粘贴进去 → Run（可重复运行，不会报错）
-- ============================================================

create table if not exists public.visits (
  id bigint generated always as identity primary key,
  guest_id bigint,                       -- 专属链接打开时记录对应嘉宾，普通链接为 null
  created_at timestamptz not null default now()
);
create index if not exists visits_created_idx on public.visits (created_at);
alter table public.visits enable row level security;

-- 匿名记数走 RPC（安全函数），不开放直接 insert
create or replace function public.log_visit(p_guest bigint default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visits (guest_id) values (p_guest)
$$;

grant execute on function public.log_visit(bigint) to anon, authenticated;

-- 看板统计：总访问 / 近 24 小时 / 打开过专属请柬的嘉宾数
create or replace function public.visit_stats()
returns table(total bigint, recent24h bigint, opened_guests bigint)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.visits),
    (select count(*) from public.visits where created_at >= now() - interval '24 hours'),
    (select count(distinct guest_id) from public.visits where guest_id is not null)
$$;

grant execute on function public.visit_stats() to authenticated;

-- 管理员可在编辑器看板查看统计
drop policy if exists "管理员可看访问统计" on public.visits;
create policy "管理员可看访问统计" on public.visits
  for select to authenticated using (true);

-- ============================================================
-- 附带修复：回执「不参加」提交失败
-- 旧库 rsvp 约束要求 guest_count 在 1~20，缺席提交 0 会被拒绝。
-- 这里放宽到 0~20（前端也已改成缺席存 1，双保险）。
-- ============================================================
alter table public.rsvp drop constraint if exists rsvp_guest_count_check;
alter table public.rsvp add constraint rsvp_guest_count_check check (guest_count between 0 and 20);

-- 已登录用户（如浏览器同时登录过编辑器）提交回执也放行
drop policy if exists "已登录也可提交回执" on public.rsvp;
create policy "已登录也可提交回执" on public.rsvp
  for insert to authenticated with check (true);
