import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get("secret");
    if (secret !== "brandfledger-migrate-2026") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const sql = body.sql;
    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ error: "Missing 'sql' field" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");

    const { Pool } = await import("pg");

    // Try direct connection first
    const directConnStr = "postgresql://postgres:" + serviceKey + "@db." + projectRef + ".supabase.co:5432/postgres";

    let pool;
    try {
      pool = new Pool({ connectionString: directConnStr, max: 1, connectionTimeoutMillis: 10000, ssl: { rejectUnauthorized: false } });
      const client = await pool.connect();
      try {
        await client.query(sql);
        return NextResponse.json({ success: true, method: "direct", projectRef });
      } finally {
        client.release();
        await pool.end();
      }
    } catch (directErr: any) {
      console.log("Direct failed:", directErr.message);
      if (pool) await pool.end().catch(() => {});

      // Try pooler with different regions
      const regions = ["us-east-1", "eu-west-1", "ap-southeast-1", "us-west-1", "eu-central-1"];
      for (const region of regions) {
        const poolerConnStr = "postgresql://postgres." + projectRef + ":" + serviceKey + "@aws-0-" + region + ".pooler.supabase.com:5432/postgres";
        try {
          pool = new Pool({ connectionString: poolerConnStr, max: 1, connectionTimeoutMillis: 8000 });
          const client = await pool.connect();
          try {
            await client.query(sql);
            return NextResponse.json({ success: true, method: "pooler", region, projectRef });
          } finally {
            client.release();
            await pool.end();
          }
        } catch (poolErr: any) {
          console.log("Pooler " + region + " failed:", poolErr.message);
          if (pool) await pool.end().catch(() => {});
        }
      }

      return NextResponse.json({
        error: "All connection attempts failed",
        directError: directErr.message,
        projectRef,
      }, { status: 500 });
    }
  } catch (err: any) {
    console.error("Migration error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
