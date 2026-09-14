import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { getAdminSession, getServiceClient } from '@/app/lib/supabase-server';

async function pushUser(userId:string,title:string,body:string,href:string,tag:string){
 const s=getServiceClient();
 await s.from('notifications').insert({title,body,href,kind:'wallet',target_user_id:userId});
 const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY,subject=process.env.VAPID_SUBJECT;
 if(!publicKey||!privateKey||!subject)return;
 webpush.setVapidDetails(subject,publicKey,privateKey);
 const {data:subs}=await s.from('push_subscriptions').select('id,subscription').eq('user_id',userId);
 for(const row of subs??[]){try{await webpush.sendNotification(row.subscription as webpush.PushSubscription,JSON.stringify({title,body,href,icon:'/brand/bkkari-tech-logo.png',badge:'/brand/bkkari-tech-logo.png',tag,renotify:false,requireInteraction:false}));}catch(e:any){if(e?.statusCode===404||e?.statusCode===410)await s.from('push_subscriptions').delete().eq('id',row.id)}}
}

export async function GET(){const user=await getAdminSession();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});try{const s=getServiceClient();const {data,error}=await s.from('wallet_topup_requests').select('*').order('created_at',{ascending:false});if(error)throw error;const {data:usersPage}=await s.auth.admin.listUsers({page:1,perPage:1000});const users=new Map((usersPage.users??[]).map(u=>[u.id,u]));const enriched=(data??[]).map((row:any)=>{const u=users.get(row.user_id);const meta=(u?.user_metadata??{}) as Record<string,unknown>;return {...row,user_info:{id:row.user_id,name:String(meta.full_name??meta.name??'مستخدم Bkkari Tech'),phone:String(meta.phone??u?.phone??'غير مسجل'),email:String(u?.email??'غير مسجل'),governorate:String(meta.governorate??'')}}});return NextResponse.json({data:enriched});}catch(e:any){return NextResponse.json({error:e.message||'Failed'},{status:500})}}

export async function PATCH(req:Request){
 const user=await getAdminSession();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const body=await req.json();const s=getServiceClient();const {data:request,error:rErr}=await s.from('wallet_topup_requests').select('*').eq('id',body.id).single();if(rErr)throw rErr;
  if(request.status!=='pending')return NextResponse.json({error:'هالطلب تمت معالجته من قبل.'},{status:409});
  const note=String(body.admin_note||'').trim()||null;
  if(body.status==='approved'){
   const {data:wallet}=await s.from('wallets').select('id,balance').eq('user_id',request.user_id).maybeSingle();
   if(wallet){const {error:wErr}=await s.from('wallets').update({balance:Number(wallet.balance)+Number(request.amount),updated_at:new Date().toISOString()}).eq('id',wallet.id);if(wErr)throw wErr}
   else{const {error:wErr}=await s.from('wallets').insert({user_id:request.user_id,balance:Number(request.amount)});if(wErr)throw wErr}
   const {error:tErr}=await s.from('wallet_transactions').insert({user_id:request.user_id,amount:Number(request.amount),type:'deposit',status:'completed',reference:request.transaction_number});if(tErr)throw tErr;
   const {data:walletAfter}=await s.from('wallets').select('balance').eq('user_id',request.user_id).maybeSingle();
   await pushUser(request.user_id,'💰 تمت تعبئة محفظتك',`تمت إضافة $${Number(request.amount).toFixed(2)} إلى محفظتك. الرصيد الحالي $${Number(walletAfter?.balance||0).toFixed(2)}.${note?` السبب/الملاحظة: ${note}`:''}`,'/wallet',`wallet-topup-result:${request.id}:approved`);
  } else if(body.status==='rejected'){
   await pushUser(request.user_id,'❌ تم رفض طلب تعبئة المحفظة',`تم رفض طلب التعبئة بقيمة $${Number(request.amount).toFixed(2)}.${note?` السبب: ${note}`:' راجع الإدارة لمعرفة السبب.'}`,'/wallet',`wallet-topup-result:${request.id}:rejected`);
  } else return NextResponse.json({error:'الحالة غير مدعومة'},{status:400});
  const {data,error}=await s.from('wallet_topup_requests').update({status:body.status,admin_note:note,reviewed_at:new Date().toISOString()}).eq('id',body.id).eq('status','pending').select('*').single();if(error)throw error;
  return NextResponse.json({data});
 }catch(e:any){return NextResponse.json({error:e.message||'Failed'},{status:500})}
}

export async function DELETE(req:Request){const user=await getAdminSession();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});try{const body=await req.json().catch(()=>({}));const ids=Array.isArray(body.ids)?body.ids.map(Number).filter(Number.isFinite):[];if(!ids.length)return NextResponse.json({error:"حدد طلبات أولاً"},{status:400});const{error}=await getServiceClient().from("wallet_topup_requests").delete().in("id",ids);if(error)throw error;return NextResponse.json({ok:true});}catch(e:any){return NextResponse.json({error:e.message||"Failed"},{status:500})}}
