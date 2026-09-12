import { NextResponse } from 'next/server';
import { getAdminSession, getServiceClient } from '@/app/lib/supabase-server';
import { logAdminActivity } from '@/app/lib/audit';

export async function POST(request: Request) {
  const user = await getAdminSession();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  try {
    const body = await request.json();
    const supabase = getServiceClient();
    const { data, error } = await supabase.from('laptops').insert(body).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await logAdminActivity(user.id,'create','laptop',String(data.id),`إضافة المنتج ${data.name||''}`);
    return NextResponse.json({ data });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'خطأ غير معروف' }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  const user = await getAdminSession();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  try {
    const { id, ...changes } = await request.json();
    if (!id) return NextResponse.json({ error: 'معرّف المنتج مطلوب' }, { status: 400 });
    const supabase = getServiceClient();
    const { data: before } = await supabase.from('laptops').select('id,name,stock_quantity').eq('id', id).maybeSingle();
    const { data, error } = await supabase.from('laptops').update(changes).eq('id', id).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (Object.prototype.hasOwnProperty.call(changes,'stock_quantity') && before && Number(changes.stock_quantity)!==Number(before.stock_quantity)){
      await supabase.from('inventory_movements').insert({product_id:id,product_type:'laptop',movement_type:'manual_adjustment',quantity:Number(changes.stock_quantity)-Number(before.stock_quantity),note:'تعديل يدوي للمخزون',admin_user_id:user.id});
    }
    await logAdminActivity(user.id,'update','laptop',String(data.id),`تعديل المنتج ${data.name||''}`);
    return NextResponse.json({ data });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'خطأ غير معروف' }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const user = await getAdminSession();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  try {
    const { id } = await request.json();
    const supabase = getServiceClient();
    const { error } = await supabase.from('laptops').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await logAdminActivity(user.id,'delete','laptop',String(id),'حذف منتج');
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'خطأ غير معروف' }, { status: 500 }); }
}
