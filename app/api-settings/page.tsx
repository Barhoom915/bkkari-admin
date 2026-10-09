"use client";
import { useCallback, useEffect, useState } from "react";

type Probe={id:string;label:string;detail:string;state:"checking"|"ok"|"error";ms?:number;checkedAt?:string;message?:string;count?:number};
type ApiInfo={configured:boolean;provider:string;type:string;baseUrl:string;auth:string;tokenPreview:string|null;endpoints:{label:string;method:string;path:string}[]};
const initial:Probe[]=[
 {id:"balance",label:"SatoFill — الرصيد",detail:"فحص حقيقي عبر خادم لوحة الإدارة",state:"checking"},
 {id:"categories",label:"SatoFill — الأقسام",detail:"قراءة بيانات الأقسام",state:"checking"},
 {id:"products",label:"SatoFill — المنتجات",detail:"قراءة قائمة المنتجات",state:"checking"},
 {id:"settings",label:"إعدادات API",detail:"فحص واجهة الإدارة الداخلية",state:"checking"},
];
export default function ApiSettings(){
 const [probes,setProbes]=useState<Probe[]>(initial); const [info,setInfo]=useState<ApiInfo|null>(null); const [running,setRunning]=useState(false); const [lastRun,setLastRun]=useState("");
 const run=useCallback(async()=>{setRunning(true);setProbes(initial.map(x=>({...x,state:"checking"})));const results=await Promise.all([
  {id:"balance",url:"/api/satofill-balance",validate:(j:any,r:Response)=>{if(!r.ok||j.ok!==true)throw Error(j.error||`HTTP ${r.status}`);return `الرصيد: ${j.balance?.balance??j.balance??"تم الاتصال"}`}},
  {id:"categories",url:"/api/admin/satofill/categories",validate:(j:any,r:Response)=>{if(!r.ok)throw Error(j.error||`HTTP ${r.status}`);if(j.error)throw Error(j.error);return `${Array.isArray(j.data)?j.data.length:0} قسم`}},
  {id:"products",url:"/api/admin/satofill/products",validate:(j:any,r:Response)=>{if(!r.ok)throw Error(j.error||`HTTP ${r.status}`);if(j.error)throw Error(j.error);return `${Array.isArray(j.data)?j.data.length:0} منتج`}},
  {id:"settings",url:"/api/admin/satofill/info",validate:(j:any,r:Response)=>{if(!r.ok)throw Error(j.error||`HTTP ${r.status}`);if(!j.configured)throw Error("رمز SATOFILL_API_TOKEN غير مضبوط على الخادم");return "إعدادات التكامل متاحة"}},
 ].map(async item=>{const start=performance.now();try{const r=await fetch(item.url,{cache:"no-store"});const j=await r.json().catch(()=>({}));const message=item.validate(j,r);return {id:item.id,state:"ok" as const,ms:Math.round(performance.now()-start),checkedAt:new Date().toLocaleString("ar-SY"),message}}catch(e){return {id:item.id,state:"error" as const,ms:Math.round(performance.now()-start),checkedAt:new Date().toLocaleString("ar-SY"),message:e instanceof Error?e.message:"فشل الفحص"}}}));
 setProbes(initial.map(p=>({...p,...results.find(r=>r.id===p.id)})));setLastRun(new Date().toLocaleString("ar-SY"));setRunning(false);
 },[]);
 useEffect(()=>{void (async()=>{try{const r=await fetch("/api/admin/satofill/info",{cache:"no-store"});if(r.ok)setInfo(await r.json())}catch{};await run()})()},[run]);
 const ok=probes.filter(p=>p.state==="ok").length, bad=probes.filter(p=>p.state==="error").length;
 return <main dir="rtl" className="admin-page space-y-6">
  <section className="admin-hero hero-rise"><div><span>API CONTROL CENTER · V72.0.5</span><h1>مركز مراقبة الـ API 🔌</h1><p>مراقبة فعلية للتكاملات التي يمكن فحصها من لوحة الإدارة. الحالات لا تتحول إلى «متصل» إلا بعد نجاح الطلب والتحقق من استجابته.</p></div><div className="admin-hero-orb">🔌</div></section>
  <section className="grid gap-3 sm:grid-cols-3"><Stat label="فحوصات ناجحة" value={`${ok}/${probes.length}`} icon="🟢"/><Stat label="تحتاج مراجعة" value={String(bad)} icon="🚨"/><Stat label="آخر فحص" value={lastRun||"جارٍ الفحص"} icon="🕒"/></section>
  <section className="admin-card"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="section-kicker">LIVE DIAGNOSTICS</span><h2>حالة التكاملات</h2><p className="mt-1 text-sm text-ink-soft">زمن الاستجابة مقاس من المتصفح ويشمل الشبكة والـ API الداخلي.</p></div><button disabled={running} onClick={()=>void run()} className="admin-action disabled:opacity-50">{running?"جارٍ الفحص…":"↻ فحص كل الخدمات"}</button></div>
   <div className="mt-5 grid gap-3 md:grid-cols-2">{probes.map(p=><article key={p.id} className="api-endpoint !block"><div className="flex items-start justify-between gap-3"><div><b>{p.label}</b><p className="mt-1 text-xs text-ink-soft">{p.detail}</p></div><span className={`api-status ${p.state}`}>{p.state==="checking"?"يفحص…":p.state==="ok"?"ناجح":"فشل"}</span></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className={`text-sm font-bold ${p.state==="error"?"text-red-600":"text-ink"}`}>{p.message||"بانتظار نتيجة الفحص"}</span>{p.ms!==undefined&&<code>{p.ms} ms</code>}</div>{p.checkedAt&&<small className="mt-2 block text-ink-soft">آخر فحص: {p.checkedAt}</small>}</article>)}</div>
  </section>
  <section className="admin-card"><span className="section-kicker">PROVIDER CONFIGURATION</span><h2>{info?.provider||"SatoFill"}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="النوع" value={info?.type||"REST API"}/><Info label="العنوان الأساسي" value={info?.baseUrl||"غير متاح"}/><Info label="المصادقة" value={info?.auth||"جارٍ التحميل"}/><Info label="حالة الإعداد" value={info?.configured?"رمز API مضبوط":"رمز API غير مضبوط أو لم تُحمّل الإعدادات"}/></div><p className="mt-4 rounded-xl bg-orange-50 p-3 text-xs leading-6 text-orange-900">للحماية، لا يتم عرض الرمز السري كاملاً. نجاح الفحص لا يعني أن كل أنواع الطلبات المدفوعة تعمل؛ إنشاء الطلبات لا يُختبر تلقائياً حتى لا تُنشأ عمليات حقيقية بالخطأ.</p></section>
  <section className="admin-card"><div className="mb-4"><span className="section-kicker">KNOWN STORE ENDPOINTS</span><h2>واجهات المتجر المعروفة من تكاملات المشروع</h2><p className="mt-1 text-xs text-ink-soft">هذه قائمة توثيقية للمسارات المعروفة وليست ادعاءً أن كل مسار تم اختباره من هنا.</p></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(info?.endpoints||[]).map((e)=><div key={`${e.method}:${e.path}`} className="api-endpoint"><span><b>{e.label}</b><small>{e.path}</small></span><code>{e.method}</code></div>)}</div></section>
 </main>
}
function Stat({label,value,icon}:{label:string;value:string;icon:string}){return <div className="admin-stat"><span>{icon}</span><div><p>{label}</p><b>{value}</b></div></div>}
function Info({label,value}:{label:string;value:string}){return <div className="api-info"><span>{label}</span><b className="break-all text-left">{value}</b></div>}
