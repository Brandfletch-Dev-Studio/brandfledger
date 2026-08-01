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
    const accessToken = body.access_token;
    
    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ error: "Missing 'sql' field" }, { status: 400 });
    }
    if (!accessToken) {
      return NextResponse.json({ error: "Missing 'access_token' field" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");

    // Call the Supabase Management API to execute SQL
    const mgmtUrl = "https://api.supabase.com/v1/projects/" + projectRef + "/database/query";
    
    const resp = await fetch(mgmtUrl, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });

    const resultText = await resp.text();
    
    if (!resp.ok) {
      return NextResponse.json({ 
        error: "Supabase Management API error", 
        status: resp.status,
        detail: resultText,
        projectRef,
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      projectRef,
      detail: resultText.substring(0, 200),
    });
  } catch (err: any) {
    console.error("Migration error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
