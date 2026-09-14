import { NextResponse } from "next/server";
import { getAdminSession, getServiceClient } from "@/app/lib/supabase-server";

export async function GET(req: Request) {
  if (!(await getAdminSession())) return new NextResponse("Unauthorized", { status: 401 });
  const raw = new URL(req.url).searchParams.get("url") || "";
  try {
    const u = new URL(raw);
    const marker = "/storage/v1/object/public/wallet-receipts/";
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return new NextResponse("Invalid receipt", { status: 400 });
    const path = decodeURIComponent(u.pathname.slice(idx + marker.length));
    const supabase = getServiceClient();
    const { data, error } = await supabase.storage.from("wallet-receipts").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return new NextResponse("Receipt not available", { status: 404 });
    return NextResponse.redirect(data.signedUrl, 302);
  } catch {
    return new NextResponse("Invalid receipt", { status: 400 });
  }
}
