-- BKKARI TECH V53 — PlayStation product details, controller settings and included gifts
alter table public.playstation_products add column if not exists details text;
alter table public.playstation_products add column if not exists controller_connection text;
alter table public.playstation_products add column if not exists included_options text[] not null default '{}';

-- Existing controller rows should not carry console storage values.
update public.playstation_products
set storage = null
where product_type = 'controller';

-- Keep the table readable by the storefront for available products.
alter table public.playstation_products enable row level security;
drop policy if exists "public read available playstation products" on public.playstation_products;
create policy "public read available playstation products"
on public.playstation_products for select
using (is_available = true);
