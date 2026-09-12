import { NextResponse } from "next/server";
import { getAdminSession, getServiceClient } from "@/app/lib/supabase-server";

const BUCKET = "digital-service-images";
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

async function ensureBucket(supabase: ReturnType<typeof getServiceClient>) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: TYPES });
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "اختار صورة أولاً" }, { status: 400 });
    if (!TYPES.includes(file.type)) return NextResponse.json({ error: "صيغة الصورة غير مدعومة" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "الصورة أكبر من 10MB" }, { status: 400 });
    const supabase = getServiceClient();
    await ensureBucket(supabase);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `services/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "تعذر رفع الصورة" }, { status: 500 });
  }
}
