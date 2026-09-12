BEGIN;

ALTER TABLE public.laptops
  ADD COLUMN IF NOT EXISTS capital_price numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock_alert integer NOT NULL DEFAULT 2;

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id bigint generated always as identity primary key,
  product_id bigint,
  product_type text NOT NULL DEFAULT 'laptop',
  movement_type text NOT NULL,
  quantity integer NOT NULL,
  note text,
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_activity_log_created_idx ON public.admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_activity_log_admin_idx ON public.admin_activity_log(admin_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_alert_settings (
  id boolean primary key default true check (id),
  low_stock_enabled boolean NOT NULL DEFAULT true,
  low_stock_threshold integer NOT NULL DEFAULT 2,
  profit_drop_enabled boolean NOT NULL DEFAULT true,
  large_discount_enabled boolean NOT NULL DEFAULT true,
  large_discount_percent numeric(5,2) NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.admin_alert_settings(id) VALUES(true) ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id bigint generated always as identity primary key,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text NOT NULL,
  entity_type text,
  entity_id text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_alerts_created_idx ON public.admin_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_alerts_unread_idx ON public.admin_alerts(is_read, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_admin_activity(
  p_admin_user_id uuid,
  p_action text,
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_id bigint;
BEGIN
  INSERT INTO public.admin_activity_log(admin_user_id,action,entity_type,entity_id,description,metadata)
  VALUES(p_admin_user_id,p_action,p_entity_type,p_entity_id,p_description,COALESCE(p_metadata,'{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_admin_activity(uuid,text,text,text,text,jsonb) TO authenticated;

COMMIT;
