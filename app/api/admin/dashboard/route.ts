import { NextResponse } from 'next/server';
import { getAdminSession, getServiceClient } from '@/app/lib/supabase-server';

const completedStatuses = ['تم التسليم', 'مكتمل'];

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const requestedRange = url.searchParams.get('range') || '30';
  const range = ['7', '30', '90', 'all'].includes(requestedRange) ? requestedRange : '30';
  const fromDate = range === 'all' ? null : new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000).toISOString();

  try {
    const s = getServiceClient();
    const fetchPagedOrders = async (trendOnly = false) => {
      const rows: any[] = [];
      const pageSize = 1000;
      for (let page = 0; page < 100; page++) {
        let query = s.from('orders').select(trendOnly ? 'total,created_at' : 'id,total,items,created_at').in('status', completedStatuses);
        if (trendOnly) query = query.gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).order('created_at', { ascending: true });
        else if (fromDate) query = query.gte('created_at', fromDate);
        const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) return { data: null, error };
        rows.push(...(data ?? []));
        if ((data ?? []).length < pageSize) break;
      }
      return { data: rows, error: null };
    };

    const [orders, completedOrders, topups, requests, users, lowStock, recentOrders, digital, laptops, trendOrders] = await Promise.all([
      s.from('orders').select('id', { count: 'exact', head: true }),
      fetchPagedOrders(false),
      s.from('wallet_topup_requests').select('id,amount,status', { count: 'exact' }),
      s.from('web_dev_requests').select('id', { count: 'exact', head: true }).in('status', ['جديد', 'قيد التواصل', 'تم الاتفاق', 'قيد التنفيذ']),
      s.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      s.from('laptops').select('id,name,brand,stock_quantity,price,min_stock_alert').lte('stock_quantity', 2).order('stock_quantity', { ascending: true }).limit(8),
      s.from('orders').select('id,order_number,customer_name,total,status,created_at').order('created_at', { ascending: false }).limit(6),
      s.from('digital_service_orders').select('id,order_number,product_name,total,status,created_at').order('created_at', { ascending: false }).limit(6),
      s.from('laptops').select('id,capital_price,stock_quantity'),
      fetchPagedOrders(true),
    ]);

    const errors = [orders.error, completedOrders.error, topups.error, requests.error, users.error, lowStock.error, recentOrders.error, digital.error, laptops.error, trendOrders.error].filter(Boolean);
    if (errors.length) {
      console.error('NOVATEK dashboard query error:', errors.map((e: any) => e.message));
      return NextResponse.json({ error: 'تعذر قراءة بعض بيانات لوحة التحكم من قاعدة البيانات. تحقق من الجداول والصلاحيات ثم أعد المحاولة.' }, { status: 500 });
    }

    const completed = completedOrders.data ?? [];
    const products = laptops.data ?? [];
    const sales = completed.reduce((sum: number, row: any) => sum + Number(row.total || 0), 0);
    const pendingTopups = (topups.data ?? []).filter((x: any) => x.status === 'pending').reduce((sum: number, x: any) => sum + Number(x.amount || 0), 0);
    const capital = products.reduce((sum: number, product: any) => sum + Number(product.capital_price || 0) * Number(product.stock_quantity || 0), 0);
    const costMap = new Map(products.map((product: any) => [String(product.id), Number(product.capital_price || 0)]));
    const profit = completed.reduce((sum: number, order: any) => sum + (Array.isArray(order.items) ? order.items.reduce((subtotal: number, item: any) => subtotal + (Number(item.price || 0) - Number(costMap.get(String(item.id)) || item.capital_price || 0)) * Number(item.qty || 1), 0) : 0), 0);

    const trendMap = new Map<string, number>();
    for (const row of trendOrders.data ?? []) {
      const day = String(row.created_at || '').slice(0, 10);
      if (day) trendMap.set(day, (trendMap.get(day) || 0) + Number(row.total || 0));
    }
    const days = 30;
    const trend = Array.from({ length: days }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (days - 1 - index));
      const key = date.toISOString().slice(0, 10);
      return { date: key, sales: Number((trendMap.get(key) || 0).toFixed(2)) };
    });

    return NextResponse.json({
      range,
      stats: {
        orders: orders.count ?? 0,
        sales,
        pendingTopups,
        topups: topups.count ?? 0,
        requests: requests.count ?? 0,
        users: users.data.users?.length ?? 0,
        usersMayBePartial: (users.data.users?.length ?? 0) >= 1000,
        capital,
        profit,
      },
      trend,
      lowStock: lowStock.data ?? [],
      recentOrders: recentOrders.data ?? [],
      digital: digital.data ?? [],
    });
  } catch (error: any) {
    console.error('NOVATEK dashboard failed:', error);
    return NextResponse.json({ error: error?.message || 'تعذر تحميل لوحة التحكم' }, { status: 500 });
  }
}
