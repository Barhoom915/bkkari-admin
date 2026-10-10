import { NextResponse } from "next/server";
import { getAdminSession, getServiceClient } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json(
        { error: "غير مصرح" },
        {
          status: 401,
          headers: { "Cache-Control": "no-store, max-age=0" },
        },
      );
    }

    const { data, error } = await getServiceClient()
      .from("admin_activity_log")
      .select(
        "id,admin_user_id,action,entity_type,entity_id,description,metadata,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Failed to load admin activity log:", error.message);
      return NextResponse.json(
        { error: "تعذّر تحميل سجل النشاط حالياً" },
        {
          status: 500,
          headers: { "Cache-Control": "no-store, max-age=0" },
        },
      );
    }

    return NextResponse.json(
      { data: data ?? [] },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error(
      "Unexpected error loading admin activity log:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json(
      { error: "حدث خطأ غير متوقع أثناء تحميل سجل النشاط" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }
}
