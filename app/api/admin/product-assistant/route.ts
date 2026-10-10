import { NextResponse } from 'next/server';
import { getAdminSession } from '@/app/lib/supabase-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getAdminSession();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  try {
    const body = await request.json();
    const action = String(body.action || 'review');
    const product = body.product || {};
    const facts = Object.fromEntries(['name','brand','model','category','cpu','ram','storage','gpu','screen_size','screen_resolution','condition','battery_health','price','warranty_days','description','features'].map(k => [k, product[k] ?? '']));
    if (!String(facts.name || '').trim()) return NextResponse.json({ error: 'اكتب اسم المنتج أولاً حتى أقدر أساعدك بدقة.' }, { status: 400 });
    const prompt = `أنت مساعد كتابة منتجات لمتجر سوري اسمه NOVATEK. اكتب عربية واضحة واحترافية بنبرة متجر تقنية موثوقة. التزم بالمعلومات المقدمة فقط: ممنوع اختراع مواصفات أو ضمان أو أداء أو ادعاءات. إذا نقصت معلومة اذكرها ضمن missing ولا تخمن. لا تغيّر السعر. أعد JSON صالحاً فقط بالشكل {"name":"...","description":"...","features":["..."],"missing":["..."],"issues":["..."]}. action=${action}. إذا كان action=description أنشئ وصفاً فقط اعتماداً على الحقائق. إذا كان action=features رتّب الميزات فقط اعتماداً على الحقائق. إذا كان action=review صحح صياغة الاسم والوصف والميزات ونبه إلى النواقص والتعارضات، ولا تضف مواصفات غير مذكورة. البيانات: ${JSON.stringify(facts)}`;
    let response: Response | null = null;
    let provider = '';
    const groq = process.env.GROQ_API_KEY;
    const openrouter = process.env.OPENROUTER_API_KEY;
    const gemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (groq) {
      provider = 'Groq';
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', { method:'POST', headers:{Authorization:`Bearer ${groq}`,'Content-Type':'application/json'}, body:JSON.stringify({model:process.env.GROQ_PRODUCT_MODEL || 'llama-3.3-70b-versatile',temperature:0.2,response_format:{type:'json_object'},messages:[{role:'system',content:'Return valid JSON only.'},{role:'user',content:prompt}]}), cache:'no-store' });
    } else if (openrouter) {
      provider = 'OpenRouter';
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method:'POST', headers:{Authorization:`Bearer ${openrouter}`,'Content-Type':'application/json','HTTP-Referer':process.env.NEXT_PUBLIC_SITE_URL || 'https://vercel.app','X-Title':'NOVATEK Admin'}, body:JSON.stringify({model:process.env.OPENROUTER_PRODUCT_MODEL || 'openai/gpt-4o-mini',temperature:0.2,response_format:{type:'json_object'},messages:[{role:'system',content:'Return valid JSON only.'},{role:'user',content:prompt}]}), cache:'no-store' });
    } else if (gemini) {
      provider = 'Gemini';
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(gemini)}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({generationConfig:{responseMimeType:'application/json',temperature:0.2},contents:[{parts:[{text:prompt}]}]}),cache:'no-store'});
    } else {
      return NextResponse.json({error:'ما لقيت مفتاحاً متاحاً للمساعد في بيئة الإدارة. أضف GROQ_API_KEY أو OPENROUTER_API_KEY أو GEMINI_API_KEY إلى Vercel ثم أعد النشر.'}, {status:503});
    }
    if (!response.ok) {
      const details = await response.text();
      console.error(`[product-assistant:${provider}]`, response.status, details.slice(0,500));
      return NextResponse.json({error:`فشل طلب المساعد عبر ${provider} (HTTP ${response.status}). تحقق من المفتاح وحدود الاستخدام.`},{status:502});
    }
    const data:any = await response.json();
    const raw = provider === 'Gemini' ? data.candidates?.[0]?.content?.parts?.[0]?.text : data.choices?.[0]?.message?.content;
    if (!raw) return NextResponse.json({error:`لم يرجع ${provider} نتيجة قابلة للقراءة.`},{status:502});
    let result:any;
    try { result = JSON.parse(raw); } catch { return NextResponse.json({error:'رجع المساعد نتيجة غير صالحة. جرّب مرة أخرى.'},{status:502}); }
    return NextResponse.json({data:{...result,provider}});
  } catch (error) {
    console.error('[product-assistant]', error);
    return NextResponse.json({error:'تعذر تشغيل مساعد المنتجات حالياً.'},{status:500});
  }
}
