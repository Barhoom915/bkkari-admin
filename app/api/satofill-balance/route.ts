import { NextResponse } from "next/server";
import { satofill } from "@/app/lib/satofill";

export async function GET() {
  try {
    const balance = await satofill.getBalance();
    return NextResponse.json({ ok: true, balance });
  } catch (err) {
    console.error("SatoFill balance fetch failed:", err);
    return NextResponse.json({ ok: false, error: "تعذر الاتصال بـ SatoFill" }, { status: 502 });
  }
}
