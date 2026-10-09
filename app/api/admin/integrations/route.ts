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
  try { return { ok: true as const, ms: Date.now() - started, data: await fn() }; }
  catch (error) { return { ok: false as const, ms: Date.now() - started, error: safeError(error) }; }
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
    { id: "openai", name: "OpenAI", category: "ذكاء اصطناعي", vars: ["OPENAI_API_KEY"], note: "وجود المفتاح لا يكشف الفوترة. تفاصيل الاستخدام تحتاج صلاحيات وواجهة Usage/Billing المناسبة للحساب." },
    { id: "gemini", name: "Google Gemini", category: "ذكاء اصطناعي", vars: ["GEMINI_API_KEY", "GOOGLE_AI_API_KEY"], note: "المفتاح مضبوط؛ فحص الرصيد/الفوترة يعتمد على إعدادات Google Cloud وصلاحيات الحساب." },
    { id: "anthropic", name: "Anthropic", category: "ذكاء اصطناعي", vars: ["ANTHROPIC_API_KEY"], note: "المفتاح مضبوط؛ بيانات الفوترة لا تتوفر لكل المفاتيح عبر واجهة الاستخدام العادية." },
    { id: "stripe", name: "Stripe", category: "الدفع", vars: ["STRIPE_SECRET_KEY"], note: "لا يتم إجراء أي عملية دفع تجريبية؛ يلزم فحص آمن مخصص عند تفعيل التكامل." },
    { id: "resend", name: "Resend", category: "البريد الإلكتروني", vars: ["RESEND_API_KEY"], note: "المفتاح مضبوط؛ لم يتم إرسال بريد تجريبي لتجنب إرسال رسائل فعلية." },
    { id: "cloudinary", name: "Cloudinary", category: "الصور والملفات", vars: ["CLOUDINARY_API_KEY", "CLOUDINARY_URL"], note: "الإعداد موجود؛ فحص الحساب الكامل قد يحتاج API secret واسم الحساب." },
  ];
  const knownOptional = optional.map(p => {
    const found = envValue(...p.vars);
    return { id: p.id, name: p.name, category: p.category, configured: Boolean(found), envName: found?.name || p.vars.join(" أو "), state: found ? "configured" : "missing", detail: found ? p.note : `لم يتم العثور على ${p.vars.join(" / ")} في بيئة لوحة الإدارة.` };
  });
  const push = envValue("NEXT_PUBLIC_VAPID_PUBLIC_KEY") && envValue("VAPID_PRIVATE_KEY") && envValue("VAPID_SUBJECT");
  const inventory = [
    { id: "serpapi", name: "SerpApi", category: "بحث الويب", ...serp },
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
