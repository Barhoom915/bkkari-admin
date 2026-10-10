import { NextResponse } from "next/server";
import { getAdminSession, getServiceClient } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: noStoreHeaders });

  const url = new URL(request.url);
  const allowed = new Set(["7", "30", "90"]);
  const days = allowed.has(url.searchParams.get("days") || "") ? Number(url.searchParams.get("days")) : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const db = getServiceClient();
    const { data, error } = await db
      .from("ai_usage_events")
      .select("id,created_at,user_id,feature,provider,model,status,latency_ms,input_tokens,output_tokens,total_tokens,cost_usd,cost_is_estimate,compared_product_ids,error_code")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      const missing = /does not exist|schema cache|could not find the table/i.test(error.message);
      return NextResponse.json({
        configured: false,
        schemaMissing: missing,
        error: missing ? "جدول تحليلات الذكاء الاصطناعي غير موجود بعد. طبّق ترحيل V71 من مستودع الإدارة وترحيل V98.29 من مستودع المتجر على مشروع Supabase نفسه." : "تعذر قراءة سجل الذكاء الاصطناعي.",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
        days,
      }, { status: missing ? 200 : 500, headers: noStoreHeaders });
    }

    const { data: limitRows, error: limitError } = await db
      .from("ai_usage_limits")
      .select("user_id,day_key,month_key,daily_count,monthly_count,minute_count,minute_started_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(500);

    const rows = data || [];
    const sum = (key: string) => rows.reduce((n: number, row: any) => n + Number(row[key] ?? 0), 0);
    const providers = new Map<string, { provider: string; requests: number; tokens: number; cost: number; successes: number; failures: number; cached: number }>();
    for (const row of rows as any[]) {
      const name = row.provider || "unknown";
      const current = providers.get(name) || { provider: name, requests: 0, tokens: 0, cost: 0, successes: 0, failures: 0, cached: 0 };
      current.requests++;
      current.tokens += Number(row.total_tokens ?? (Number(row.input_tokens || 0) + Number(row.output_tokens || 0)));
      current.cost += Number(row.cost_usd || 0);
      if (row.status === "success") current.successes++;
      if (row.status === "failed") current.failures++;
      if (row.status === "cached" || row.provider === "cache") current.cached++;
      providers.set(name, current);
    }
    const costs = rows.filter((r: any) => r.cost_usd != null);
    const knownCost = costs.reduce((n: number, r: any) => n + Number(r.cost_usd || 0), 0);
    const knownTokens = rows.filter((r: any) => r.total_tokens != null || r.input_tokens != null || r.output_tokens != null).length;
    return NextResponse.json({
      configured: true,
      days,
      summary: {
        requests: rows.length,
        success: rows.filter((r: any) => r.status === "success").length,
        failed: rows.filter((r: any) => r.status === "failed").length,
        cached: rows.filter((r: any) => r.status === "cached" || r.provider === "cache").length,
        inputTokens: sum("input_tokens"),
        outputTokens: sum("output_tokens"),
        totalTokens: rows.reduce((n: number, r: any) => n + Number(r.total_tokens ?? (Number(r.input_tokens || 0) + Number(r.output_tokens || 0))), 0),
        knownCostUsd: knownCost,
        costEvents: costs.length,
        estimatedCostEvents: rows.filter((r: any) => r.cost_is_estimate && r.cost_usd != null).length,
        tokenCoverage: rows.length ? knownTokens / rows.length : 0,
        averageLatencyMs: (() => { const measured = rows.filter((r: any) => r.latency_ms != null); return measured.length ? Math.round(measured.reduce((n: number, r: any) => n + Number(r.latency_ms), 0) / measured.length) : 0; })(),
      },
      providers: [...providers.values()].sort((a, b) => b.requests - a.requests),
      userLimits: limitError ? [] : (limitRows || []).map((r: any) => ({
        userId: r.user_id,
        dailyUsed: r.day_key === new Date().toISOString().slice(0, 10) ? Number(r.daily_count || 0) : 0,
        dailyLimit: 30,
        monthlyUsed: r.month_key === new Date().toISOString().slice(0, 7) + "-01" ? Number(r.monthly_count || 0) : 0,
        monthlyLimit: 300,
        minuteUsed: Date.now() - new Date(r.minute_started_at).getTime() < 60_000 ? Number(r.minute_count || 0) : 0,
        minuteLimit: 6,
        updatedAt: r.updated_at,
      })),
      userLimitsConfigured: !limitError,
      events: rows,
      note: "التكلفة المعروضة هي مجموع التكاليف المسجلة فقط، وليست رصيد مزود الخدمة أو فاتورته الرسمية.",
    }, { headers: noStoreHeaders });
  } catch {
    return NextResponse.json({ configured: false, error: "تعذر الاتصال بقاعدة البيانات أو إعدادات الخدمة غير مكتملة.", days }, { status: 500, headers: noStoreHeaders });
  }
}
