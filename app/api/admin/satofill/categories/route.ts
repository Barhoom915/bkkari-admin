import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/supabase-server";
import { satofill } from "@/app/lib/satofill";
export async function GET(){const user=await getAdminSession();if(!user)return NextResponse.json({error:'غير مصرح'},{status:401});try{return NextResponse.json({data:await satofill.getCategories()})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'تعذر تحميل الأقسام'},{status:500})}}
