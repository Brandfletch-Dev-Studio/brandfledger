// src/app/api/invoices/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const { invoiceId } = await req.json();
    if (!invoiceId) return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Route handler — safe to ignore
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, customers(*), businesses(*)")
      .eq("id", invoiceId)
      .single();

    if (invErr || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const customer = invoice.customers as Record<string, string> | null;
    const business = invoice.businesses as Record<string, string> | null;

    if (!customer?.email) {
      return NextResponse.json({ error: "Customer has no email address" }, { status: 400 });
    }

    const currency = business?.currency ?? "USD";
    const fmt = (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);

    const itemRows = (invoice.items as Array<{
      name: string;
      description?: string;
      quantity: number;
      unit_price: number;
      total: number;
    }>).map(item => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${item.name}${item.description ? `<br/><span style="color:#888;font-size:12px;">${item.description}</span>` : ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmt(item.unit_price)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmt(item.total)}</td>
      </tr>
    `).join("");

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f9f9f9;margin:0;padding:0;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#1a1a2e;padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">${business?.name ?? "Invoice"}</h1>
      <p style="color:#aaa;margin:8px 0 0;">Invoice ${invoice.invoice_number}</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#333;font-size:16px;">Hi ${customer.name},</p>
      <p style="color:#555;">Please find your invoice from <strong>${business?.name}</strong>. Due by <strong>${new Date(invoice.due_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:10px 12px;text-align:left;font-weight:600;color:#333;">Description</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;color:#333;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-weight:600;color:#333;">Unit Price</th>
            <th style="padding:10px 12px;text-align:right;font-weight:600;color:#333;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="text-align:right;padding:16px 0;border-top:2px solid #f0f0f0;">
        <p style="margin:4px 0;color:#555;font-size:14px;">Subtotal: <strong>${fmt(invoice.subtotal)}</strong></p>
        ${invoice.tax_rate > 0 ? `<p style="margin:4px 0;color:#555;font-size:14px;">Tax (${invoice.tax_rate}%): <strong>${fmt(invoice.tax_amount)}</strong></p>` : ""}
        <p style="margin:8px 0 0;color:#111;font-size:20px;font-weight:700;">Total Due: ${fmt(invoice.total)}</p>
      </div>
      ${invoice.notes ? `<div style="background:#f9f9f9;border-radius:8px;padding:16px;margin-top:16px;"><p style="margin:0;color:#555;font-size:13px;"><strong>Notes:</strong> ${invoice.notes}</p></div>` : ""}
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0;"/>
      <p style="color:#888;font-size:12px;text-align:center;">
        ${business?.name}${business?.email ? ` · ${business.email}` : ""}${business?.phone ? ` · ${business.phone}` : ""}<br/>
        ${business?.address ?? ""}
      </p>
    </div>
  </div>
</body>
</html>`;

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: "Email service not configured. Add RESEND_API_KEY to Vercel." }, { status: 503 });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${business?.name ?? "Brandfledger"} <onboarding@resend.dev>`,
        to: [customer.email],
        subject: `Invoice ${invoice.invoice_number} from ${business?.name} — ${fmt(Number(invoice.total))} due ${new Date(invoice.due_date).toLocaleDateString()}`,
        html: emailHtml,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json() as { message?: string };
      return NextResponse.json({ error: err.message ?? "Email send failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
