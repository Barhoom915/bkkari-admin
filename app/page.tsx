"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Dashboard={stats:{orders:number;sales:number;pendingTopups:number;topups:number;requests:number;users:number;capital:number;profit:number};lowStock:any[];recentOrders:any[];digital:any[]};
const money=(n:number)=>`$${Number(n||0).toFixed(2)}`;
export default function AdminOverview(){
 const [data,setData]=useState<Dashboard|null>(null);const[loading,setLoading]=useState(true);
 async function load(){setLoading(true);const r=await fetch('/api/admin/dashboard',{cache:'no-store'});const j=await r.json();if(r.ok)setData(j);setLoading(false)}
 useEffect(()=>{void load()},[]);
 const s=data?.stats;
 return <div className="admin-page space-y-6" dir="rtl">
  <section className="admin-hero"><div><span>BK TECH • OVERVIEW</span><h1>{new Date().getHours() >= 17 || new Date().getHours() < 5 ? "مسا الشغل 🌙" : new Date().getHours() >= 12 ? "نهار الشغل ☀️" : "صباح الشغل 👋"}</h1><p>كل الأرقام المهمة قدامك بسرعة، ومعها آخر الحركة والتنبيهات.</p></div><div className="admin-hero-orb">📊</div></section>
  <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
   <Metric icon="📦" label="إجمالي الطلبات" value={loading?'—':String(s?.orders??0)} />
   <Metric icon="💵" label="المبيعات المكتملة" value={loading?'—':money(s?.sales??0)} />
   <Metric icon="📦" label="رأس المال بالمخزون" value={loading?'—':money(s?.capital??0)} />
   <Metric icon="📈" label="الربح المحقق" value={loading?'—':money(s?.profit??0)} />
   <Metric icon="💰" label="تعبئة معلقة" value={loading?'—':money(s?.pendingTopups??0)} sub={`${s?.topups??0} طلب إجمالاً`} />
   <Metric icon="💻" label="طلبات المواقع" value={loading?'—':String(s?.requests??0)} />
   <Metric icon="👥" label="الزبائن" value={loading?'—':String(s?.users??0)} />
  </section>
  <section className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
   <div className="admin-card"><div className="flex items-center justify-between"><div><span className="section-kicker">آخر الحركة</span><h2>آخر الطلبات</h2></div><Link href="/orders" className="admin-link-btn">كل الطلبات ←</Link></div><div className="mt-4 space-y-2">{(data?.recentOrders??[]).map(o=><Link key={o.id} href="/orders" className="admin-list-row"><div><b className="font-mono-data text-blue">{o.order_number}</b><p className="mt-1 text-xs font-semibold">{o.customer_name||'زبون'} · {money(o.total)}</p></div><span>{o.status}</span></Link>)}{!loading&&!(data?.recentOrders?.length)&&<Empty text="ما في طلبات حالياً"/>}</div></div>
   <div className="admin-card"><span className="section-kicker">الخدمات الرقمية</span><h2>آخر الطلبات الرقمية</h2><div className="mt-4 space-y-2">{(data?.digital??[]).map(o=><Link key={o.id} href="/operations" className="admin-list-row"><div><b className="font-mono-data text-blue">{o.order_number}</b><p className="mt-1 text-xs font-semibold">{o.product_name||'خدمة رقمية'}</p></div><span>{o.status}</span></Link>)}{!loading&&!(data?.digital?.length)&&<Empty text="ما في طلبات رقمية"/>}</div></div>
  </section>
  <section className="admin-card"><div className="flex items-center justify-between"><div><span className="section-kicker">تنبيه المخزون</span><h2>منتجات قريبة من النفاد</h2></div><Link href="/products" className="admin-link-btn">إدارة المنتجات ←</Link></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(data?.lowStock??[]).map(p=><div key={p.id} className={`stock-alert ${Number(p.stock_quantity)<=0?'danger':''}`}><div><b>{p.name}</b><p>{p.brand||'منتج'} · {money(p.price)}</p></div><strong>{Number(p.stock_quantity)<=0?'نفد':`${p.stock_quantity} متبقي`}</strong></div>)}{!loading&&!(data?.lowStock?.length)&&<Empty text="المخزون حالياً بوضع جيد"/>}</div></section>

 </div>
}
function Metric({icon,label,value,sub}:{icon:string;label:string;value:string;sub?:string}){return <div className="admin-stat"><span>{icon}</span><div><p>{label}</p><b>{value}</b>{sub&&<small>{sub}</small>}</div></div>}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed border-line p-5 text-center text-xs text-ink-soft">{text}</div>}
