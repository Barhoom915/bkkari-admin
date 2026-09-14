import { NextResponse } from "next/server";
import { getAdminSession, getServiceClient } from "@/app/lib/supabase-server";

export async function GET(request: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const ids = new URL(request.url).searchParams.get("ids")?.split(",").map(x => x.trim()).filter(Boolean) ?? [];
  if (!ids.length) return NextResponse.json({ images: {} });
  const s = getServiceClient();
  const { data } = await s.from("laptops").select("id,images").in("id", ids);
  const images: Record<string,string|null> = {};
  for (const row of data ?? []) images[String(row.id)] = Array.isArray(row.images) ? (row.images[0] || null) : null;
  const { data: digital } = await s.from("digital_service_overrides").select("product_id,custom_image").in("product_id", ids);
  for (const row of digital ?? []) if (row.custom_image) images[String(row.product_id)] = row.custom_image;
  return NextResponse.json({ images });
}
