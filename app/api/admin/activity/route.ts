import { NextResponse } from "next/server";
import { getAdminSession, getServiceClient } from "@/app/lib/supabase-server";
export async function GET(){const admin=await getAdminSession();if(!admin)return NextResponse.json({error:"غير مصرح"},{status:401});const {data,error}=await getServiceClient().from("admin_activity_log").select("id,admin_user_id,action,entity_type,entity_id,description,metadata,created_at").order("created_at",{ascending:false}).limit(200);if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({data:data||[]})}
