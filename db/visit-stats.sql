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
