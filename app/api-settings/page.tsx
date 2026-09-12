"use client";
import { useEffect, useState } from "react";

type ApiInfo = { configured:boolean; provider:string; type:string; baseUrl:string; auth:string; tokenPreview:string|null; endpoints:{label:string;method:string;path:string}[] };

export default function ApiSettings(){
  const [status,setStatus]=useState<"checking"|"ok"|"error">("checking");
  const [balance,setBalance]=useState<any>(null); const [info,setInfo]=useState<ApiInfo|null>(null);
  const [counts,setCounts]=useState({products:0,categories:0}); const [error,setError]=useState(""); const [checkedAt,setCheckedAt]=useState("");
  async function loadInfo(){try{const r=await fetch("/api/admin/satofill/info",{cache:"no-store"});if(r.ok)setInfo(await r.json())}catch{}}
  async function check(){
    setStatus("checking");setError("");
    try{
      const [b,c,p]=await Promise.all([
        fetch("/api/satofill-balance",{cache:"no-store"}).then(r=>r.json().then(j=>({ok:r.ok,j}))),
        fetch("/api/admin/satofill/categories",{cache:"no-store"}).then(r=>r.json().then(j=>({ok:r.ok,j}))),
        fetch("/api/admin/satofill/products",{cache:"no-store"}).then(r=>r.json().then(j=>({ok:r.ok,j}))),
      ]);
      if(!b.ok||!b.j.ok) throw new Error(b.j.error||"تعذر الاتصال بالـ API");
      setBalance(b.j.balance); setCounts({categories:Array.isArray(c.j.data)?c.j.data.length:0,products:Array.isArray(p.j.data)?p.j.data.length:0});
      setStatus("ok");setCheckedAt(new Date().toLocaleString("ar-SY"));
    }catch(e){setStatus("error");setError(e instanceof Error?e.message:"تعذر الاتصال بالـ API");}
  }
  useEffect(()=>{void loadInfo();void check()},[]);
  const siteApi = [
    ["الإشعارات", "GET", "/api/notifications"],
    ["تفعيل إشعارات الموبايل", "POST", "/api/push/subscribe"],
    ["إشعار الطلب", "POST", "/api/push/order"],
    ["تعبئة المحفظة", "POST", "/api/wallet/topup"],
    ["طلب تصميم موقع", "POST", "/api/web-dev/request"],
    ["طلب SatoFill", "POST", "/api/satofill/order"],
    ["تفاصيل طلب SatoFill", "GET", "/api/satofill/order/{orderNumber}"],
    ["المساعد الذكي", "POST", "/api/ai-chat"],
    ["رصيد SatoFill", "GET", "/api/satofill-balance"],
  ];
  return <main dir="rtl" className="admin-page space-y-6">
    <section className="admin-hero hero-rise"><div><span>API CENTER</span><h1>مركز الـ API 🔌</h1></div><div className="admin-hero-orb">🔌</div></section>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Stat icon="●" label="حالة الاتصال" value={status==='ok'?"متصل":status==='error'?"في مشكلة":"فحص..."} sub={checkedAt||"جارٍ الفحص"}/>
      <Stat icon="💰" label="رصيد API" value={status==='ok'?Number(balance?.balance??0).toFixed(5):"—"} sub="الرصيد الحالي من SatoFill"/>
      <Stat icon="🛍️" label="المنتجات" value={String(counts.products)} sub="متاحة عبر API"/>
    </section>
    <section className="admin-card">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="section-kicker">PROVIDER</span><h2>{info?.provider||"SatoFill"}</h2></div><span className={`api-status ${status}`}>{status==='ok'?"متصل":status==='error'?"في مشكلة":"جاري الفحص"}</span></div>
      {error&&<p className="mt-4 rounded-xl bg-red-950/40 p-3 text-xs font-bold text-red-300">{error}</p>}
      <button onClick={()=>void check()} className="admin-action mt-4">↻ فحص وتحديث المعلومات</button>
    </section>
    <section className="admin-card">
      <div className="mb-4"><span className="section-kicker">SITE API</span><h2>واجهات الـ API بالموقع</h2></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{siteApi.map(([label,method,path])=><div key={path} className="api-endpoint"><span><b>{label}</b><small>{path}</small></span><code>{method}</code></div>)}</div>
    </section>
  </main>
}
function Stat({icon,label,value,sub}:{icon:string;label:string;value:string;sub:string}){return <div className="admin-stat"><span>{icon}</span><div><p>{label}</p><b>{value}</b><small>{sub}</small></div></div>}
function Info({label,value}:{label:string;value:string}){return <div className="api-info"><span>{label}</span><b>{value}</b></div>}
