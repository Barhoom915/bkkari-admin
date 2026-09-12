# Bkkari Tech Admin V9

لوحة تحكم Bkkari Tech.

- تشمل مركز العمليات، الطلبات، المنتجات، طلبات المواقع، تعبئة المحفظة وإعدادات الدفع.
- تسجيل الدخول بحساب Google للإدارة.
- تظهر صورة حساب الإدارة المصغرة على الموبايل إذا كانت موجودة في user metadata.
- لا يوجد أي تكامل SMS أو WhatsApp في لوحة التحكم.

## GitHub
`https://github.com/Barhoom915/bkkari-admin.git`

## V18 Notifications / Coupons
- Added notification center at `/notifications`.
- Added coupon management at `/coupons`.
- Admin notification Push sending uses `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in Vercel environment variables.
- Run `supabase/v18_notifications.sql` from the website package against the same Supabase project.
