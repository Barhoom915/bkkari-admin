import { NextResponse } from 'next/server';
import { getAdminSession } from '@/app/lib/supabase-server';

export const runtime = 'nodejs';

type ProviderResult = { provider: string; response: Response; parse: (data: any) => string | undefined };

function openAIProvider(args: {
  provider: string; url: string; key: string; model: string;
  headers?: Record<string, string>; prompt: string;
}): Promise<ProviderResult> {
  return fetch(args.url, {
    method: 'POST',
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
  const ashnaKey = process.env.ASHNA_API_KEY;
  const ashnaBase = process.env.ASHNA_BASE_URL?.replace(/\/+$/, '');
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
      ['name','brand','model','category','cpu','ram','storage','gpu','screen_size','screen_resolution','condition','battery_health','price','warranty_days','description','features']
        .map(key => [key, product[key] ?? '']),
    );
    if (!String(facts.name || '').trim()) {
      return NextResponse.json({ error: 'اكتب اسم المنتج أولاً حتى أقدر أساعدك بدقة.' }, { status: 400 });
    }

    const prompt = `أنت مساعد كتابة ومراجعة منتجات لمتجر سوري اسمه NOVATEK. اكتب عربية واضحة واحترافية بلمسة تسويقية لطيفة وإيموجي قليل جداً (0-3 فقط عند ملاءمتها)، ويمكن استخدام تنسيق جذاب بعناوين ونقاط. التزم بالحقائق المقدمة فقط: ممنوع اختراع مواصفات أو ضمان أو أداء أو أبعاد أو ادعاءات. إذا كانت قيمة مثل دقة الشاشة تبدو ناقصة أو غريبة، لا تستبدلها بتخمين؛ اقترح التحقق منها، واذكر قيمة بديلة فقط إن كانت مؤكدة من البيانات المتاحة، وإلا اجعل proposed فارغاً واكتب سبباً واضحاً. أعد JSON صالحاً فقط بالشكل {"name":"...","description":"...","features":["..."],"missing":["..."],"issues":["..."],"suggestions":[{"field":"screen_resolution","label":"دقة الشاشة","current":"...","proposed":"...","reason":"...","confidence":"high|medium|verify"}]}. suggestions يجب أن تكون اقتراحات محددة مرتبطة بحقل موجود، ولا تملأ proposed إذا لم تكن متأكداً. action=${action}. إذا كان action=description أنشئ وصفاً جذاباً اعتماداً على الحقائق فقط، بتنسيق سهل القراءة وإيموجي قليل. إذا كان action=features رتّب الميزات بنقاط واضحة. إذا كان action=review لا تعِد كتابة حقول المنتج ولا تفرض التعديلات؛ أعطِ اقتراحات منفصلة فقط، مع الملاحظات والنواقص. لا تغيّر السعر أو المخزون. البيانات: ${JSON.stringify(facts)}`;

    const providers = await getProviders(prompt);
    if (!providers.length) {
      return NextResponse.json({
        error: 'ما لقيت مفاتيح AI متاحة في بيئة الإدارة. أضف GROQ_API_KEY أو OPENROUTER_API_KEY أو GEMINI_API_KEY إلى Environment Variables في Vercel، ثم أعد النشر.',
      }, { status: 503 });
    }

    const failures: string[] = [];
    for (let providerIndex = 0; providerIndex < providers.length; providerIndex++) {
      const createRequest = providers[providerIndex];
      let result: ProviderResult;
      try {
        result = await createRequest();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Network error';
        failures.push(`المزوّد رقم ${providerIndex + 1}: تعذر الاتصال (${message.slice(0, 120)})`);
        continue;
      }

      if (!result.response.ok) {
        const details = (await result.response.text()).slice(0, 350);
        console.error(`[product-assistant:${result.provider}] HTTP ${result.response.status}`, details);
        failures.push(`${result.provider}: HTTP ${result.response.status}`);
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
        const parsed = JSON.parse(raw);
        return NextResponse.json({ data: { ...parsed, provider: result.provider, fallbackUsed: failures.length > 0 } });
      } catch (error) {
        console.error(`[product-assistant:${result.provider}] invalid response`, error);
        failures.push(`${result.provider}: invalid response`);
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
