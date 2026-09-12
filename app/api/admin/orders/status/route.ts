import { NextResponse } from "next/server";
import webpush from "web-push";
import { getAdminSession, getServiceClient } from "@/app/lib/supabase-server";
import { logAdminActivity } from "@/app/lib/audit";

export async function PATCH(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  try {
    const body = await request.json();
    const id = Number(body.id);
    const status = String(body.status || "").trim();
    if (!Number.isFinite(id) || !status) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
    const service = getServiceClient();
    const { data: order, error } = await service.from("orders").select("id,order_number,user_id,status").eq("id", id).single();
    if (error || !order) return NextResponse.json({ error: error?.message || "الطلب غير موجود" }, { status: 404 });
    if (order.status === status) return NextResponse.json({ data: order, pushSent: 0 });
    const { data: updated, error: updateError } = await service.from("orders").update({ status }).eq("id", id).select("id,order_number,user_id,status").single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    let pushSent = 0;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (order.user_id && publicKey && privateKey && subject) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      const { data: subscriptions } = await service.from("push_subscriptions").select("id,subscription").eq("user_id", order.user_id);
      const title = status === "تم التسليم" ? "🏠 تم تسليم طلبك" : status === "خرج للتوصيل" ? "🚚 طلبك خرج للتوصيل" : status === "قيد التجهيز" ? "📦 طلبك قيد التحضير" : "📦 تحديث طلبك";
      const message = `طلبك ${order.order_number || ""}: ${status}`;
      for (const row of subscriptions ?? []) {
        try { await webpush.sendNotification(row.subscription as webpush.PushSubscription, JSON.stringify({ title, body: message, href: "/track", icon: "/brand/bkkari-tech-logo.png", tag: `order-status:${order.id}:${status}`, renotify: false, requireInteraction: false })); pushSent++; }
        catch (err: any) { if (err?.statusCode === 404 || err?.statusCode === 410) await service.from("push_subscriptions").delete().eq("id", row.id); }
      }
    }
    await logAdminActivity(admin.id,"status_change","order",String(updated.id),`تغيير حالة ${updated.order_number} إلى ${updated.status}`);
    return NextResponse.json({ data: updated, pushSent });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "تعذر تحديث الطلب" }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const admin = await getAdminSession(); if (!admin) return NextResponse.json({error:"غير مصرح"},{status:401});
  const body=await request.json().catch(()=>({})); const ids=Array.isArray(body.ids)?body.ids.map(Number).filter(Number.isFinite):[]; if(!ids.length)return NextResponse.json({error:"حدد طلبات أولاً"},{status:400});
  const {error}=await getServiceClient().from("orders").delete().in("id",ids); if(error)return NextResponse.json({error:error.message},{status:400}); await logAdminActivity(admin.id,"delete","order",ids.join(","),`حذف ${ids.length} طلب`); return NextResponse.json({ok:true});
}
