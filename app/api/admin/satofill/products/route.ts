import { NextResponse } from 'next/server';
import { getAdminSession, getServiceClient } from '@/app/lib/supabase-server';
import { satofill } from '@/app/lib/satofill';

export async function GET() {
  const user = await getAdminSession();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  try {
    const [products, { data: overrides, error }] = await Promise.all([
      satofill.getProducts(),
      getServiceClient().from('digital_service_overrides').select('*'),
    ]);
    if (error) throw error;
    const map = new Map((overrides ?? []).map((x) => [String(x.product_id), x]));
    return NextResponse.json({ data: products.map((p) => ({ ...p, override: map.get(String(p.id)) ?? null })) });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'تعذر تحميل الخدمات الرقمية' }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  const user = await getAdminSession();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  try {
    const body = await request.json();
    const productId = String(body.product_id ?? '');
    if (!productId) return NextResponse.json({ error: 'product_id مطلوب' }, { status: 400 });
    const customPrice = body.custom_price === '' || body.custom_price == null ? null : Number(body.custom_price);
    if (body.is_active !== false && (customPrice == null || !Number.isFinite(customPrice) || customPrice < 0)) {
      return NextResponse.json({ error: 'لازم تحدد سعر البيع الخاص فيك قبل تفعيل المنتج' }, { status: 400 });
    }
    const payload = {
      product_id: productId,
      custom_name: body.custom_name?.trim() || null,
      custom_price: customPrice,
      custom_category: body.custom_category?.trim() || null,
      custom_description: body.custom_description?.trim() || null,
      custom_image: body.custom_image?.trim() || null,
      is_active: body.is_active !== false,
      updated_at: new Date().toISOString(),
    };
    const supabase = getServiceClient();
    const { data, error } = await supabase.from('digital_service_overrides').upsert(payload, { onConflict: 'product_id' }).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'خطأ غير معروف' }, { status: 500 }); }
}
