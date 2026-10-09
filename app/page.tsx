"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Dashboard={range:string;stats:{orders:number;sales:number;pendingTopups:number;topups:number;requests:number;users:number;usersMayBePartial?:boolean;capital:number;profit:number};trend:{date:string;sales:number}[];lowStock:any[];recentOrders:any[];digital:any[]};
const money=(n:number)=>`$${Number(n||0).toFixed(2)}`;
export default function AdminOverview(){
 const [data,setData]=useState<Dashboard|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState("");const [lastUpdated,setLastUpdated]=useState<Date|null>(null);const [range,setRange]=useState("30");
 async function load(selectedRange=range){setLoading(true);setError("");try{const r=await fetch(`/api/admin/dashboard?range=${encodeURIComponent(selectedRange)}`,{cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'تعذر تحميل بيانات لوحة التحكم');setData(j);setLastUpdated(new Date())}catch(e){setError(e instanceof Error?e.message:'حدث خطأ غير متوقع')}finally{setLoading(false)}}
 useEffect(()=>{void load(range);const timer=window.setInterval(()=>void load(range),60000);return()=>window.clearInterval(timer)},[range]);
 const s=data?.stats;
 return <div className="admin-page space-y-6" dir="rtl">
  <section className="admin-hero"><div><span>NOVATEK • مركز العمليات</span><h1>{new Date().getHours() >= 17 || new Date().getHours() < 5 ? "مسا الشغل 🌙" : new Date().getHours() >= 12 ? "نهار الشغل ☀️" : "صباح الشغل 👋"}</h1><p>نظرة موحّدة على الطلبات والمبيعات والمخزون والخدمات — من بيانات النظام الفعلية.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" className="admin-action" onClick={()=>void load()} disabled={loading}>{loading?"جارٍ التحديث…":"↻ تحديث البيانات"}</button><Link href="/analytics" className="admin-action admin-action-dark">عرض التحليلات ←</Link><label className="admin-range-control"><span>فترة المبيعات</span><select value={range} onChange={e=>setRange(e.target.value)} aria-label="فترة إحصائيات المبيعات"><option value="7">آخر 7 أيام</option><option value="30">آخر 30 يوم</option><option value="90">آخر 90 يوم</option><option value="all">كل الفترة</option></select></label>{lastUpdated&&<span className="admin-refresh-stamp">آخر تحديث {lastUpdated.toLocaleTimeString("ar-SY",{hour:"2-digit",minute:"2-digit",second:"2-digit"})} · تحديث تلقائي كل دقيقة</span>}</div></div><div className="admin-hero-orb">📊</div></section>
  {error&&<section role="alert" className="admin-error-panel"><div><b>تعذر تحديث لوحة المعلومات</b><p>{error}</p></div><button className="admin-action" onClick={()=>void load()}>إعادة المحاولة</button></section>}
  <section className="admin-stats-grid grid gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
   <Metric icon="📦" label="إجمالي الطلبات" value={loading?'—':String(s?.orders??0)} />
   <Metric icon="💵" label={`المبيعات المكتملة · ${range==='all'?'كل الفترة':`آخر ${range} يوم`}`} value={loading?'—':money(s?.sales??0)} />
   <Metric icon="📦" label="رأس المال بالمخزون" value={loading?'—':money(s?.capital??0)} />
   <Metric icon="📈" label="الربح المحقق" value={loading?'—':money(s?.profit??0)} />
   <Metric icon="💰" label="تعبئة معلقة" value={loading?'—':money(s?.pendingTopups??0)} sub={`${s?.topups??0} طلب إجمالاً`} />
   <Metric icon="💻" label="طلبات المواقع" value={loading?'—':String(s?.requests??0)} />
   <Metric icon="👥" label="الزبائن" value={loading?'—':String(s?.users??0)} sub={s?.usersMayBePartial?"قد يكون العدد جزئياً (أول 1000 حساب)":undefined} />
  </section>
  <section className="admin-card admin-sales-chart" aria-labelledby="sales-trend-title"><div className="admin-chart-heading"><div><span className="section-kicker">الأداء المالي</span><h2 id="sales-trend-title">حركة المبيعات اليومية</h2><p>المبيعات المكتملة خلال آخر 30 يوم؛ هذا الرسم مستقل عن فلتر إجمالي المبيعات.</p></div><Link href="/analytics" className="admin-link-btn">تحليلات مفصلة ←</Link></div><div className="admin-bars" role="img" aria-label="رسم أعمدة للمبيعات المكتملة اليومية">{(data?.trend??[]).map((point,index,arr)=>{const max=Math.max(1,...arr.map(x=>x.sales));const height=Math.max(point.sales>0?5:2,(point.sales/max)*100);return <div className="admin-bar-item" key={point.date} title={`${point.date}: ${money(point.sales)}`}><b>{point.sales>0?money(point.sales):''}</b><span className={point.sales>0?'has-value':''} style={{height:`${height}%`}}/><small>{index%Math.max(1,Math.ceil(arr.length/7))===0?point.date.slice(5):''}</small></div>})}{!loading&&!(data?.trend?.length)&&<div className="admin-chart-empty">لا توجد بيانات مبيعات مكتملة ضمن الفترة.</div>}</div><div className="admin-chart-foot"><span>أعلى يوم: {money(Math.max(0,...(data?.trend??[]).map(x=>x.sales)))}</span><span>الفترة: آخر 30 يوم</span></div></section>
  <section className="admin-quick-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   <QuickLink href="/orders" icon="📦" title="إدارة الطلبات" detail="مراجعة الحالات والطلبات الجديدة" />
   <QuickLink href="/products" icon="🛍️" title="المنتجات والمخزون" detail="الأسعار والكميات والتنبيهات" />
   <QuickLink href="/ai-analytics" icon="🤖" title="تحليلات الذكاء الاصطناعي" detail="الاستخدام والتكلفة والأخطاء" />
   <QuickLink href="/api-settings" icon="🔌" title="التكاملات وواجهات API" detail="إعدادات الخدمات والاتصال" />
   <QuickLink href="/wallet-topups" icon="💳" title="طلبات تعبئة المحفظة" detail="مراجعة الطلبات المعلقة" />
   <QuickLink href="/requests" icon="🧩" title="طلبات تصميم المواقع" detail="متابعة العملاء والمشاريع" />
   <QuickLink href="/customers" icon="👥" title="ملفّات العملاء" detail="الوصول السريع إلى بيانات العملاء" />
  </section>
  <section className="admin-overview-columns grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
   <div className="admin-card"><div className="flex items-center justify-between"><div><span className="section-kicker">آخر الحركة</span><h2>آخر الطلبات</h2></div><Link href="/orders" className="admin-link-btn">كل الطلبات ←</Link></div><div className="mt-4 space-y-2">{(data?.recentOrders??[]).map(o=><Link key={o.id} href="/orders" className="admin-list-row"><div><b className="font-mono-data text-blue">{o.order_number}</b><p className="mt-1 text-xs font-semibold">{o.customer_name||'زبون'} · {money(o.total)}</p></div><span>{o.status}</span></Link>)}{!loading&&!(data?.recentOrders?.length)&&<Empty text="ما في طلبات حالياً"/>}</div></div>
   <div className="admin-card"><span className="section-kicker">الخدمات الرقمية</span><h2>آخر الطلبات الرقمية</h2><div className="mt-4 space-y-2">{(data?.digital??[]).map(o=><Link key={o.id} href="/operations" className="admin-list-row"><div><b className="font-mono-data text-blue">{o.order_number}</b><p className="mt-1 text-xs font-semibold">{o.product_name||'خدمة رقمية'}</p></div><span>{o.status}</span></Link>)}{!loading&&!(data?.digital?.length)&&<Empty text="ما في طلبات رقمية"/>}</div></div>
  </section>
  <section className="admin-card admin-ops-card"><div className="flex items-center justify-between gap-3"><div><span className="section-kicker">مركز المتابعة</span><h2>اختصارات التشغيل اليومي</h2><p className="mt-1 text-xs text-ink-soft">افتح القسم المناسب لمتابعة العمليات المفتوحة بدون البحث بالقائمة.</p></div><span className="admin-ops-mark">NOVATEK / OPS</span></div><div className="admin-ops-grid mt-4"><OpsLink href="/orders" icon="📦" title="الطلبات" detail="مراجعة الطلبات وحالات الشحن"/><OpsLink href="/wallet-topups" icon="💰" title="المحفظة" detail="طلبات التعبئة والتحقق"/><OpsLink href="/alerts" icon="🚨" title="التنبيهات" detail="متابعة الحالات التي تحتاج انتباه"/><OpsLink href="/activity" icon="🧾" title="سجل النشاط" detail="مراجعة التغييرات المسجلة"/><OpsLink href="/admins" icon="🛡️" title="المشرفون" detail="مراجعة وصول الإدارة"/><OpsLink href="/settings" icon="⚙️" title="الإعدادات" detail="التحقق من إعدادات النظام"/></div></section>
  <section className="admin-card"><div className="flex items-center justify-between"><div><span className="section-kicker">تنبيه المخزون</span><h2>منتجات قريبة من النفاد</h2></div><Link href="/products" className="admin-link-btn">إدارة المنتجات ←</Link></div><div className="admin-stock-grid mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(data?.lowStock??[]).map(p=><div key={p.id} className={`stock-alert ${Number(p.stock_quantity)<=0?'danger':''}`}><div><b>{p.name}</b><p>{p.brand||'منتج'} · {money(p.price)}</p></div><strong>{Number(p.stock_quantity)<=0?'نفد':`${p.stock_quantity} متبقي`}</strong></div>)}{!loading&&!(data?.lowStock?.length)&&<Empty text="المخزون حالياً بوضع جيد"/>}</div></section>

 </div>
}
function Metric({icon,label,value,sub}:{icon:string;label:string;value:string;sub?:string}){return <div className="admin-stat"><span>{icon}</span><div><p>{label}</p><b>{value}</b>{sub&&<small>{sub}</small>}</div></div>}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed border-line p-5 text-center text-xs text-ink-soft">{text}</div>}

function QuickLink({href,icon,title,detail}:{href:string;icon:string;title:string;detail:string}){return <Link href={href} className="admin-quick-link"><span>{icon}</span><div><b>{title}</b><small>{detail}</small></div><strong>←</strong></Link>}

function OpsLink({href,icon,title,detail}:{href:string;icon:string;title:string;detail:string}){return <Link href={href} className="admin-ops-link"><span>{icon}</span><div><b>{title}</b><small>{detail}</small></div><strong>←</strong></Link>}
