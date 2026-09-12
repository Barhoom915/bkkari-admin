import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/supabase-server";

const BASE_URL = "https://satofill.com/wp-json/mps/v1";

export async function GET() {
  const user = await getAdminSession();
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const token = process.env.SATOFILL_API_TOKEN?.trim() || "";
  return NextResponse.json({
    configured: Boolean(token), provider: "SatoFill", type: "REST API", baseUrl: BASE_URL,
    auth: token ? "Bearer Token" : "غير مضبوط",
    tokenPreview: token ? `${token.slice(0, 4)}••••••${token.slice(-4)}` : null,
    endpoints: [
      { label: "الرصيد", method: "GET", path: "/balance" },
      { label: "الأقسام", method: "GET", path: "/categories?with_products=no" },
      { label: "المنتجات", method: "GET", path: "/products" },
      { label: "تفاصيل منتج", method: "GET", path: "/products/{id}" },
      { label: "إنشاء طلب", method: "POST", path: "/orders" },
      { label: "تفاصيل طلب", method: "GET", path: "/orders/{id}" },
      { label: "حالة الطلبات", method: "POST", path: "/orders/status" },
    ],
  });
}
