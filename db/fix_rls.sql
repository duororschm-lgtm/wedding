-- ============================================================
-- 婚礼请柬 · 修复回执/种花提交（在 Supabase 的 SQL Editor 里粘贴运行一次即可）
-- 问题：线上 rsvp / garden 表开了 RLS 但没有匿名写入策略（42501），
--       宾客提交回执、种花一直被拒——init.sql 里的策略没在线上生效。
-- 本次修复：补匿名插入策略 + 给回执加 edit_token 唯一索引
--          （服务器中转重放靠它幂等：重复投递自动合并，不产生重复行）
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rsvp' and policyname = '宾客可提交回执'
  ) then
    create policy "宾客可提交回执" on public.rsvp
      for insert to anon with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'garden' and policyname = '宾客可种花'
  ) then
    create policy "宾客可种花" on public.garden
      for insert to anon with check (true);
  end if;
end $$;

-- 回执编辑凭证唯一索引（部分索引：旧行 edit_token 为 NULL 不受影响）
create unique index if not exists rsvp_edit_token_key
  on public.rsvp (edit_token)
  where edit_token is not null;
