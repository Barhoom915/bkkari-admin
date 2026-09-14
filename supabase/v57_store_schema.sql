-- BKKARI TECH V57 — laptop categories, PlayStation customer choices, and order notes
alter table public.laptops add column if not exists order_note text;

-- Standard laptop categories used by the storefront filters. Existing values are normalized below.
update public.laptops set category='أعمال' where lower(coalesce(category,'')) in ('business','business laptop','أعمال');
update public.laptops set category='Gaming متوسط' where lower(coalesce(category,'')) in ('gaming medium','gaming متوسط','gaming mid');
update public.laptops set category='Gaming' where lower(coalesce(category,'')) in ('gaming','gaming laptop');
update public.laptops set category='مكتبي' where lower(coalesce(category,'')) in ('desktop','student','student laptop','مكتبي','design','design laptop');

alter table public.playstation_products add column if not exists storage_options text[] not null default '{}';
alter table public.playstation_products add column if not exists controller_count integer;
alter table public.playstation_products add column if not exists modification_status text not null default 'unmodified';
alter table public.playstation_products add column if not exists modification_types text[] not null default '{}';
alter table public.playstation_products add column if not exists order_note text;

update public.playstation_products set storage_options = case when coalesce(storage,'')<>'' then array[storage] else array['1TB'] end where product_type <> 'controller' and (storage_options is null or cardinality(storage_options)=0);
update public.playstation_products set controller_count = 1 where product_type='controller' and controller_count is null;
update public.playstation_products set modification_status='unmodified' where modification_status is null or modification_status='';

alter table public.playstation_products enable row level security;
drop policy if exists "public read available playstation products" on public.playstation_products;
create policy "public read available playstation products" on public.playstation_products for select using (is_available = true);
