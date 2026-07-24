import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const result: Record<string, any> = {};
    
    for (const { table_name } of tables) {
      try {
        const count = await query(`SELECT COUNT(*) as cnt FROM "${table_name}"`);
        result[table_name] = parseInt(count[0].cnt);
      } catch {
        result[table_name] = "error";
      }
    }

    // Also fetch actual transaction data if it exists
    const transactions = await query("SELECT * FROM transactions ORDER BY date DESC LIMIT 50");
    const invoices = await query("SELECT * FROM invoices ORDER BY created_at DESC LIMIT 20");
    
    return NextResponse.json({ 
      tableCounts: result,
      transactions,
      invoices
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
