-- BKKARI TECH — المحافظات
-- شغّل هذا الملف في Supabase SQL Editor بعد schema.sql

insert into governorates (name, shipping_cost, delivery_days, is_active) values
  ('دمشق', 3, '1-2 يوم', true),
  ('ريف دمشق', 4, '1-2 يوم', true),
  ('حمص', 5, '2-3 أيام', true),
  ('حماة', 5, '2-3 أيام', true),
  ('طرطوس', 6, '2-3 أيام', true),
  ('اللاذقية', 6, '2-3 أيام', true),
  ('حلب', 7, '3-4 أيام', true),
  ('إدلب', 7, '3-4 أيام', true),
  ('درعا', 5, '2-3 أيام', true),
  ('السويداء', 5, '2-3 أيام', true),
  ('القنيطرة', 5, '2-3 أيام', true),
  ('دير الزور', 8, '4-5 أيام', true),
  ('الرقة', 8, '4-5 أيام', true),
  ('الحسكة', 8, '4-5 أيام', true)
on conflict (name) do update set
  shipping_cost = excluded.shipping_cost,
  delivery_days = excluded.delivery_days,
  is_active = true;
