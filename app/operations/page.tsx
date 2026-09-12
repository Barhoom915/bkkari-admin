"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase-browser";
import type { Order } from "@/app/lib/types";

const statuses = ["طلب جديد", "قيد التواصل", "تم التأكيد", "قيد التجهيز", "خرج للتوصيل", "تم التسليم", "ملغي"];

const statusStyle: Record<string, string> = {
  "طلب جديد": "bg-orange-soft text-orange",
  "قيد التواصل": "bg-blue/10 text-blue",
  "تم التأكيد": "bg-blue/10 text-blue",
  "قيد التجهيز": "bg-orange-soft text-orange",
  "خرج للتوصيل": "bg-blue/10 text-blue",
  "تم التسليم": "bg-green-100 text-green-700",
  "ملغي": "bg-red-100 text-red-600",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-SY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function OperationsPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("الكل");
  const [selected, setSelected] = useState<Order | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  async function loadOrders() {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, governorate, total, status, payment_method, created_at")
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadOrders(); }, []);

  async function updateStatus(id: number, status: string) {
    setSavingId(id);
    const previous = orders.find((o) => o.id === id)?.status;
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status } : prev);
    const response = await fetch("/api/admin/orders/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    const result = await response.json().catch(() => ({}));
    const error = response.ok ? null : new Error(result.error || "تعذر تحديث الطلب");
    if (error) {
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: previous ?? o.status } : o));
      if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status: previous ?? prev.status } : prev);
      alert("ما قدرنا نحدّث حالة الطلب. جرّب مرة تانية.");
    }
    setSavingId(null);
  }

  const counts = useMemo(() => {
    const result: Record<string, number> = { الكل: orders.length };
    statuses.forEach((s) => result[s] = orders.filter((o) => o.status === s).length);
    return result;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesStatus = filter === "الكل" || o.status === filter;
      const haystack = `${o.order_number} ${o.customer_name} ${o.customer_phone} ${o.governorate}`.toLowerCase();
      return matchesStatus && (!q || haystack.includes(q));
    });
  }, [orders, query, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-blue">مركز العمليات</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">كل عمليات المتجر بمكان واحد</h1>
          <p className="mt-1 text-sm text-ink-soft">راقب الطلبات، تابع حالتها، وتعامل مع الجديد أولاً.</p>
        </div>
        <Link href="/orders" className="w-fit rounded-xl bg-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-deep">عرض صفحة الطلبات</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <button onClick={() => setFilter("الكل")} className={`rounded-2xl border p-4 text-right shadow-sm ${filter === "الكل" ? "border-blue bg-blue/5" : "border-line bg-white"}`}>
          <p className="text-xs text-ink-soft">كل الطلبات</p><p className="mt-1 text-2xl font-bold text-ink">{counts.الكل}</p>
        </button>
        <button onClick={() => setFilter("طلب جديد")} className={`rounded-2xl border p-4 text-right shadow-sm ${filter === "طلب جديد" ? "border-orange bg-orange-soft" : "border-line bg-white"}`}>
          <p className="text-xs text-ink-soft">تحتاج إجراء</p><p className="mt-1 text-2xl font-bold text-orange">{counts["طلب جديد"] + counts["قيد التواصل"]}</p>
        </button>
        <button onClick={() => setFilter("قيد التجهيز")} className={`rounded-2xl border p-4 text-right shadow-sm ${filter === "قيد التجهيز" ? "border-orange bg-orange-soft" : "border-line bg-white"}`}>
          <p className="text-xs text-ink-soft">قيد التجهيز</p><p className="mt-1 text-2xl font-bold text-ink">{counts["قيد التجهيز"]}</p>
        </button>
        <button onClick={() => setFilter("خرج للتوصيل")} className={`rounded-2xl border p-4 text-right shadow-sm ${filter === "خرج للتوصيل" ? "border-blue bg-blue/5" : "border-line bg-white"}`}>
          <p className="text-xs text-ink-soft">بالتوصيل</p><p className="mt-1 text-2xl font-bold text-blue">{counts["خرج للتوصيل"]}</p>
        </button>
      </div>

      <section className="rounded-2xl border border-line bg-white shadow-sm">
        <div className="border-b border-line p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث برقم الطلب، اسم العميل، الهاتف أو المحافظة..." className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-blue" />
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none">
              <option>الكل</option>{statuses.map((s) => <option key={s}>{s}</option>)}
            </select>
            <button onClick={loadOrders} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-blue">تحديث</button>
          </div>
        </div>

        {loading ? <p className="p-6 text-sm text-ink-soft">جاري تحميل العمليات...</p> : filtered.length === 0 ? <p className="p-8 text-center text-sm text-ink-soft">ما في نتائج مطابقة.</p> : (
          <div className="divide-y divide-line">
            {filtered.map((o) => (
              <button key={o.id} onClick={() => setSelected(o)} className="block w-full p-4 text-right transition hover:bg-surface/60 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-data font-bold text-ink">{o.order_number}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[o.status] ?? "bg-surface text-ink-soft"}`}>{o.status}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-ink-soft">{o.customer_name} · {o.customer_phone} · {o.governorate}</p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div><p className="text-xs text-ink-soft">الإجمالي</p><p className="font-bold text-ink">${Number(o.total).toFixed(2)}</p></div>
                    <div className="text-left"><p className="text-xs text-ink-soft">التاريخ</p><p className="text-xs text-ink-soft">{formatDate(o.created_at)}</p></div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6" onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs text-ink-soft">تفاصيل الطلب</p><h2 className="mt-1 font-mono-data text-xl font-bold text-ink">{selected.order_number}</h2></div>
              <button onClick={() => setSelected(null)} className="rounded-full border border-line px-3 py-1 text-sm text-ink-soft">إغلاق</button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Info label="العميل" value={selected.customer_name} />
              <Info label="الهاتف" value={selected.customer_phone} />
              <Info label="المحافظة" value={selected.governorate} />
              <Info label="الدفع" value={selected.payment_method === "wallet" ? "المحفظة" : "عند الاستلام"} />
              <Info label="الإجمالي" value={`$${Number(selected.total).toFixed(2)}`} />
              <Info label="التاريخ" value={formatDate(selected.created_at)} />
            </div>
            <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold text-ink-soft">تغيير حالة الطلب</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {statuses.map((s) => <button key={s} disabled={savingId === selected.id} onClick={() => updateStatus(selected.id, s)} className={`rounded-full px-3 py-2 text-xs font-semibold ${selected.status === s ? "bg-blue text-white" : "border border-line bg-white text-ink-soft hover:border-blue"}`}>{s}</button>)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-surface p-3"><p className="text-[11px] text-ink-soft">{label}</p><p className="mt-1 text-sm font-semibold text-ink break-words">{value}</p></div>;
}
