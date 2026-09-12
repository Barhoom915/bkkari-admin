import { NextResponse } from 'next/server';
import { getAdminSession, getServiceClient } from '@/app/lib/supabase-server';

const BUCKET = 'laptop-images';

async function ensureBucket(supabase: ReturnType<typeof getServiceClient>) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  });
}

export async function POST(request: Request) {
  const user = await getAdminSession();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  try {
    const form = await request.formData();
    const files = form.getAll('files').filter((x): x is File => x instanceof File);
    if (!files.length) return NextResponse.json({ error: 'ما تم اختيار أي صورة' }, { status: 400 });
    if (files.length > 12) return NextResponse.json({ error: 'الحد الأقصى 12 صورة' }, { status: 400 });
    const supabase = getServiceClient();
    await ensureBucket(supabase);
    const urls: string[] = [];
    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) return NextResponse.json({ error: `نوع الصورة غير مدعوم: ${file.name}` }, { status: 400 });
      if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: `الصورة ${file.name} أكبر من 10MB` }, { status: 400 });
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `laptops/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      urls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    }
    return NextResponse.json({ urls });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'تعذر رفع الصور' }, { status: 500 });
  }
}
