-- Bkkari Admin V18.1 — additional admin accounts
create extension if not exists pgcrypto;
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null unique,
  name text not null default 'مشرف',
  role text not null default 'admin' check (role in ('owner','admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.admin_users(email,name,role,is_active) values ('ibrahimbkkari51@gmail.com','المالك','owner',true) on conflict(email) do update set role='owner',is_active=true;
alter table public.admin_users enable row level security;
create or replace function public.is_admin() returns boolean language sql security definer set search_path=public stable as $$ select exists(select 1 from public.admin_users a where lower(a.email)=lower(auth.jwt()->>'email') and a.is_active=true); $$;
drop policy if exists admin_users_select on public.admin_users;
drop policy if exists admin_users_write on public.admin_users;
create policy admin_users_select on public.admin_users for select to authenticated using (public.is_admin());
create policy admin_users_write on public.admin_users for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.admin_users from anon;
grant select,insert,update,delete on public.admin_users to authenticated;
