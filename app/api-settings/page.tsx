"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Provider = { id:string; name:string; category:string; configured:boolean; envName?:string; state:string; latencyMs?:number; checkedAt?:string; detail?:string; error?:string; data?:Record<string,any>|null; };
const labels:Record<string,string>={connected:"متصل ويعمل",configured:"الإعداد موجود — لم يُفحص فعلياً",error:"فشل الاتصال",missing:"غير مضاف للإدارة",unknown:"الحالة غير معروفة",planned:"قريباً"};
const classes:Record<string,string>={connected:"ok",configured:"configured",error:"error",missing:"missing",unknown:"unknown",planned:"configured"};
const groups=[
 {id:"ai",title:"الذكاء الاصطناعي",subtitle:"5 خدمات للموديلات والردود الذكية",items:["xkiro","google-ai","ashna","groq","openrouter"]},
 {id:"search",title:"البحث والمقارنة",subtitle:"مصادر البحث ومعلومات المقارنة",items:["serpapi","tavily","syrimarket"]},
 {id:"digital",title:"المنتجات والخدمات الرقمية",subtitle:"تعبئة رقمية ومزوّدون حاليون وقادمون",items:["satofill","syrimarket","sw-games"]},
];
const catalog:Record<string,{name:string;category:string;desc:string;env:string;url:string;icon:string}>={
 xkiro:{name:"xKiro · Mistral Large 4",category:"الذكاء الاصطناعي",desc:"فحص اتصال آمن بواجهة الموديلات دون استهلاك توكنات محادثة؛ الرصيد والحصة يظهران فقط عند توفرهما رسمياً.",env:"XKIRO_API_KEY",url:"https://xkiro.com/",icon:"🧠"},
 "google-ai":{name:"Google AI Studio · Gemini",category:"الذكاء الاصطناعي",desc:"مفتاح Google AI / Gemini وفحص واجهة الموديلات عند توافره.",env:"GEMINI_API_KEY أو GOOGLE_AI_API_KEY أو GOOGLE_GENERATIVE_AI_API_KEY",url:"https://aistudio.google.com/",icon:"✨"},
 ashna:{name:"Ashna AI",category:"الذكاء الاصطناعي",desc:"تكامل Ashna؛ تفاصيل الحساب والاستهلاك تعتمد على API الرسمية المتاحة.",env:"ASHNA_API_KEY أو ASHNA_API_TOKEN",url:"https://app.ashna.ai/",icon:"🧠"},
 groq:{name:"Groq",category:"الذكاء الاصطناعي",desc:"فحص آمن لنقطة الموديلات، مع حدود الاستخدام إن رجعتها واجهة الحساب.",env:"GROQ_API_KEY",url:"https://console.groq.com/",icon:"⚡"},
 openrouter:{name:"OpenRouter",category:"الذكاء الاصطناعي",desc:"فحص المفتاح وبيانات الرصيد/الحد عند إتاحتها من واجهة الحساب الرسمية.",env:"OPENROUTER_API_KEY",url:"https://openrouter.ai/",icon:"🔀"},
 serpapi:{name:"SerpApi",category:"البحث والمقارنة",desc:"حصة البحث الشهرية والاستخدام والخطة والرصيد الإضافي من Account API.",env:"SERPAPI_API_KEY أو SERPAPI_KEY",url:"https://serpapi.com/",icon:"🔎"},
 tavily:{name:"Tavily",category:"البحث والمقارنة",desc:"مراقبة إعداد Tavily؛ لا نستهلك رصيد بحث بمجرد اختبار الاتصال.",env:"TAVILY_API_KEY",url:"https://app.tavily.com/",icon:"🌐"},
 syrimarket:{name:"SyriMarket",category:"المقارنة والمنتجات الرقمية",desc:"ربط SyriMarket؛ حالة الربط والاستخدام تظهر حسب واجهة المزوّد وإعدادات المشروع.",env:"SYRIMARKET_API_KEY أو SYRIMARKET_API_URL",url:"",icon:"🛍️"},
 satofill:{name:"SatoFill",category:"المنتجات والخدمات الرقمية",desc:"رصيد المزوّد المباشر وتكامل المنتجات الرقمية.",env:"SATOFILL_API_TOKEN",url:"https://satofill.com/",icon:"⚡"},
 "sw-games":{name:"SW-Games",category:"المنتجات والخدمات الرقمية",desc:"خدمة قادمة؛ صفحة المراقبة جاهزة، ولن تظهر متصلة قبل ربطها وفحصها.",env:"SW_GAMES_API_KEY أو SW_GAMES_API_TOKEN",url:"",icon:"🎮"}
};
function Icon({id}:{id:string}){return <span className="api-provider-icon">{catalog[id]?.icon||"🔌"}</span>}
export default function ApiSettings(){
 const [providers,setProviders]=useState<Provider[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [lastChecked,setLastChecked]=useState(""); const [refreshing,setRefreshing]=useState(false);
 const load=useCallback(async()=>{setRefreshing(true);setError("");try{const r=await fetch("/api/admin/integrations",{cache:"no-store"});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);setProviders(j.providers||[]);setLastChecked(j.checkedAt||new Date().toISOString());}catch(e){setError(e instanceof Error?e.message:"تعذر تحميل حالة التكاملات");}finally{setLoading(false);setRefreshing(false)}},[]);
 useEffect(()=>{void load()},[load]);
 const lookup=(id:string):Provider=>providers.find(p=>p.id===id)||{id,name:catalog[id]?.name||id,category:catalog[id]?.category||"تكامل",configured:false,envName:catalog[id]?.env,state:id==="sw-games"?"planned":"missing",detail:id==="sw-games"?"الخدمة قادمة ولم يتم تفعيل الربط بعد.":"لم يتم العثور على إعداد هذا المزوّد ضمن بيئة لوحة الإدارة."};
 const connected=providers.filter(p=>p.state==="connected").length; const missing=providers.filter(p=>p.state==="missing").length; const errors=providers.filter(p=>p.state==="error").length;
 return <main dir="rtl" className="admin-page space-y-6">
 <section className="admin-hero hero-rise"><div><span>API CONTROL CENTER · V72.0.6</span><h1>مركز إدارة ومراقبة الـ APIs 🔌</h1><p>اضغط على بطاقة أي خدمة للانتقال إلى صفحة تفاصيلها داخل لوحة NOVATEK نفسها، مع بقاء القائمة الجانبية والهيدر — بدون نافذة منبثقة أو تبويب جديد.</p></div><div className="admin-hero-orb">🔌</div></section>
 <section className="grid gap-3 sm:grid-cols-3"><Stat label="اتصالات مؤكدة" value={String(connected)} icon="🟢"/><Stat label="الخدمات في المركز" value="9" icon="🔌"/><Stat label="مفاتيح غير مضافة للإدارة" value={String(missing)} icon="🧩"/></section>
 <section className="admin-card"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="section-kicker">SERVICE MONITOR</span><h2>مزوّدو الخدمة</h2><p className="mt-1 text-sm text-ink-soft">آخر فحص: {lastChecked?new Date(lastChecked).toLocaleString("ar-SY"):"—"}. الاتصال الأخضر يظهر فقط بعد نجاح فحص فعلي. «غير مضاف للإدارة» لا يعني أن الخدمة متوقفة بالمتجر؛ لكل مشروع Vercel متغيرات بيئة منفصلة. حالات فشل الفحص: {errors}.</p></div><button disabled={refreshing} onClick={()=>void load()} className="admin-action disabled:opacity-50">{refreshing?"جارٍ الفحص…":"↻ تحديث وفحص الكل"}</button></div>
 {error&&<div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
 {loading?<div className="py-12 text-center text-ink-soft">جارٍ فحص التكاملات…</div>:groups.map(g=><div key={g.id} className="mt-7"><div className="mb-3"><h3 className="text-lg font-extrabold">{g.title}</h3><p className="mt-1 text-sm text-ink-soft">{g.subtitle}</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{g.items.map(id=>{const p=lookup(id);const meta=catalog[id];return <Link key={`${g.id}-${id}`} href={`/api-settings/${id}`} className="api-provider-card block text-right"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><Icon id={id}/><span className="min-w-0"><b className="block">{meta.name}</b><small className="mt-1 block text-ink-soft">{meta.category}</small></span></div><span className={`api-status ${classes[p.state]||"unknown"}`}>{labels[p.state]||p.state}</span></div><p className="mt-4 line-clamp-2 text-xs leading-5 text-ink-soft">{p.detail||meta.desc}</p><div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs"><span className="text-ink-soft">{p.latencyMs!==undefined?`زمن الفحص ${p.latencyMs} ms`:p.configured?"الإعداد موجود":"افتح صفحة التفاصيل"}</span><b className="text-orange-600">فتح صفحة الخدمة ←</b></div></Link>})}</div></div>)}
 <p className="mt-6 rounded-xl bg-orange-50 p-3 text-xs leading-6 text-orange-900">ملاحظة: صفحة التفاصيل داخل نفس الموقع. بيانات الرصيد والفوترة والتجديد لا تظهر إلا عندما يتيحها المزوّد عبر واجهته الرسمية وبصلاحيات صحيحة. لا يتم تنفيذ عمليات شراء أو بحث مدفوعة لمجرد اختبار الاتصال.</p></section>
 </main>
}
function Stat({label,value,icon}:{label:string;value:string;icon:string}){return <div className="admin-stat"><span>{icon}</span><div><p>{label}</p><b>{value}</b></div></div>}
