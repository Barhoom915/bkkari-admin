import { NextResponse } from 'next/server';
import { getAdminSession, getServiceClient } from '@/app/lib/supabase-server';

const BUCKET = 'laptop-images';
const TYPES = ['image/jpeg','image/png','image/webp','image/avif'];

export async function POST(request: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  try {
    const body = await request.json();
    const contentType = String(body.contentType || 'image/jpeg');
    if (!TYPES.includes(contentType)) return NextResponse.json({ error: 'صيغة الصورة غير مدعومة' }, { status: 400 });
    const ext = String(body.extension || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
    const path = `laptops/${crypto.randomUUID()}.${ext}`;
    const supabase = getServiceClient();
    const { data: bucket } = await supabase.storage.getBucket(BUCKET);
    if (!bucket) await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: TYPES });
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ path, token: data.token, url });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'تعذر تجهيز رفع الصورة' }, { status: 500 }); }
}
