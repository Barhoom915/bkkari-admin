import { NextResponse } from "next/server";
import { getAdminSession, getServiceClient } from "@/app/lib/supabase-server";
import { satofill } from "@/app/lib/satofill";

export const dynamic = "force-dynamic";

const envValue = (...names: string[]) => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return { name, value };
  }
  return null;
};

async function timed<T>(fn: () => Promise<T>) {
  const started = Date.now();
  try {
    const data = await fn();
    return { ok: true as const, ms: Date.now() - started, data };
  } catch (error) {
    return { ok: false as const, ms: Date.now() - started, error: safeError(error) };
  }
}
function safeError(error: unknown) {
  const raw = error instanceof Error ? error.message : "فشل الاتصال بالخدمة";
  return raw.replace(/(api[_-]?key|token|secret|authorization)[=: ]+[^\s&,;]+/ig, "$1=[REDACTED]").slice(0, 220);
}

async function serpAccount() {
  const key = envValue("SERPAPI_API_KEY", "SERPAPI_KEY");
  if (!key) return { id: "serpapi", name: "SerpApi", category: "بحث الويب", configured: false, state: "missing", envName: "SERPAPI_API_KEY أو SERPAPI_KEY", detail: "أضف المفتاح إلى متغيرات بيئة مشروع لوحة الإدارة على الاستضافة، وليس إلى الواجهة الأمامية." };
  const probe = await timed(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const url = new URL("https://serpapi.com/account.json");
      url.searchParams.set("api_key", key.value);
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      const body: any = await response.json().catch(() => ({}));
      if (!response.ok || body.error) throw new Error(body.error || `SerpApi HTTP ${response.status}`);
      return {
        accountEmail: typeof body.account_email === "string" ? body.account_email : null,
        accountStatus: typeof body.account_status === "string" ? body.account_status : null,
        planName: typeof body.plan_name === "string" ? body.plan_name : null,
        monthlyPrice: typeof body.plan_monthly_price === "number" ? body.plan_monthly_price : null,
        searchesPerMonth: typeof body.searches_per_month === "number" ? body.searches_per_month : null,
        usedThisMonth: typeof body.this_month_usage === "number" ? body.this_month_usage : null,
        searchesLeft: typeof body.plan_searches_left === "number" ? body.plan_searches_left : null,
        totalSearchesLeft: typeof body.total_searches_left === "number" ? body.total_searches_left : null,
        extraCredits: typeof body.extra_credits === "number" ? body.extra_credits : null,
        searchesThisHour: typeof body.this_hour_searches === "number" ? body.this_hour_searches : null,
        lastHourSearches: typeof body.last_hour_searches === "number" ? body.last_hour_searches : null,
        hourlyLimit: typeof body.account_rate_limit_per_hour === "number" ? body.account_rate_limit_per_hour : null,
        renewalDate: typeof body.plan_renewal_date === "string" ? body.plan_renewal_date : null,
      };
    } finally { clearTimeout(timeout); }
  });
  return { id: "serpapi", name: "SerpApi", category: "بحث الويب", configured: true, envName: key.name, state: probe.ok ? "connected" : "error", latencyMs: probe.ms, checkedAt: new Date().toISOString(), data: probe.ok ? probe.data : null, error: probe.ok ? null : probe.error, detail: probe.ok ? "تم جلب معلومات الحساب والحصة مباشرة من Account API الرسمي." : probe.error };
}

async function getInventory() {
  const [serp, satofillProbe, supabaseProbe] = await Promise.all([
    serpAccount(),
    envValue("SATOFILL_API_TOKEN") ? timed(() => satofill.getBalance()) : Promise.resolve({ ok: false as const, ms: 0, error: "SATOFILL_API_TOKEN غير مضبوط" }),
    (envValue("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY") && envValue("NEXT_PUBLIC_SUPABASE_URL") && envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
      ? timed(async () => { const result = await getServiceClient().auth.admin.listUsers({ page: 1, perPage: 1 }); if (result.error) throw result.error; return { reachable: true }; })
      : Promise.resolve({ ok: false as const, ms: 0, error: "إعدادات Supabase غير مكتملة" }),
  ]);
  const optional = [
    { id: "google-ai", name: "Google AI Studio · Gemini", category: "ذكاء اصطناعي", vars: ["GEMINI_API_KEY", "GOOGLE_AI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"], note: "تم العثور على مفتاح Google؛ لم يتم اختبار الاتصال بعد." },
    { id: "ashna", name: "Ashna AI", category: "ذكاء اصطناعي", vars: ["ASHNA_API_KEY", "ASHNA_API_TOKEN"], note: "يتطلب فحص الاتصال عنوان API متوافقاً مع OpenAI وموديل محدداً؛ لا يُفترض endpoint غير موثق." },
    { id: "groq", name: "Groq", category: "ذكاء اصطناعي", vars: ["GROQ_API_KEY"], note: "تم العثور على مفتاح Groq؛ جارٍ فحص endpoint الموديلات." },
    { id: "openrouter", name: "OpenRouter", category: "ذكاء اصطناعي", vars: ["OPENROUTER_API_KEY"], note: "تم العثور على مفتاح OpenRouter؛ سيتم عرض معلومات الحساب التي يعيدها endpoint الرسمي." },
    { id: "tavily", name: "Tavily", category: "بحث ومقارنة", vars: ["TAVILY_API_KEY"], note: "تم العثور على مفتاح Tavily. لم يتم إرسال بحث مدفوع لمجرد الفحص." },
    { id: "syrimarket", name: "SyriMarket", category: "بحث ومقارنة ومنتجات رقمية", vars: ["SYRIMARKET_API_KEY", "SYRIMARKET_API_URL"], note: "تم العثور على إعداد SyriMarket؛ حالة الرصيد والاستخدام تعتمد على API المزود." },
    { id: "sw-games", name: "SW-Games", category: "المنتجات والخدمات الرقمية", vars: ["SW_GAMES_API_KEY", "SW_GAMES_API_TOKEN"], note: "خدمة قادمة. لن تظهر متصلة قبل إعدادها وإجراء فحص فعلي." },
    { id: "openai", name: "OpenAI", category: "ذكاء اصطناعي", vars: ["OPENAI_API_KEY"], note: "وجود المفتاح لا يكشف الفوترة. تفاصيل الاستخدام تحتاج صلاحيات وواجهة Usage/Billing المناسبة للحساب." },
    { id: "anthropic", name: "Anthropic", category: "ذكاء اصطناعي", vars: ["ANTHROPIC_API_KEY"], note: "المفتاح مضبوط؛ بيانات الفوترة لا تتوفر لكل المفاتيح عبر واجهة الاستخدام العادية." },
    { id: "stripe", name: "Stripe", category: "الدفع", vars: ["STRIPE_SECRET_KEY"], note: "لا يتم إجراء أي عملية دفع تجريبية؛ يلزم فحص آمن مخصص عند تفعيل التكامل." },
    { id: "resend", name: "Resend", category: "البريد الإلكتروني", vars: ["RESEND_API_KEY"], note: "المفتاح مضبوط؛ لم يتم إرسال بريد تجريبي لتجنب إرسال رسائل فعلية." },
    { id: "cloudinary", name: "Cloudinary", category: "الصور والملفات", vars: ["CLOUDINARY_API_KEY", "CLOUDINARY_URL"], note: "الإعداد موجود؛ فحص الحساب الكامل قد يحتاج API secret واسم الحساب." },
  ];
  const knownOptional = await Promise.all(optional.map(async (p) => {
    const found = envValue(...p.vars);
    if (!found) return { id: p.id, name: p.name, category: p.category, configured: false, envName: p.vars.join(" أو "), state: p.id === "sw-games" ? "planned" : "missing", detail: p.id === "sw-games" ? p.note : `لم يتم العثور على ${p.vars.join(" / ")} في بيئة نشر لوحة الإدارة. هذا لا يعني أن الخدمة متوقفة في المتجر؛ بيئة المتجر والإدارة منفصلتان على Vercel. أضف المتغيرات هنا فقط إذا أردت فحصها من لوحة الإدارة.` };
    if (p.id === "ashna") {
      const base = envValue("ASHNA_BASE_URL", "ASHNA_API_BASE_URL");
      const model = envValue("ASHNA_PRODUCT_MODEL", "ASHNA_MODEL");
      return { id:p.id,name:p.name,category:p.category,configured:true,envName:found.name,state:base && model ? "configured" : "partial",checkedAt:new Date().toISOString(),detail:base && model ? "مفتاح + endpoint + موديل موجودة. لم يُنفّذ اختبار اتصال لأن توافق Ashna يعتمد على endpoint الحساب الفعلي؛ جرّب مساعد المنتجات لتأكيد نجاح الاستدعاء." : "المفتاح موجود، لكن مساعد المنتجات يحتاج ASHNA_BASE_URL (أو ASHNA_API_BASE_URL) و ASHNA_PRODUCT_MODEL (أو ASHNA_MODEL). لا يمكن تأكيد الاتصال بمجرد وجود المفتاح." };
    }
    if (p.id === "syrimarket") {
      const base = (envValue("SYRIMARKET_API_URL")?.value || "https://api.syrimarket.com").replace(/\/+$/, "");
      const probe = await timed(async () => {
        const headers = { Authorization: `Bearer ${found.value}`, Accept: "application/json" };
        const profileResponse = await fetch(`${base}/client/api/v1/profile`, { headers, cache: "no-store", signal: AbortSignal.timeout(9000) });
        const profile: any = await profileResponse.json().catch(() => ({}));
        if (!profileResponse.ok || profile.success === false) {
          const code = typeof profile.code === "number" ? profile.code : profileResponse.status;
          throw new Error(`SyriMarket profile check failed (HTTP ${profileResponse.status}, code ${code})`);
        }
        const productsResponse = await fetch(`${base}/client/api/v1/catalog/products`, { headers, cache: "no-store", signal: AbortSignal.timeout(9000) });
        const products: any = await productsResponse.json().catch(() => ({}));
        if (!productsResponse.ok || products.success === false) {
          const code = typeof products.code === "number" ? products.code : productsResponse.status;
          throw new Error(`SyriMarket products check failed (HTTP ${productsResponse.status}, code ${code})`);
        }
        const list = Array.isArray(products.data) ? products.data : Array.isArray(products.products) ? products.products : Array.isArray(products.data?.products) ? products.data.products : null;
        return { profileReachable: true, productsEndpointReachable: true, productCount: list ? list.length : null };
      });
      return { id:p.id,name:p.name,category:p.category,configured:true,envName:found.name,state:probe.ok?"connected":"error",latencyMs:probe.ms,checkedAt:new Date().toISOString(),data:probe.ok?probe.data:null,error:probe.ok?null:probe.error,detail:probe.ok?"نجح فحص واجهة الحساب والمنتجات دون تنفيذ أي عملية شراء.":probe.error };
    }
    if (p.id === "google-ai") {
      const probe = await timed(async () => {
        const url = new URL("https://generativelanguage.googleapis.com/v1beta/models"); url.searchParams.set("key", found.value);
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
        const body: any = await response.json().catch(() => ({}));
        if (!response.ok || body.error) throw new Error(body.error?.message || `Google API HTTP ${response.status}`);
        return { modelsAvailable: Array.isArray(body.models) ? body.models.length : null };
      });
      return { id:p.id,name:p.name,category:p.category,configured:true,envName:found.name,state:probe.ok?"connected":"error",latencyMs:probe.ms,checkedAt:new Date().toISOString(),data:probe.ok?probe.data:null,error:probe.ok?null:probe.error,detail:probe.ok?`نجح الاتصال بواجهة Google؛ عدد الموديلات المعادة: ${probe.data.modelsAvailable ?? "غير متاح"}.`:probe.error };
    }
    if (p.id === "groq") {
      const probe = await timed(async () => { const response = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${found.value}` }, cache:"no-store", signal:AbortSignal.timeout(8000) }); const body:any=await response.json().catch(()=>({})); if(!response.ok) throw new Error(body.error?.message||`Groq HTTP ${response.status}`); return { modelsAvailable:Array.isArray(body.data)?body.data.length:null }; });
      return { id:p.id,name:p.name,category:p.category,configured:true,envName:found.name,state:probe.ok?"connected":"error",latencyMs:probe.ms,checkedAt:new Date().toISOString(),data:probe.ok?probe.data:null,error:probe.ok?null:probe.error,detail:probe.ok?`نجح فحص Groq. الموديلات المتاحة: ${probe.data.modelsAvailable ?? "غير متاح"}.`:probe.error };
    }
    if (p.id === "openrouter") {
      const probe = await timed(async () => { const response=await fetch("https://openrouter.ai/api/v1/key",{headers:{Authorization:`Bearer ${found.value}`},cache:"no-store",signal:AbortSignal.timeout(8000)});const body:any=await response.json().catch(()=>({}));if(!response.ok||body.error)throw new Error(body.error?.message||`OpenRouter HTTP ${response.status}`);const d=body.data||{};return {label:d.label??null,limit:d.limit??null,usage:d.usage??null,remaining:d.limit_remaining??null,isFreeTier:d.is_free_tier??null}; });
      return { id:p.id,name:p.name,category:p.category,configured:true,envName:found.name,state:probe.ok?"connected":"error",latencyMs:probe.ms,checkedAt:new Date().toISOString(),data:probe.ok?probe.data:null,error:probe.ok?null:probe.error,detail:probe.ok?"نجح فحص المفتاح وجلب معلومات الحد/الاستخدام المتاحة من OpenRouter.":probe.error };
    }
    return { id: p.id, name: p.name, category: p.category, configured: true, envName: found.name, state: "configured", detail: `${p.note} تم العثور على الإعداد في بيئة الإدارة فقط؛ هذه الحالة لا تعني أن الاتصال تم اختباره أو أن الخدمة تعمل.` };
  }));
  const push = envValue("NEXT_PUBLIC_VAPID_PUBLIC_KEY") && envValue("VAPID_PRIVATE_KEY") && envValue("VAPID_SUBJECT");
  const inventory = [
    { ...serp },
    { id: "satofill", name: "SatoFill", category: "الخدمات الرقمية", configured: Boolean(envValue("SATOFILL_API_TOKEN")), envName: "SATOFILL_API_TOKEN", state: satofillProbe.ok ? "connected" : (envValue("SATOFILL_API_TOKEN") ? "error" : "missing"), latencyMs: satofillProbe.ms, checkedAt: new Date().toISOString(), data: satofillProbe.ok ? satofillProbe.data : null, error: satofillProbe.ok ? null : satofillProbe.error, detail: satofillProbe.ok ? "نجح استعلام الرصيد المباشر." : satofillProbe.error },
    { id: "supabase", name: "Supabase", category: "قاعدة البيانات والمصادقة", configured: Boolean(envValue("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY") && envValue("NEXT_PUBLIC_SUPABASE_URL") && envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY")), envName: "Supabase URL + server key", state: supabaseProbe.ok ? "connected" : (envValue("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY") ? "error" : "missing"), latencyMs: supabaseProbe.ms, checkedAt: new Date().toISOString(), data: supabaseProbe.ok ? { reachable: true } : null, error: supabaseProbe.ok ? null : supabaseProbe.error, detail: supabaseProbe.ok ? "نجح فحص مصادقة الإدارة بقراءة آمنة من صفحة واحدة." : supabaseProbe.error },
    { id: "webpush", name: "Web Push", category: "الإشعارات", configured: Boolean(push), envName: "VAPID public/private/subject", state: push ? "configured" : "missing", detail: push ? "إعدادات VAPID موجودة؛ لم يتم إرسال إشعار تجريبي." : "إعدادات VAPID غير مكتملة." },
    ...knownOptional,
  ];
  return inventory;
}

export async function GET(request: Request) {
  const user = await getAdminSession();
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  try {
    const inventory = await getInventory();
    const provider = new URL(request.url).searchParams.get("provider");
    if (provider) {
      const selected = inventory.find((item: any) => item.id === provider);
      if (!selected) return NextResponse.json({ error: "التكامل غير معروف" }, { status: 404 });
      return NextResponse.json({ provider: selected, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ providers: inventory, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
