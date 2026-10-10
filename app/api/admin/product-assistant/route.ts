import { NextResponse } from 'next/server';
import { getAdminSession, getServiceClient } from '@/app/lib/supabase-server';

export const runtime = 'nodejs';

async function recordAiUsage(event: {
  provider: string;
  status: 'success' | 'failed';
  latencyMs: number;
  errorCode?: string;
}) {
  // Best-effort telemetry: analytics must never break the product assistant.
  try {
    const db = getServiceClient();
    await db.from('ai_usage_events').insert({
      feature: 'product_assistant',
      provider: event.provider,
      model: null,
      status: event.status,
      latency_ms: event.latencyMs,
      error_code: event.errorCode?.slice(0, 120) || null,
      cost_is_estimate: true,
    });
  } catch (error) {
    console.warn('[product-assistant:analytics] unable to record event', error instanceof Error ? error.message : 'unknown error');
  }
}

type ProviderResult = { provider: string; response: Response; parse: (data: any) => string | undefined };

function openAIProvider(args: {
  provider: string; url: string; key: string; model: string;
  headers?: Record<string, string>; prompt: string;
}): Promise<ProviderResult> {
  return fetch(args.url, {
    method: 'POST',
    signal: AbortSignal.timeout(25000),
    headers: {
      Authorization: `Bearer ${args.key}`,
      'Content-Type': 'application/json',
      ...args.headers,
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Return valid JSON only. Do not invent facts.' },
        { role: 'user', content: args.prompt },
      ],
    }),
    cache: 'no-store',
  }).then(response => ({
    provider: args.provider,
    response,
    parse: (data: any) => data.choices?.[0]?.message?.content,
  }));
}

async function getProviders(prompt: string): Promise<Array<() => Promise<ProviderResult>>> {
  const providers: Array<() => Promise<ProviderResult>> = [];
  const groq = process.env.GROQ_API_KEY;
  const openrouter = process.env.OPENROUTER_API_KEY;
  const gemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  // Ashna is supported only when its account provides an OpenAI-compatible API endpoint.
  const ashnaKey = process.env.ASHNA_API_KEY || process.env.ASHNA_API_TOKEN;
  const ashnaBase = (process.env.ASHNA_BASE_URL || process.env.ASHNA_API_BASE_URL)?.replace(/\/+$/, '');
  const ashnaModel = process.env.ASHNA_PRODUCT_MODEL || process.env.ASHNA_MODEL;

  if (groq) providers.push(() => openAIProvider({
    provider: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: groq,
    model: process.env.GROQ_PRODUCT_MODEL || 'llama-3.3-70b-versatile',
    prompt,
  }));
  if (openrouter) providers.push(() => openAIProvider({
    provider: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: openrouter,
    model: process.env.OPENROUTER_PRODUCT_MODEL || 'openai/gpt-4o-mini',
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://vercel.app',
      'X-Title': 'NOVATEK Admin',
    },
    prompt,
  }));
  if (gemini) providers.push(async () => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_PRODUCT_MODEL || 'gemini-2.0-flash')}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gemini },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
          contents: [{ parts: [{ text: prompt }] }],
        }),
        cache: 'no-store',
      },
    );
    return {
      provider: 'Gemini / Google AI Studio',
      response,
      parse: (data: any) => data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join(''),
    };
  });
  if (ashnaKey && ashnaBase && ashnaModel) providers.push(() => openAIProvider({
    provider: 'Ashna',
    url: `${ashnaBase}/chat/completions`,
    key: ashnaKey,
    model: ashnaModel,
    prompt,
  }));
  return providers;
}

export async function POST(request: Request) {
  const user = await getAdminSession();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  try {
    const body = await request.json();
    const action = String(body.action || 'review');
    const product = body.product || {};
    const facts = Object.fromEntries(
      ['name','brand','model','category','cpu','ram','storage','gpu','screen_size','screen_resolution','condition','battery_health','warranty_days','description','features']
        .map(key => [key, product[key] ?? '']),
    );
    if (!String(facts.name || '').trim()) {
      return NextResponse.json({ error: 'اكتب اسم المنتج أولاً حتى أقدر أساعدك بدقة.' }, { status: 400 });
    }

    const prompt = `أنت مدقق مواصفات ومساعد كتابة منتجات لمتجر NOVATEK. افحص كل الحقول وليس الشاشة فقط: الاسم، الشركة، الموديل، المعالج CPU، RAM، التخزين، GPU، حجم الشاشة ودقتها، حالة الجهاز، صحة البطارية، الضمان، التصنيف، الوصف والميزات. أعد JSON صالحاً فقط بالشكل {"name":"...","description":"...","features":["..."],"missing":["..."],"issues":["..."],"suggestions":[{"field":"cpu","label":"المعالج","current":"...","proposed":"...","reason":"...","confidence":"high|medium|verify"}]}. افحص كل معلومة بحثاً عن نقص أو صياغة غير معيارية أو تناقض أو خطأ محتمل، وأعطِ اقتراحاً ملاصقاً للحقل المناسب. ممنوع اختراع مواصفات أو استبدال موديل بمعالج آخر بالتخمين؛ مثال i5 10U لا يعني تلقائياً i5-10850U، ولا تقترح رقماً محدداً إلا إذا كان مؤكداً من مصدر موثوق مرفق ضمن البيانات أو من معرفة مؤكدة جداً. إذا لم تتأكد، اجعل proposed فارغاً واشرح ضرورة التحقق من موديل الجهاز الكامل/مصدر الشركة. لا تدّعِ أنك بحثت على الإنترنت ما لم تستخدم أداة بحث فعلية. اقتراحات التصحيح تشمل كل الحقول ذات الصلة، لا تقتصر على الشاشة. لا تملأ اقتراحاً لمجرد تغيير القيمة؛ أظهره فقط إذا توجد فائدة حقيقية. اللغة عربية واضحة واحترافية بلمسة تسويقية سورية، والإيموجي خفيف (0-3). action=${action}. إذا كان action=description أنشئ وصفاً جذاباً من الحقائق الموجودة فقط. إذا كان action=features رتّب الميزات من المعلومات الموجودة فقط. إذا كان action=review لا تعِد كتابة الحقول ولا تطبق تعديلات؛ أعطِ اقتراحات منفصلة وملاحظات ونواقص. لا تغيّر السعر أو المخزون أو الضمان. البيانات: ${JSON.stringify(facts)}`;

    const providers = await getProviders(prompt);
    // Keep a predictable provider order; each failed provider falls through to the next configured one.
    if (!providers.length) {
      return NextResponse.json({
        error: 'ما لقيت مفاتيح AI متاحة في بيئة الإدارة. أضف GROQ_API_KEY أو OPENROUTER_API_KEY أو GEMINI_API_KEY إلى Environment Variables في Vercel، ثم أعد النشر.',
      }, { status: 503 });
    }

    const failures: string[] = [];
    const configuredNames = [process.env.GROQ_API_KEY ? 'Groq' : null, process.env.OPENROUTER_API_KEY ? 'OpenRouter' : null, (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) ? 'Gemini / Google AI Studio' : null, (process.env.ASHNA_API_KEY || process.env.ASHNA_API_TOKEN) && (process.env.ASHNA_BASE_URL || process.env.ASHNA_API_BASE_URL) && (process.env.ASHNA_PRODUCT_MODEL || process.env.ASHNA_MODEL) ? 'Ashna' : null].filter(Boolean) as string[];
    for (let providerIndex = 0; providerIndex < providers.length; providerIndex++) {
      const createRequest = providers[providerIndex];
      let result: ProviderResult;
      const providerStartedAt = Date.now();
      try {
        result = await createRequest();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Network error';
        const failedProvider = configuredNames[providerIndex] || `المزوّد رقم ${providerIndex + 1}`;
        failures.push(`${failedProvider}: تعذر الاتصال (${message.slice(0, 120)})`);
        await recordAiUsage({ provider: failedProvider, status: 'failed', latencyMs: Date.now() - providerStartedAt, errorCode: 'network_error' });
        continue;
      }

      if (!result.response.ok) {
        const details = (await result.response.text()).slice(0, 350);
        console.error(`[product-assistant:${result.provider}] HTTP ${result.response.status}`, details);
        failures.push(`${result.provider}: HTTP ${result.response.status}`);
        await recordAiUsage({ provider: result.provider, status: 'failed', latencyMs: Date.now() - providerStartedAt, errorCode: `http_${result.response.status}` });
        // Try the next configured provider for unavailable model, auth, quota, or transient failures.
        continue;
      }

      try {
        const data: any = await result.response.json();
        const raw = result.parse(data);
        if (!raw) {
          failures.push(`${result.provider}: empty response`);
          continue;
        }
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(cleaned);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('AI response was not a JSON object');
        if (action === 'review') {
          const editableFields = new Set(['name','brand','model','category','cpu','ram','storage','gpu','screen_size','screen_resolution','condition','battery_health','description','features']);
          parsed.suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((item: any) => item && editableFields.has(item.field) && typeof item.reason === 'string').map((item: any) => ({ ...item, proposed: typeof item.proposed === 'string' ? item.proposed : '' })) : [];
          parsed.issues = Array.isArray(parsed.issues) ? parsed.issues.filter((x: any) => typeof x === 'string') : [];
          parsed.missing = Array.isArray(parsed.missing) ? parsed.missing.filter((x: any) => typeof x === 'string') : [];
        }
        await recordAiUsage({ provider: result.provider, status: 'success', latencyMs: Date.now() - providerStartedAt });
        return NextResponse.json({ data: { ...parsed, provider: result.provider, fallbackUsed: failures.length > 0, failedProviders: failures } });
      } catch (error) {
        console.error(`[product-assistant:${result.provider}] invalid response`, error);
        failures.push(`${result.provider}: invalid response`);
        await recordAiUsage({ provider: result.provider, status: 'failed', latencyMs: Date.now() - providerStartedAt, errorCode: 'invalid_response' });
      }
    }

    return NextResponse.json({
      error: `تعذر توليد النتيجة من مزوّدي AI المُعدّين. ${failures.join('؛ ')}`,
      providersTried: providers.length,
    }, { status: 502 });
  } catch (error) {
    console.error('[product-assistant]', error);
    return NextResponse.json({ error: 'تعذر تشغيل مساعد المنتجات حالياً.' }, { status: 500 });
  }
}
