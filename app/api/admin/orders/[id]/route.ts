import { NextResponse } from "next/server";
import { getAdminSession, getServiceClient } from "@/app/lib/supabase-server";

export async function GET(_request: Request,{params}:{params:Promise<{id:string}>}){
 const admin=await getAdminSession(); if(!admin)return NextResponse.json({error:"غير مصرح"},{status:401});
 try{const {id}=await params;const service=getServiceClient();const {data:order,error}=await service.from("orders").select("*").eq("id",id).single();if(error)throw error;
  let authUser:any=null; let customerNumber:any=null; let paymentRef:any=null; if(order.user_id){const r=await service.auth.admin.getUserById(order.user_id);authUser=r.data.user??null; const cn=await service.from('customer_numbers').select('customer_number').eq('user_id',order.user_id).maybeSingle(); customerNumber=cn.data?.customer_number??null; const wt=await service.from('wallet_transactions').select('id,reference,type,amount').eq('user_id',order.user_id).eq('reference',order.order_number).eq('type','purchase').order('id',{ascending:false}).limit(1).maybeSingle(); if(wt.data?.id) paymentRef=`PAY-ORDER-${String(wt.data.id).padStart(4,'0')}`;}
  return NextResponse.json({order,user:{id:authUser?.id??order.user_id??null,email:authUser?.email??null,created_at:authUser?.created_at??null,confirmed_at:authUser?.email_confirmed_at??null,metadata:authUser?.user_metadata??{},customer_number:customerNumber},payment_number:paymentRef});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"تعذر تحميل تفاصيل الطلب"},{status:500})}
}
