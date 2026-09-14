-- BKKARI TECH MASTER V3
-- Run AFTER MASTER_V2.sql
-- Adds: editable public content, rewards points, referrals, safe order rewards.

-- ---------- Explicit laptop offer flag ----------
alter table laptops add column if not exists is_offer boolean not null default false;

-- ---------- Reward accounts ----------
create table if not exists customer_rewards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  referral_code text not null unique,
  referred_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reward_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null,
  type text not null,
  reference text,
  note text,
  created_at timestamptz not null default now(),
  unique(user_id, type, reference)
);

create table if not exists referrals (
  id bigint generated always as identity primary key,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null,
  referrer_points integer not null default 0,
  referred_points integer not null default 0,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

alter table customer_rewards enable row level security;
alter table reward_transactions enable row level security;
alter table referrals enable row level security;

drop policy if exists "users read own rewards" on customer_rewards;
create policy "users read own rewards" on customer_rewards for select to authenticated using(auth.uid() = user_id);

drop policy if exists "users read own reward transactions" on reward_transactions;
create policy "users read own reward transactions" on reward_transactions for select to authenticated using(auth.uid() = user_id);

drop policy if exists "users read own referrals" on referrals;
create policy "users read own referrals" on referrals for select to authenticated using(auth.uid() = referrer_user_id or auth.uid() = referred_user_id);

-- Admin policies match the existing admin email used by the current dashboard.
drop policy if exists "admin manage customer_rewards" on customer_rewards;
create policy "admin manage customer_rewards" on customer_rewards for all using (auth.jwt() ->> 'email' = 'ibrahimbkkari51@gmail.com') with check (auth.jwt() ->> 'email' = 'ibrahimbkkari51@gmail.com');
drop policy if exists "admin manage reward_transactions" on reward_transactions;
create policy "admin manage reward_transactions" on reward_transactions for all using (auth.jwt() ->> 'email' = 'ibrahimbkkari51@gmail.com') with check (auth.jwt() ->> 'email' = 'ibrahimbkkari51@gmail.com');
drop policy if exists "admin manage referrals" on referrals;
create policy "admin manage referrals" on referrals for all using (auth.jwt() ->> 'email' = 'ibrahimbkkari51@gmail.com') with check (auth.jwt() ->> 'email' = 'ibrahimbkkari51@gmail.com');

-- Create/read the logged-in user's reward account.
create or replace function ensure_customer_rewards()
returns customer_rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row customer_rewards;
  code text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into row from customer_rewards where user_id = uid;
  if row.user_id is not null then return row; end if;
  code := 'BK' || upper(substr(replace(uid::text, '-', ''), 1, 8));
  insert into customer_rewards(user_id, referral_code) values(uid, code)
  on conflict (user_id) do nothing;
  select * into row from customer_rewards where user_id = uid;
  return row;
end;
$$;

grant execute on function ensure_customer_rewards() to authenticated;

-- Apply a referral once per account. Rewards are configurable through site_settings.
create or replace function apply_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  referrer uuid;
  ref_points integer := 100;
  new_points integer := 50;
  cfg jsonb;
  existing_count integer;
begin
  if uid is null then return jsonb_build_object('ok', false, 'message', 'Not authenticated'); end if;
  select value into cfg from site_settings where key = 'rewards';
  ref_points := coalesce((cfg->>'referrer_points')::integer, 100);
  new_points := coalesce((cfg->>'new_user_points')::integer, 50);

  select user_id into referrer from customer_rewards where upper(referral_code) = upper(trim(p_code));
  if referrer is null or referrer = uid then return jsonb_build_object('ok', false, 'message', 'Referral code is invalid'); end if;
  select count(*) into existing_count from referrals where referred_user_id = uid;
  if existing_count > 0 then return jsonb_build_object('ok', false, 'message', 'Referral already applied'); end if;

  perform ensure_customer_rewards();
  update customer_rewards set referred_by = referrer, updated_at = now() where user_id = uid and referred_by is null;
  if not found then return jsonb_build_object('ok', false, 'message', 'Referral already applied'); end if;

  update customer_rewards set points = points + ref_points, updated_at = now() where user_id = referrer;
  update customer_rewards set points = points + new_points, updated_at = now() where user_id = uid;

  insert into reward_transactions(user_id, points, type, reference, note) values
    (referrer, ref_points, 'referral', 'referral:'||uid::text, 'مكافأة إحالة صديق'),
    (uid, new_points, 'referral', 'welcome-referral:'||referrer::text, 'مكافأة التسجيل عبر إحالة');

  insert into referrals(referrer_user_id, referred_user_id, referral_code, referrer_points, referred_points)
  values(referrer, uid, upper(trim(p_code)), ref_points, new_points);

  return jsonb_build_object('ok', true, 'referrer_points', ref_points, 'new_user_points', new_points);
end;
$$;

grant execute on function apply_referral(text) to authenticated;

-- Award points on completed deliveries once per order.
create or replace function award_order_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  earned integer;
  cfg jsonb;
  inserted_count integer;
begin
  if new.user_id is null or new.status <> 'تم التسليم' then return new; end if;
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
  select value into cfg from site_settings where key = 'rewards';
  earned := floor(coalesce(new.total,0) * coalesce((cfg->>'points_per_dollar')::numeric, 1))::integer;
  if earned <= 0 then return new; end if;
  insert into customer_rewards(user_id, referral_code)
  values(new.user_id, 'BK' || upper(substr(replace(new.user_id::text, '-', ''), 1, 8)))
  on conflict (user_id) do nothing;
  insert into reward_transactions(user_id, points, type, reference, note)
  values(new.user_id, earned, 'order', 'order:'||new.id::text, 'نقاط مقابل طلب تم تسليمه')
  on conflict (user_id, type, reference) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count > 0 then
    update customer_rewards set points = points + earned, updated_at = now() where user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_award_points on orders;
create trigger orders_award_points after insert or update of status on orders for each row execute function award_order_points();

-- ---------- Editable public content defaults ----------
insert into site_settings(key, value) values
('rewards', jsonb_build_object(
  'enabled', true,
  'points_per_dollar', 1,
  'referrer_points', 100,
  'new_user_points', 50,
  'redemption_note', 'كل 100 نقطة = 1$ رصيد خصم عند تطبيق النظام من الإدارة.'
)),
('faq', jsonb_build_object('items', jsonb_build_array(
  jsonb_build_object('q','كيف بطلب لابتوب؟','a','اختار الجهاز، افتح التفاصيل، أضفه للسلة وكمل بيانات الطلب. الإدارة بتتواصل معك لتأكيد الطلب.'),
  jsonb_build_object('q','كيف بيصير التوصيل؟','a','مننسق معك عنوان التسليم، والتوصيل متاح داخل المحافظات بحسب تكلفة ومدة الشحن الظاهرة بالموقع.'),
  jsonb_build_object('q','كيف بتتبع طلبي؟','a','من صفحة تتبع الطلب أدخل رقم الطلب ورقم الهاتف المستخدم وقت الطلب.'),
  jsonb_build_object('q','كيف بشحن رصيد المحفظة؟','a','من صفحة المحفظة حوّل المبلغ بالطريقة المتاحة، ارفع الإيصال وأرسل رقم العملية.'),
  jsonb_build_object('q','هل في استبدال واسترجاع؟','a','نعم، حسب سياسة الاستبدال والاسترجاع المنشورة بالموقع وحالة المنتج.'),
  jsonb_build_object('q','كيف بتواصل مع الدعم؟','a','من صفحة تواصل معنا فيك تختار واتساب أو تيليغرام أو الإيميل، والمساعد الذكي رح يكون متاح بالموقع.' )
))),
('delivery', jsonb_build_object(
  'title','التوصيل والشحن',
  'intro','منوصل طلباتك لباب المنزل، والشحن متاح للمحافظات السورية حسب المحافظة.',
  'home','توصيل لباب المنزل — مننسق معك العنوان قبل التسليم.',
  'governorates','شحن لكل المحافظات الفعالة بالموقع، وتكلفة الشحن ومدة الوصول بتختلف حسب المحافظة.',
  'note','للطلبات الكبيرة أو خدمات البرمجة، مننسق التفاصيل معك بشكل مباشر.'
)),
('terms', jsonb_build_object(
  'title','الشروط والأحكام',
  'body','باستخدام Bkkari Tech، يوافق المستخدم على تقديم معلومات صحيحة عند إنشاء الحساب أو الطلب، وعلى مراجعة تفاصيل المنتج والسعر قبل تأكيد الطلب. الأسعار والتوفر قد تتغير قبل تأكيد الطلب من الإدارة. الخدمات الرقمية بعد تنفيذها قد لا تكون قابلة للاسترجاع إذا تم استخدامها أو تنفيذها بشكل صحيح. يمنع إساءة استخدام الموقع أو محاولة الوصول إلى حسابات أو بيانات غير مصرح بها. يحق للإدارة التواصل مع المستخدم لتأكيد الطلب ومعلومات التسليم. أي تعديل على هذه الشروط يظهر في هذه الصفحة.'
)),
('returns', jsonb_build_object(
  'title','الاستبدال والاسترجاع',
  'body','يتم فحص طلبات الاستبدال والاسترجاع حسب حالة المنتج وسبب الطلب. يجب التواصل مع الدعم بأسرع وقت عند وجود مشكلة أو عيب. المنتجات الرقمية والخدمات التي تم تنفيذها أو تفعيلها قد لا تكون قابلة للاسترجاع بعد التنفيذ. بالنسبة للابتوبات، يتم تقييم الحالة والمشكلة قبل الموافقة على الاستبدال أو الاسترجاع. تكلفة الشحن الناتجة عن الاستبدال أو الاسترجاع تحدد حسب الحالة والاتفاق مع العميل. يمكن تعديل هذه السياسة من لوحة التحكم.'
)),
('privacy', jsonb_build_object(
  'title','سياسة الخصوصية',
  'body','نستخدم معلومات الحساب والطلب مثل الاسم والبريد ورقم الهاتف والعنوان لتنفيذ الطلب والتواصل مع العميل. لا نطلب معلومات أكثر من اللازم لتنفيذ الخدمة. بيانات الدفع أو إثبات التحويل تستخدم للتحقق من طلبات تعبئة المحفظة. لا تشارك بيانات الحساب مع جهات غير لازمة لتنفيذ الطلب إلا عند الحاجة التشغيلية أو القانونية.'
))
on conflict (key) do nothing;

-- Helpful indexes.
create index if not exists reward_transactions_user_idx on reward_transactions(user_id, created_at desc);
create index if not exists referrals_referrer_idx on referrals(referrer_user_id, created_at desc);

-- END MASTER V3
