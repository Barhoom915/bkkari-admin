import { NextResponse } from 'next/server';
import { getAdminSession, getServiceClient } from '@/app/lib/supabase-server';
const PRIMARY_ADMIN = 'ibrahimbkkari51@gmail.com';
export async function GET(request: Request) {
  const user = await getAdminSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { const service=getServiceClient(); const {data,error}=await service.from('admin_users').select('id,email,name,role,is_active,created_at').order('created_at',{ascending:true}); if(error) throw error; return NextResponse.json({admins:data??[],primary:PRIMARY_ADMIN}); }
  catch(e){ return NextResponse.json({admins:[{id:'primary',email:PRIMARY_ADMIN,name:'المالك',role:'owner',is_active:true,created_at:null}],primary:PRIMARY_ADMIN,warning:e instanceof Error?e.message:'تعذر قراءة المشرفين'}); }
}
export async function POST(request: Request) {
  const actor=await getAdminSession(); if(!actor) return NextResponse.json({error:'Unauthorized'},{status:401});
  try { const body=await request.json(); const email=String(body.email??'').trim().toLowerCase(); const name=String(body.name??'').trim()||'مشرف جديد'; if(!email||!email.includes('@')) return NextResponse.json({error:'أدخل إيميل صحيح.'},{status:400}); if(email===PRIMARY_ADMIN)return NextResponse.json({error:'هذا الحساب هو المالك الأساسي.'},{status:400}); const service=getServiceClient(); const {data:existing}=await service.from('admin_users').select('id').eq('email',email).maybeSingle(); if(existing)return NextResponse.json({error:'هذا الإيميل مضاف مسبقاً.'},{status:409}); const {data:invited,error:inviteError}=await service.auth.admin.inviteUserByEmail(email,{redirectTo:`${new URL(request.url).origin}/auth/callback`}); if(inviteError)throw inviteError; const {error:insertError}=await service.from('admin_users').insert({email,name,role:'admin',is_active:true,auth_user_id:invited.user?.id??null}); if(insertError)throw insertError; return NextResponse.json({ok:true,message:`تمت إضافة ${email} وإرسال دعوة الدخول.`}); }
  catch(e){ return NextResponse.json({error:e instanceof Error?e.message:'تعذر إضافة المشرف'},{status:500}); }
}
export async function PATCH(request: Request) {
  const actor=await getAdminSession(); if(!actor)return NextResponse.json({error:'Unauthorized'},{status:401});
  try { const body=await request.json(); const id=String(body.id??''); if(!id||id==='primary')return NextResponse.json({error:'لا يمكن تعطيل المالك الأساسي.'},{status:400}); const service=getServiceClient(); const {error}=await service.from('admin_users').update({is_active:Boolean(body.is_active)}).eq('id',id); if(error)throw error; return NextResponse.json({ok:true}); }
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:'تعذر التعديل'},{status:500});}
}
