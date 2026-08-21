-- ============================================================
-- 回执写入改走 RPC（2026-08-21 修「再填一份不显示」）
-- 在 Supabase 的 SQL Editor 里整段粘贴并运行一次即可
-- 效果：
--   ① insert_rsvp：按 edit_token 幂等写入（upsert）并返回行 id
--      同 token 再提交 = 更新原行（修改回执）；新 token = 新增一行（再填一份）
--      匿名直插拿不到 id（anon 无 select 策略），走 RPC 才能把 id 回传给宾客
--   ② rsvp_wall：宾客墙上限 60 → 200，保证全部出席头像都显示
-- （重复运行安全：create or replace / if not exists）
-- ============================================================

-- ① 回执写入/更新 RPC：返回该行 id（中继用它回传给前端）
create or replace function public.insert_rsvp(
  p_guest_id bigint,
  p_name text,
  p_phone text,
  p_attending boolean,
  p_guest_count int,
  p_message text,
  p_needs_accommodation text,
  p_check_in_at text,
  p_check_out_at text,
  p_edit_token text
)
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into public.rsvp
    (guest_id, name, phone, attending, guest_count, message,
     needs_accommodation, check_in_at, check_out_at, edit_token)
  values
    (p_guest_id, p_name, p_phone, p_attending, p_guest_count, p_message,
     p_needs_accommodation, p_check_in_at, p_check_out_at, p_edit_token)
  on conflict (edit_token) where edit_token is not null
  do update set
    guest_id = excluded.guest_id,
    name = excluded.name,
    phone = excluded.phone,
    attending = excluded.attending,
    guest_count = excluded.guest_count,
    message = excluded.message,
    needs_accommodation = excluded.needs_accommodation,
    check_in_at = excluded.check_in_at,
    check_out_at = excluded.check_out_at
  returning id
$$;

grant execute on function public.insert_rsvp(bigint, text, text, boolean, int, text, text, text, text, text) to anon, authenticated;

-- ② 宾客墙上限提到 200（原来 60，超了就不显示）
create or replace function public.rsvp_wall()
returns table(id bigint, name text, guest_count int, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select id, name, guest_count, created_at
  from public.rsvp
  where attending = true
  order by created_at asc
  limit 200
$$;

grant execute on function public.rsvp_wall() to anon, authenticated;
