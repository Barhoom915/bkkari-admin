-- BKKARI TECH — Admin controls for SatoFill overrides
create table if not exists digital_service_overrides (
  id bigint generated always as identity primary key,
  product_id text not null unique,
  custom_name text,
  custom_price numeric(10,2),
  custom_category text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table digital_service_overrides enable row level security;
-- Admin API uses SUPABASE_SERVICE_ROLE_KEY; no public policies are required.

alter table if exists digital_service_overrides add column if not exists custom_description text;
alter table if exists digital_service_overrides add column if not exists custom_image text;
