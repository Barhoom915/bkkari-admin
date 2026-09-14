import { NextResponse } from "next/server";
import { getAdminSession, getServiceClient } from "@/app/lib/supabase-server";
import webpush from "web-push";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const service = getServiceClient();
    const allUsers: any[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const users = data.users || [];
      allUsers.push(...users);
      if (users.length < 1000) break;
    }

    const ids = allUsers.map((u) => u.id);
    const [wallets, rewards, orders] = await Promise.all([
      ids.length ? service.from("wallets").select("user_id,balance").in("user_id", ids) : Promise.resolve({ data: [], error: null } as any),
      ids.length ? service.from("customer_rewards").select("user_id,points,referral_code").in("user_id", ids) : Promise.resolve({ data: [], error: null } as any),
      ids.length ? service.from("orders").select("user_id").in("user_id", ids) : Promise.resolve({ data: [], error: null } as any),
    ]);

    // The user list itself comes from Supabase Auth. Optional profile extensions
    // should never make the whole Users page fail if their SQL has not been run yet.
    const walletRows: any[] = wallets.error ? [] : (wallets.data || []);
    const rewardRows: any[] = rewards.error ? [] : (rewards.data || []);
    const orderRows: any[] = orders.error ? [] : (orders.data || []);

    const walletMap = new Map(walletRows.map((x: any) => [x.user_id, Number(x.balance || 0)]));
    const rewardMap = new Map(rewardRows.map((x: any) => [x.user_id, { points: Number(x.points || 0), referral_code: x.referral_code || "" }]));
    const orderMap = new Map<string, number>();
    for (const x of orderRows) if (x.user_id) orderMap.set(x.user_id, (orderMap.get(x.user_id) || 0) + 1);

    const customerNumbers = new Map<string, number>();
    if (ids.length) {
      const { data: customerRows } = await service.from("customer_numbers").select("user_id,customer_number").in("user_id", ids);
      for (const row of customerRows || []) customerNumbers.set(row.user_id, Number(row.customer_number));
    }

    const users = allUsers.filter((u) => !!u.last_sign_in_at).map((u) => ({
      id: u.id,
      customer_number: customerNumbers.get(u.id) || null,
      email: u.email || "",
      name: u.user_metadata?.full_name || u.user_metadata?.name || "",
      phone: u.user_metadata?.phone || "",
      avatar_url: u.user_metadata?.avatar_url || u.user_metadata?.picture || "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at || null,
      email_confirmed_at: u.email_confirmed_at || null,
      banned_until: u.banned_until || null,
      provider: u.app_metadata?.provider || (Array.isArray(u.app_metadata?.providers) ? u.app_metadata.providers.join(", ") : ""),
      wallet_balance: walletMap.get(u.id) || 0,
      points: rewardMap.get(u.id)?.points || 0,
      referral_code: rewardMap.get(u.id)?.referral_code || "",
      orders_count: orderMap.get(u.id) || 0,
      heard_from: u.user_metadata?.heard_from || "",
      governorate: u.user_metadata?.governorate || "",
      has_logged_in: !!u.last_sign_in_at,
    }));

    return NextResponse.json({ users, total: users.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "تعذر تحميل المستخدمين" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const userId = String(body.user_id || "").trim();
    const action = String(body.action || "");
    if (!userId) return NextResponse.json({ error: "معرّف المستخدم مطلوب" }, { status: 400 });

    const service = getServiceClient();

    if (action === "block" || action === "unblock") {
      if (admin.id === userId && action === "block") return NextResponse.json({ error: "ما فيك تحظر حساب الإدارة الحالي." }, { status: 400 });
      const { data, error } = await service.auth.admin.updateUserById(userId, {
        ban_duration: action === "block" ? "876000h" : "none",
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, user: { id: data.user?.id, banned_until: data.user?.banned_until || null } });
    }

    if (action === "profile") {
      const { data: existing, error: getError } = await service.auth.admin.getUserById(userId);
      if (getError || !existing.user) throw getError || new Error("المستخدم غير موجود");
      const currentMeta = existing.user.user_metadata || {};
      const nextMeta = {
        ...currentMeta,
        full_name: String(body.name ?? currentMeta.full_name ?? currentMeta.name ?? "").trim(),
        name: String(body.name ?? currentMeta.name ?? currentMeta.full_name ?? "").trim(),
        phone: String(body.phone ?? currentMeta.phone ?? "").trim(),
        governorate: String(body.governorate ?? currentMeta.governorate ?? "").trim(),
      };
      const { data, error } = await service.auth.admin.updateUserById(userId, { user_metadata: nextMeta });
      if (error) throw error;
      return NextResponse.json({ ok: true, user: { id: data.user?.id, user_metadata: data.user?.user_metadata || {} } });
    }

    if (action === "balance") {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount === 0) return NextResponse.json({ error: "أدخل قيمة رصيد صحيحة وغير صفرية." }, { status: 400 });
      const { data: wallet } = await service.from("wallets").select("id,balance").eq("user_id", userId).maybeSingle();
      const current = Number(wallet?.balance || 0);
      const next = current + amount;
      if (next < 0) return NextResponse.json({ error: `الرصيد الحالي $${current.toFixed(2)}، ما فيك تخصم أكتر منه.` }, { status: 400 });
      if (wallet) {
        const { error } = await service.from("wallets").update({ balance: next, updated_at: new Date().toISOString() }).eq("id", wallet.id);
        if (error) throw error;
      } else {
        const { error } = await service.from("wallets").insert({ user_id: userId, balance: next });
        if (error) throw error;
      }
      const { error: txError } = await service.from("wallet_transactions").insert({
        user_id: userId,
        amount,
        type: "adjustment",
        status: "completed",
        reference: `admin:${Date.now()}`,
      });
      if (txError) throw txError;
      const reason = String(body.reason || body.admin_note || "").trim();
      const title = amount > 0 ? "💰 تمت إضافة رصيد" : "💳 تم خصم رصيد";
      const bodyText = amount > 0
        ? `تمت إضافة $${amount.toFixed(2)} إلى محفظتك. الرصيد الحالي $${next.toFixed(2)}.${reason ? ` السبب: ${reason}` : ""}`
        : `تم خصم $${Math.abs(amount).toFixed(2)} من محفظتك. الرصيد الحالي $${next.toFixed(2)}.${reason ? ` السبب: ${reason}` : ""}`;
      await service.from("notifications").insert({ title, body: bodyText, href: "/wallet", kind: "wallet", target_user_id: userId });
      const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY,subject=process.env.VAPID_SUBJECT;
      if(publicKey&&privateKey&&subject){
        webpush.setVapidDetails(subject,publicKey,privateKey);
        const {data:subs}=await service.from("push_subscriptions").select("id,subscription").eq("user_id",userId);
        for(const row of subs??[]){try{await webpush.sendNotification(row.subscription as webpush.PushSubscription,JSON.stringify({title,body:bodyText,href:"/wallet",icon:"/brand/bkkari-tech-logo.png",badge:"/brand/bkkari-tech-logo.png",tag:`wallet-adjustment:${userId}:${Math.round(Date.now()/1000)}`,renotify:false,requireInteraction:false}));}catch(err:any){if(err?.statusCode===404||err?.statusCode===410)await service.from("push_subscriptions").delete().eq("id",row.id)}}
      }
      return NextResponse.json({ ok: true, balance: next });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "تعذر تنفيذ التعديل" }, { status: 500 });
  }
}
