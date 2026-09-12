"use client";

import { useEffect, useState, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase-browser";

const ADMIN_EMAIL = "ibrahimbkkari51@gmail.com";

const navItems = [
  { href: "/", label: "🏠 الرئيسية" },
  { href: "/orders", label: "📦 الطلبات" },
  { href: "/analytics", label: "📈 تحليل المبيعات" },
  { href: "/api-settings", label: "🔌 API" },
    { href: "/requests", label: "💻 طلبات المواقع" },
  { href: "/wallet-topups", label: "💰 تعبئة المحفظة" },
  { href: "/products", label: "🛍️ المنتجات" },
  { href: "/settings", label: "⚙️ إعدادات المتجر" },
  { href: "/rewards", label: "🎁 النقاط والإحالة" },
  { href: "/notifications", label: "🔔 الإشعارات" },
  { href: "/alerts", label: "🚨 مركز التنبيهات" },
  { href: "/coupons", label: "🎟️ الكوبونات" },
  { href: "/admins", label: "🛡️ المشرفون" },
  { href: "/activity", label: "🧾 سجل النشاط" },
  { href: "/users", label: "👥 USERS" },
  { href: "/account", label: "👤 الحساب" },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alerts, setAlerts] = useState({ orders: 0, requests: 0, topups: 0, notifications: 0, total: 0 });
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const r = await fetch('/api/admin/admins?mode=me', { cache: 'no-store' });
        setAuthorized(r.ok);
      }
      setLoading(false);
    });
  }, [supabase]);

  useEffect(() => {
    if (!authorized) return;
    let alive = true;
    const loadAlerts = async () => {
      const r = await fetch("/api/admin/alerts", { cache: "no-store" });
      if (!r.ok || !alive) return;
      const j = await r.json();
      setAlerts({ orders: Number(j.orders || 0), requests: Number(j.requests || 0), topups: Number(j.topups || 0), notifications: Number(j.notifications || 0), total: Number(j.total || 0) });
    };
    void loadAlerts();
    const timer = window.setInterval(() => void loadAlerts(), 8000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [authorized]);

  useEffect(() => {
    if (!authorized || globalSearch.trim().length < 2) { setSearchResults(null); return; }
    const timer = window.setTimeout(async () => {
      const r = await fetch(`/api/admin/search?q=${encodeURIComponent(globalSearch.trim())}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setSearchResults(j);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [globalSearch, authorized]);

  async function handleLogin() {
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  if (loading) {
    return <div className="admin-login-screen"><div className="login-loader"><img src="/brand/bkkari-tech-logo.png" alt="Bkkari Tech"/><span>جاري تجهيز لوحة التحكم</span></div></div>;
  }

  if (!user || (!authorized && user.email !== ADMIN_EMAIL)) {
    return (
      <div className="admin-login-screen">
        <div className="login-glow login-glow-one"/><div className="login-glow login-glow-two"/>
        <div className="admin-login-card">
          <div className="login-logo-wrap"><img src="/brand/bkkari-tech-logo.png" alt="Bkkari Tech" /></div>
          <span className="login-kicker">BKKARI TECH • ADMIN</span>
          <h1>لوحة التحكم</h1>
          <p>{user ? `الحساب ${user.email} ما إله صلاحية وصول.` : "سجّل الدخول بحساب الإدارة للمتابعة"}</p>
          {!user ? <button onClick={handleLogin} className="google-login-btn"><span className="google-g">G</span><span>المتابعة باستخدام Google</span><span className="login-arrow">←</span></button> : <button onClick={handleLogout} className="google-login-btn danger">تسجيل الخروج</button>}
          <small>دخول آمن ومخصص للإدارة</small>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell flex min-h-screen">
      <aside className="admin-sidebar hidden w-64 shrink-0 sm:flex sm:flex-col">
        <div className="admin-brand flex items-center gap-2 border-b border-line p-5">
          <img src="/brand/bkkari-tech-logo.png" alt="Bkkari Tech" className="h-8 w-8" />
          <span className="gold-shine text-sm font-bold">لوحة التحكم</span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => {
            const badge = item.href === "/orders" ? alerts.orders : item.href === "/requests" ? alerts.requests : item.href === "/wallet-topups" ? alerts.topups : item.href === "/notifications" ? alerts.notifications : 0;
            return <Link key={item.href} href={item.href} className={`admin-nav-item ${pathname === item.href ? "active" : ""}`}>
              <span>{item.label}</span>{badge > 0 && <b className="admin-nav-badge">{badge > 99 ? "99+" : badge}</b>}
            </Link>;
          })}
        </nav>
        <div className="admin-sidebar-foot mt-auto space-y-2 p-3">
          <button onClick={handleLogout} className="admin-logout w-full rounded-xl px-3 py-2 text-xs">
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="admin-content flex-1 p-4 sm:p-8">
        <div className="admin-mobile-header mb-4 sm:hidden" dir="ltr">
          <div className="flex items-center gap-2" dir="rtl">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="صورة الحساب" className="h-8 w-8 rounded-full object-cover ring-2 ring-white shadow-sm" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue text-xs font-bold text-white">
                {(user.user_metadata?.full_name || user.email || "A").slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="gold-shine text-sm font-bold">لوحة التحكم</span>
          </div>
          <button onClick={()=>setMobileOpen(true)} className={`admin-burger ${mobileOpen ? "is-open" : ""}`} aria-label="فتح القائمة"><i/><i/><i/></button>
        </div>
        <nav className="hidden">
          {navItems.map((item) => {
            const badge = item.href === "/orders" ? alerts.orders : item.href === "/requests" ? alerts.requests : item.href === "/wallet-topups" ? alerts.topups : item.href === "/notifications" ? alerts.notifications : 0;
            return <Link key={item.href} href={item.href} className={`admin-mobile-nav shrink-0 rounded-full px-3 py-1.5 text-xs ${pathname === item.href ? "active" : ""}`}>{item.label}{badge > 0 && <b className="admin-nav-badge">{badge > 99 ? "99+" : badge}</b>}</Link>;
          })}
        </nav>
        {mobileOpen && <div className="fixed inset-0 z-[80] sm:hidden">
          <button aria-label="إغلاق القائمة" onClick={()=>setMobileOpen(false)} className="absolute inset-0 bg-black/60" />
          <aside className="mobile-menu-panel absolute right-0 top-0 h-full w-[min(86vw,340px)] overflow-y-auto border-l border-line bg-[#070b12] p-4 shadow-2xl" dir="rtl">
            <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2"><img src="/brand/bkkari-tech-logo.png" alt="Bkkari Tech" className="h-8 w-8"/><b className="gold-shine text-sm">لوحة التحكم</b></div>
              <button onClick={()=>setMobileOpen(false)} className="menu-close-btn" aria-label="إغلاق القائمة">✕</button>
            </div>
            <nav className="flex flex-col gap-1">{navItems.map(item=>{const badge=item.href==="/orders"?alerts.orders:item.href==="/requests"?alerts.requests:item.href==="/wallet-topups"?alerts.topups:item.href==="/notifications"?alerts.notifications:0;return <Link key={item.href} href={item.href} onClick={()=>setMobileOpen(false)} className={`admin-nav-item ${pathname===item.href?"active":""}`}><span>{item.label}</span>{badge>0&&<b className="admin-nav-badge">{badge>99?"99+":badge}</b>}</Link>})}</nav>
            <button onClick={handleLogout} className="admin-logout mt-4 w-full rounded-xl px-3 py-3 text-xs">تسجيل الخروج</button>
          </aside>
        </div>}
        <div className="admin-topbar">
          <div className="admin-global-search">
            <span>⌕</span><input value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)} placeholder="ابحث عن طلب، زبون، تعبئة أو طلب موقع..." />
            {searchResults && <div className="admin-search-results">
              {(searchResults.orders||[]).map((x:any)=><Link key={`o-${x.id}`} href="/orders" onClick={()=>setGlobalSearch("")}><b>{x.order_number}</b><span>{x.customer_name} · ${Number(x.total||0).toFixed(2)}</span></Link>)}
              {(searchResults.topups||[]).map((x:any)=><Link key={`t-${x.id}`} href="/wallet-topups" onClick={()=>setGlobalSearch("")}><b>{x.payment_number||`PAY-${String(x.id).padStart(4,"0")}`}</b><span>تعبئة ${Number(x.amount||0).toFixed(2)}</span></Link>)}
              {(searchResults.requests||[]).map((x:any)=><Link key={`r-${x.id}`} href="/requests" onClick={()=>setGlobalSearch("")}><b>طلب موقع</b><span>{x.name} · {x.website_type||""}</span></Link>)}
              {(searchResults.users||[]).map((x:any)=><Link key={`u-${x.id}`} href="/users" onClick={()=>setGlobalSearch("")}><b>👤 {x.name}</b><span>{x.email||x.phone||""}</span></Link>)}
              {![...(searchResults.orders||[]),...(searchResults.topups||[]),...(searchResults.requests||[]),...(searchResults.users||[])].length&&<div className="admin-search-empty">ما لقيت نتيجة مطابقة</div>}
            </div>}
          </div>
          <div className="admin-topbar-user"><span>بكاري تيك</span><span className="admin-online-dot"/></div>
        </div>
        <div key={pathname} className="admin-route-transition">{children}</div>
      </div>
    </div>
  );
}
