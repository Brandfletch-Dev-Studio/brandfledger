// src/app/api/invoices/send/route.ts
// Complete rewrite — uses shared createClient() from @/lib/supabase/server
// No inline Supabase setup, no CookieOptions import needed

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const invoiceId = body?.invoiceId as string | undefined;

    if (!invoiceId) {
      return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, customers(*), businesses(*)")
      .eq("id", invoiceId)
      .single();

    if (invErr || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customer = invoice.customers as Record<string, any> | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const business = invoice.businesses as Record<string, any> | null;

    if (!customer?.email) {
      return NextResponse.json(
        { error: "Customer has no email address" },
        { status: 400 }
      );
    }

    const currency: string = business?.currency ?? "USD";
    const fmt = (n: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
      }).format(n);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = Array.isArray(invoice.items) ? invoice.items : [];

    const itemRows = items
      .map(
        (item) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">
          ${item.name}
          ${item.description ? `<br/><span style="color:#888;font-size:12px;">${item.description}</span>` : ""}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmt(Number(item.unit_price))}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmt(Number(item.total))}</td>
      </tr>`
      )
      .join("");

    const dueDate = new Date(invoice.due_date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;margin:0;padding:0;">
<div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:#1a1a2e;padding:32px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:24px;">${String(business?.name ?? "Invoice")}</h1>
    <p style="color:#aaa;margin:8px 0 0;">Invoice ${String(invoice.invoice_number)}</p>
  </div>
  <div style="padding:32px;">
    <p style="color:#333;font-size:16px;">Hi ${String(customer.name)},</p>
    <p style="color:#555;">Please find your invoice from <strong>${String(business?.name)}</strong>. Due by <strong>${dueDate}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:10px 12px;text-align:left;color:#333;">Description</th>
          <th style="padding:10px 12px;text-align:center;color:#333;">Qty</th>
          <th style="padding:10px 12px;text-align:right;color:#333;">Unit Price</th>
          <th style="padding:10px 12px;text-align:right;color:#333;">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="text-align:right;padding:16px 0;border-top:2px solid #f0f0f0;">
      <p style="margin:4px 0;color:#555;font-size:14px;">Subtotal: <strong>${fmt(Number(invoice.subtotal))}</strong></p>
      ${Number(invoice.tax_rate) > 0 ? `<p style="margin:4px 0;color:#555;font-size:14px;">Tax (${String(invoice.tax_rate)}%): <strong>${fmt(Number(invoice.tax_amount))}</strong></p>` : ""}
      <p style="margin:8px 0 0;color:#111;font-size:20px;font-weight:700;">Total Due: ${fmt(Number(invoice.total))}</p>
    </div>
    ${invoice.notes ? `<div style="background:#f9f9f9;border-radius:8px;padding:16px;margin-top:16px;"><p style="margin:0;color:#555;font-size:13px;"><strong>Notes:</strong> ${String(invoice.notes)}</p></div>` : ""}
    <hr style="border:none;border-top:1px solid #eee;margin:32px 0;"/>
    <p style="color:#888;font-size:12px;text-align:center;">
      ${String(business?.name ?? "")}${business?.email ? ` &middot; ${String(business.email)}` : ""}${business?.phone ? ` &middot; ${String(business.phone)}` : ""}<br/>
      ${String(business?.address ?? "")}
    </p>
  </div>
</div>
</body>
</html>`;

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Email not configured — add RESEND_API_KEY to Vercel environment variables." },
        { status: 503 }
      );
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${String(business?.name ?? "Brandfledger")} <onboarding@resend.dev>`,
        to: [String(customer.email)],
        subject: `Invoice ${String(invoice.invoice_number)} from ${String(business?.name)} — ${fmt(Number(invoice.total))} due ${new Date(invoice.due_date).toLocaleDateString()}`,
        html: emailHtml,
      }),
    });

    if (!emailRes.ok) {
      const errData = (await emailRes.json()) as { message?: string };
      return NextResponse.json(
        { error: errData.message ?? "Email send failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
