import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const sql = body.sql;
    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ error: "Missing 'sql' field" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");

    // Connect via the pooler (session mode, port 5432)
    const connectionString = `postgresql://postgres.${projectRef}:${serviceKey}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;
    
    const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
    const client = await pool.connect();
    
    try {
      await client.query(sql);
      return NextResponse.json({ success: true, message: "Migration applied" });
    } finally {
      client.release();
      await pool.end();
    }
  } catch (err: any) {
    console.error("Migration error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
