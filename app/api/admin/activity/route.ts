import { NextResponse } from "next/server";
import { getAdminSession, getServiceClient } from "@/app/lib/supabase-server";

const noStore = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: noStore });
  }

  try {
    const { data, error } = await getServiceClient()
      .from("admin_activity_log")
      .select("id,admin_user_id,action,entity_type,entity_id,description,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      // Keep internal database details out of the response shown to admin clients.
      console.error("Failed to load admin activity log:", error.message);
      return NextResponse.json(
        { error: "تعذّر تحميل سجل النشاط حالياً" },
        { status: 500, headers: noStore },
      );
    }

    return NextResponse.json({ data: data ?? [] }, { headers: noStore });
  } catch (error) {
    console.error("Unexpected admin activity log error:", error);
    return NextResponse.json(
      { error: "حدث خطأ غير متوقع أثناء تحميل سجل النشاط" },
      { status: 500, headers: noStore },
    );
  }
}
