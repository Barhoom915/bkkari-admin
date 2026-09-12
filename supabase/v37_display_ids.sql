-- Bkkari Tech V37: clean customer/order/payment display numbers.
-- IMPORTANT: Supabase Auth UUIDs are never changed. These are separate friendly IDs.

create table if not exists public.customer_numbers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_number bigint generated always as identity unique,
  created_at timestamptz not null default now()
);

alter table public.customer_numbers enable row level security;
drop policy if exists "users read own customer number" on public.customer_numbers;
create policy "users read own customer number"
on public.customer_numbers for select to authenticated
using (user_id = auth.uid());

create or replace function public.assign_customer_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customer_numbers(user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_customer_number on auth.users;
create trigger on_auth_user_customer_number
after insert on auth.users
for each row execute function public.assign_customer_number();

-- Backfill existing accounts in creation order. Existing UUIDs remain untouched.
insert into public.customer_numbers(user_id)
select id from auth.users u
where not exists (select 1 from public.customer_numbers c where c.user_id=u.id)
order by u.created_at, u.id;

create or replace function public.get_customer_number(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare n bigint;
begin
  insert into public.customer_numbers(user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  select customer_number into n from public.customer_numbers where user_id=p_user_id;
  return n;
end;
$$;
grant execute on function public.get_customer_number(uuid) to authenticated;

-- Sequential normal orders: BK-0001, BK-0002, ...
create table if not exists public.order_number_sequence (
  id boolean primary key default true check (id),
  last_number bigint not null default 0
);
insert into public.order_number_sequence(id,last_number)
values(true, coalesce((select count(*) from public.orders),0))
on conflict (id) do nothing;

create or replace function public.next_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n bigint;
begin
  update public.order_number_sequence
  set last_number=last_number+1
  where id=true
  returning last_number into n;
  return 'BK-' || lpad(n::text,4,'0');
end;
$$;

-- Sequential digital/service orders: SF-0001, SF-0002, ...
create table if not exists public.digital_order_number_sequence (
  id boolean primary key default true check (id),
  last_number bigint not null default 0
);
insert into public.digital_order_number_sequence(id,last_number)
values(true, coalesce((select count(*) from public.digital_service_orders),0))
on conflict (id) do nothing;

create or replace function public.next_digital_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n bigint;
begin
  update public.digital_order_number_sequence
  set last_number=last_number+1
  where id=true
  returning last_number into n;
  return 'SF-' || lpad(n::text,4,'0');
end;
$$;

-- Replace the wallet checkout function so the database, not the browser,
-- owns the order sequence. The incoming p_order_number is kept for API compatibility.
create or replace function public.create_order_with_wallet(
  p_order_number text,
  p_customer_name text,
  p_customer_phone text,
  p_governorate text,
  p_city_area text,
  p_address_details text,
  p_items jsonb,
  p_subtotal numeric,
  p_shipping_cost numeric,
  p_total numeric,
  p_payment_method text
)
returns table(ok boolean, message text, order_id bigint, order_number text, new_balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_balance numeric := 0;
  created_id bigint;
  generated_number text;
begin
  if uid is null then return query select false,'يجب تسجيل الدخول أولاً',null::bigint,null::text,0::numeric; return; end if;
  if p_payment_method not in ('wallet','cash') then return query select false,'طريقة الدفع غير مدعومة',null::bigint,null::text,0::numeric; return; end if;
  if p_total < 0 or p_subtotal < 0 or p_shipping_cost < 0 then return query select false,'قيمة الطلب غير صحيحة',null::bigint,null::text,0::numeric; return; end if;
  generated_number := public.next_order_number();
  if p_payment_method='wallet' then
    select balance into current_balance from wallets where user_id=uid for update;
    current_balance:=coalesce(current_balance,0);
    if current_balance < p_total then return query select false,'رصيد المحفظة غير كافي',null::bigint,null::text,current_balance; return; end if;
  else
    current_balance:=coalesce((select balance from wallets where user_id=uid),0);
  end if;
  insert into orders(order_number,user_id,customer_name,customer_phone,governorate,city_area,address_details,items,subtotal,shipping_cost,total,status,payment_method)
  values(generated_number,uid,p_customer_name,p_customer_phone,p_governorate,p_city_area,p_address_details,coalesce(p_items,'[]'::jsonb),p_subtotal,p_shipping_cost,p_total,'طلب جديد',p_payment_method)
  returning id into created_id;
  if p_payment_method='wallet' and p_total>0 then
    update wallets set balance=balance-p_total,updated_at=now() where user_id=uid;
    insert into wallet_transactions(user_id,amount,type,status,reference) values(uid,-p_total,'purchase','completed',generated_number);
    select balance into current_balance from wallets where user_id=uid;
  end if;
  return query select true,'تم إنشاء الطلب بنجاح',created_id,generated_number,coalesce(current_balance,0);
exception when unique_violation then
  return query select false,'تعذر إنشاء رقم طلب فريد، جرّب مرة ثانية',null::bigint,null::text,coalesce(current_balance,0);
end;
$$;
grant execute on function public.create_order_with_wallet(text,text,text,text,text,text,jsonb,numeric,numeric,numeric,text) to authenticated;
