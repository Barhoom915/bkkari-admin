"use client";
import { useEffect, useMemo, useState } from "react";

type UserRow = {
  id: string; customer_number: number | null; email: string; name: string; phone: string; avatar_url: string;
  created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null;
  banned_until: string | null; provider: string; wallet_balance: number; points: number; referral_code: string; orders_count: number; governorate: string; heard_from: string; has_logged_in: boolean;
};

function Info({ t, v }: { t: string; v: string }) {
  return <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-[10px] font-bold text-ink-soft">{t}</p><p className="mt-1 text-lg font-extrabold">{v}</p></div>;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editGovernorate, setEditGovernorate] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/users", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setUsers(j.users || []);
    if (!r.ok) setMsg(j.error || "تعذر تحميل المستخدمين");
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!profile && !editing) return;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => { document.body.style.overflow = bodyOverflow; document.documentElement.style.overflow = htmlOverflow; };
  }, [profile, editing]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => [u.name, u.email, u.phone, u.id].some(v => String(v || "").toLowerCase().includes(q)));
  }, [users, query]);

  async function action(userId: string, actionName: string, amount?: number) {
    const key = `${actionName}:${userId}`; setBusy(key); setMsg("");
    const r = await fetch("/api/admin/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ user_id: userId, action: actionName, amount }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setMsg(j.error || "تعذر تنفيذ العملية"); else await load();
    setBusy("");
  }

  async function openProfile(u: UserRow) {
    setBusy(`view:${u.id}`);
    const r = await fetch(`/api/admin/customers/${u.id}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setProfile(j); else setMsg(j.error || "تعذر تحميل ملف المستخدم");
    setBusy("");
  }

  function startEdit(u: UserRow) {
    setEditing(u); setEditName(u.name || ""); setEditPhone(u.phone || ""); setEditGovernorate(u.governorate || ""); setMsg("");
  }

  async function saveProfile() {
    if (!editing) return;
    setBusy(`profile:${editing.id}`); setMsg("");
    const r = await fetch("/api/admin/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ user_id: editing.id, action: "profile", name: editName, phone: editPhone, governorate: editGovernorate }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setMsg(j.error || "تعذر حفظ بيانات المستخدم"); else { setEditing(null); await load(); }
    setBusy("");
  }

  async function adjustBalance(u: UserRow) {
    const raw = window.prompt(`تعديل رصيد ${u.name || u.email}\nاكتب قيمة الإضافة أو الخصم بالدولار (مثال: 10 أو -5)`, "10");
    if (raw === null) return;
    const amount = Number(raw.replace(",", "."));
    if (!Number.isFinite(amount) || amount === 0) { setMsg("أدخل قيمة صحيحة وغير صفرية."); return; }
    const reason=window.prompt("سبب إضافة/خصم الرصيد؟", "");
    const key=`balance:${u.id}`; setBusy(key); setMsg(""); const r=await fetch("/api/admin/users",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({user_id:u.id,action:"balance",amount,reason})}); const j=await r.json(); setBusy(""); if(!r.ok){setMsg(j.error||"تعذر تعديل الرصيد");return} setUsers(xs=>xs.map(x=>x.id===u.id?{...x,wallet_balance:Number(j.balance??x.wallet_balance)}:x)); setMsg("تم تعديل الرصيد وإرسال إشعار للمستخدم ✓");
  }

  return <div className="space-y-5" dir="rtl">
    <section className="admin-hero"><div><span>USER MANAGEMENT</span><h1>المستخدمون 👥</h1></div><div className="admin-hero-orb">👥</div></section>
    <section className="grid gap-3 sm:grid-cols-3">
      <div className="admin-card"><p className="text-xs text-ink-soft">إجمالي المستخدمين</p><p className="mt-1 text-3xl font-extrabold text-blue">{users.length}</p></div>
      <div className="admin-card"><p className="text-xs text-ink-soft">المستخدمون الظاهرون</p><p className="mt-1 text-3xl font-extrabold text-blue">{filtered.length}</p></div>
      <div className="admin-card"><p className="text-xs text-ink-soft">الحسابات المحظورة</p><p className="mt-1 text-3xl font-extrabold text-orange">{users.filter(u => !!u.banned_until).length}</p></div>
    </section>
    <section className="admin-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="section-kicker">USERS</p><h2>المستخدمون</h2></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث بالاسم أو الإيميل أو رقم الزبون أو ID" className="sm:max-w-md"/></div>
      {msg && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/5 p-3 text-xs text-red-400">{msg}</p>}
      {loading ? <p className="mt-6 text-sm text-ink-soft">جاري تحميل المستخدمين...</p> : !filtered.length ? <p className="mt-6 rounded-2xl bg-surface p-8 text-center text-sm text-ink-soft">ما في مستخدمين مطابقين.</p> : <div className="mt-5 space-y-4">
        {filtered.map(u => { const blocked = !!u.banned_until; return <article key={u.id} className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-3">
              {u.avatar_url ? <img src={u.avatar_url} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover"/> : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue text-white font-black">{(u.name || u.email || "U").slice(0,1).toUpperCase()}</div>}
              <div className="min-w-0"><b className="block text-sm">{u.name || "مستخدم بدون اسم"}</b><span className="mt-1 block break-all text-xs text-ink-soft">{u.email || "بدون إيميل"}</span><span className="mt-1 block text-[10px] font-extrabold text-blue">ID الزبون: <code>{u.customer_number ? String(u.customer_number).padStart(5,"0") : "—"}</code></span></div>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-bold"><span className="rounded-full bg-blue/10 px-3 py-1.5 text-blue">محفظة ${u.wallet_balance.toFixed(2)}</span><span className="rounded-full bg-white/5 px-3 py-1.5 text-ink-soft">{u.orders_count} طلب</span><span className="rounded-full bg-white/5 px-3 py-1.5 text-ink-soft">{u.points} نقطة</span><span className={`rounded-full px-3 py-1.5 ${blocked ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>{blocked ? "محظور" : "دخل للموقع"}</span></div>
          </div>
          <div className="mt-4 grid gap-2 text-[11px] text-ink-soft sm:grid-cols-2 lg:grid-cols-5">
            <div><b className="text-ink">الهاتف:</b> {u.phone || "—"}</div><div><b className="text-ink">تاريخ التسجيل:</b> {new Date(u.created_at).toLocaleString("ar-SY")}</div><div><b className="text-ink">آخر دخول:</b> {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("ar-SY") : "—"}</div><div><b className="text-ink">الإيميل:</b> {u.email_confirmed_at ? "موثّق ✓" : "غير موثّق"}</div><div><b className="text-ink">طريقة الدخول:</b> {u.provider || "—"}</div><div><b className="text-ink">المحافظة:</b> {u.governorate || "—"}</div><div><b className="text-ink">سمع عنا من:</b> {u.heard_from || "—"}</div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" title="الملف الكامل" aria-label="الملف الكامل" disabled={busy===`view:${u.id}`} onClick={()=>void openProfile(u)} className="admin-user-icon-btn">📂</button>
            <button type="button" title="تعديل الرصيد" aria-label="تعديل الرصيد" disabled={busy===`balance:${u.id}`} onClick={()=>adjustBalance(u)} className="admin-user-icon-btn">💰</button>
            <button type="button" title="تعديل البيانات" aria-label="تعديل البيانات" onClick={()=>startEdit(u)} className="admin-user-icon-btn">✏️</button>
            <button type="button" title={blocked ? "فك الحظر" : "حظر المستخدم"} aria-label={blocked ? "فك الحظر" : "حظر المستخدم"} disabled={busy===`${blocked?"unblock":"block"}:${u.id}`} onClick={()=>action(u.id, blocked ? "unblock" : "block")} className={`admin-user-icon-btn ${blocked ? "is-unblock" : "is-block"}`}>{blocked ? "🔓" : "🚫"}</button>
          </div>
        </article> })}
      </div>}
    </section>
    {profile && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 px-4" dir="rtl"><div className="w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-3xl border border-line bg-[#0b111b] p-6 shadow-2xl"><div className="flex items-center justify-between gap-3"><div><p className="section-kicker">USER PROFILE</p><h2 className="text-xl font-extrabold">{profile.user?.user_metadata?.full_name||profile.user?.email||"المستخدم"}</h2></div><button onClick={()=>setProfile(null)} className="menu-close-btn">✕</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info t="رقم المستخدم" v={String(profile.customer_number||0).padStart(5,'0')}/><Info t="الرصيد" v={`$${Number(profile.wallet||0).toFixed(2)}`}/><Info t="الطلبات" v={String(profile.orders?.length||0)}/><Info t="النقاط" v={String(profile.rewards?.points||0)}/></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><section><h3 className="font-extrabold">الطلبات</h3><div className="mt-3 space-y-2">{(profile.orders||[]).map((o:any)=><div className="admin-list-row" key={o.id}><span>{o.order_number}</span><strong>${Number(o.total||0).toFixed(2)}</strong></div>)}</div></section><section><h3 className="font-extrabold">التعبئة والحركات</h3><div className="mt-3 space-y-2">{[...(profile.topups||[]),...(profile.transactions||[])].slice(0,15).map((x:any,i:number)=><div className="admin-list-row" key={x.id||i}><span>{x.payment_number||x.reference||x.status||'حركة'}</span><strong>${Number(x.amount||0).toFixed(2)}</strong></div>)}</div></section></div></div></div>}
    {editing && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 px-4" dir="rtl">
      <div className="w-full max-w-lg rounded-3xl border border-line bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3"><div><p className="section-kicker">CUSTOMER PROFILE</p><h2 className="text-xl font-extrabold">تعديل بيانات المستخدم</h2><p className="mt-1 text-xs text-ink-soft">تعديل رقم الهاتف يتم من الإدارة فقط.</p></div><button onClick={()=>setEditing(null)} className="rounded-xl border border-line px-3 py-2 text-sm">✕</button></div>
        <div className="mt-5 grid gap-3">
          <input value={editName} onChange={e=>setEditName(e.target.value)} placeholder="الاسم" />
          <input value={editPhone} onChange={e=>setEditPhone(e.target.value)} placeholder="رقم الهاتف" inputMode="tel" />
          <select value={editGovernorate} onChange={e=>setEditGovernorate(e.target.value)}><option value="">اختر المحافظة</option>{["دمشق","حلب","حمص","حماة","اللاذقية","طرطوس","إدلب","الرقة","دير الزور","الحسكة","درعا","السويداء","القنيطرة"].map(g=><option key={g} value={g}>{g}</option>)}</select>
          <button disabled={busy===`profile:${editing.id}`} onClick={saveProfile} className="rounded-2xl bg-blue px-5 py-3 font-extrabold text-white disabled:opacity-60">{busy===`profile:${editing.id}`?"جاري الحفظ...":"حفظ التعديلات"}</button>
        </div>
      </div>
    </div>}
  </div>;
}
