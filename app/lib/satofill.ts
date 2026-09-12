import "server-only";

const BASE_URL = "https://satofill.com/wp-json/mps/v1";

function getToken() {
  const token = process.env.SATOFILL_API_TOKEN;
  if (!token) {
    throw new Error("SATOFILL_API_TOKEN غير موجود بمتغيرات البيئة");
  }
  return token;
}

async function satofillFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    // ما بدنا كاش قديم لأسعار/مخزون متغيرة
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SatoFill API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`SatoFill returned a non-JSON response: ${text.slice(0, 500)}`);
  }
}

export type SatofillProduct = {
  id: number | string;
  name: string;
  price: number;
  category?: string;
  image?: string;
  custom_fields?: Array<{
    key: string;
    label: string;
    type: string;
    required?: boolean;
  }>;
  [key: string]: unknown;
};

export type SatofillCategory = {
  id: number | string;
  name: string;
  [key: string]: unknown;
};

export const satofill = {
  async getProducts(): Promise<SatofillProduct[]> {
    const data = await satofillFetch<{
      success?: boolean;
      data?: { products?: SatofillProduct[]; total?: number };
    } | SatofillProduct[]>("/products");
    return Array.isArray(data) ? data : (Array.isArray(data.data?.products) ? data.data.products : []);
  },

  async getProduct(id: string | number): Promise<SatofillProduct> {
    const data = await satofillFetch<{ data?: SatofillProduct }>(`/products/${id}`);
    return data.data ?? (data as unknown as SatofillProduct);
  },

  async getCategories(): Promise<SatofillCategory[]> {
    const data = await satofillFetch<{
      success?: boolean;
      data?: { categories?: SatofillCategory[]; total_categories?: number; total_products?: number };
    } | SatofillCategory[]>("/categories?with_products=no");
    return Array.isArray(data) ? data : (Array.isArray(data.data?.categories) ? data.data.categories : []);
  },

  async createOrder(payload: Record<string, unknown>) {
    return satofillFetch("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getOrder(id: string | number) {
    return satofillFetch(`/orders/${id}`);
  },

  async getOrdersStatus(orderIds: Array<string | number>) {
    // الحد الأقصى المسموح به من SatoFill هو 50 معرّف بكل طلب
    const batch = orderIds.slice(0, 50);
    return satofillFetch("/orders/status", {
      method: "POST",
      body: JSON.stringify({ order_ids: batch }),
    });
  },

  async getBalance(): Promise<{ balance: number; currency?: string }> {
    return satofillFetch("/balance");
  },
};
