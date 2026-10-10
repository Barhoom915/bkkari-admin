import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/supabase-server";
import { satofill } from "@/app/lib/satofill";

export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "غير مصرح" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  try {
    const balance = await satofill.getBalance();
    return NextResponse.json({ ok: true, balance }, { headers: noStoreHeaders });
  } catch (err) {
    console.error("SatoFill balance fetch failed:", err);
    return NextResponse.json(
      { ok: false, error: "تعذر الاتصال بـ SatoFill" },
      { status: 502, headers: noStoreHeaders },
    );
  }
}
