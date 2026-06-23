// UPDATED: src/app/(dashboard)/dashboard/page.tsx
// New: passes setup completion data to DashboardClient for the checklist

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch business (may be null for brand-new users)
  const { data: businesses } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const business = businesses?.[0] ?? null;

  // If no business yet, render with empty stats — checklist will handle setup
  if (!business) {
    return (
      <DashboardClient
        business={null}
        stats={{ revenue: 0, expenses: 0, profit: 0, outstandingAmount: 0, outstandingCount: 0, customerCount: 0 }}
        recentInvoices={[]}
        recentPayments={[]}
        setupStatus={{ hasBusiness: false, hasCustomer: false, hasProduct: false, hasInvoice: false }}
      />
    );
  }

  // Fetch stats + setup status in parallel
  const [
    { data: invoices },
    { data: expenses },
    { data: payments },
    { data: customers },
    { data: products },
  ] = await Promise.all([
    supabase.from("invoices").select("id,total,status,created_at,due_date").eq("business_id", business.id),
    supabase.from("expenses").select("id,amount,date").eq("business_id", business.id),
    supabase.from("payments").select("id,amount,date").eq("business_id", business.id),
    supabase.from("customers").select("id,name").eq("business_id", business.id),
    supabase.from("products").select("id").eq("business_id", business.id).limit(1),
  ]);

  const totalRevenue = (payments || []).reduce((s, p) => s + Number(p.amount), 0);
  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
  const outstandingInvoices = (invoices || []).filter(i => ["sent", "overdue"].includes(i.status));
  const outstandingAmount = outstandingInvoices.reduce((s, i) => s + Number(i.total), 0);

  const setupStatus = {
    hasBusiness: true,
    hasCustomer: (customers || []).length > 0,
    hasProduct: (products || []).length > 0,
    hasInvoice: (invoices || []).length > 0,
  };

  return (
    <DashboardClient
      business={business}
      stats={{
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: totalRevenue - totalExpenses,
        outstandingAmount,
        outstandingCount: outstandingInvoices.length,
        customerCount: (customers || []).length,
      }}
      recentInvoices={(invoices || []).slice(0, 5)}
      recentPayments={(payments || []).slice(0, 5)}
      setupStatus={setupStatus}
    />
  );
}
