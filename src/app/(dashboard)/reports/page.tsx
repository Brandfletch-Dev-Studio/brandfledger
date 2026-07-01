"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDefaultBusiness } from "@/lib/default-business";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { Download, TrendingUp, TrendingDown, DollarSign, Loader2, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Business } from "@/types";

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

export default function ReportsPage() {
  const { toast } = useToast();
  const [business, setBusiness] = useState<Business | null>(null);
  const [period, setPeriod] = useState("12");
  const [data, setData] = useState<any[]>([]);
  const [expenseByCategory, setExpenseByCategory] = useState<{ name: string; value: number }[]>([]);
  const [summary, setSummary] = useState({ revenue: 0, expenses: 0, profit: 0 });
  const [rawInvoices, setRawInvoices] = useState<any[]>([]);
  const [rawExpenses, setRawExpenses] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => { loadData(); }, [period]);

  async function loadData() {
    setPageLoading(true);
    const supabase = createClient();
    const { data: biz, error: bizError } = await getDefaultBusiness(supabase);
    if (bizError) {
      toast({ title: "Couldn't load business", description: bizError.message, variant: "destructive" });
      setPageLoading(false); return;
    }
    if (!biz) { setPageLoading(false); return; }
    setBusiness(biz);

    const months = parseInt(period);
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - months + 1);
    fromDate.setDate(1);

    const [{ data: invoices, error: invError }, { data: expenses, error: expError }] = await Promise.all([
      supabase.from("invoices").select("total, status, issue_date, invoice_number, customers(name)").eq("business_id", biz.id).eq("status", "paid").gte("issue_date", fromDate.toISOString()),
      supabase.from("expenses").select("amount, date, description, category, vendor").eq("business_id", biz.id).gte("date", fromDate.toISOString().split("T")[0]),
    ]);

    if (invError || expError) {
      toast({ title: "Couldn't load some report data", description: (invError ?? expError)?.message, variant: "destructive" });
    }

    setRawInvoices(invoices ?? []);
    setRawExpenses(expenses ?? []);

    const monthMap: Record<string, { month: string; revenue: number; expenses: number; profit: number }> = {};
    for (let i = 0; i < months; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (months - 1 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      monthMap[key] = { month: label, revenue: 0, expenses: 0, profit: 0 };
    }

    invoices?.forEach(inv => {
      const key = inv.issue_date.slice(0, 7);
      if (monthMap[key]) monthMap[key].revenue += inv.total;
    });
    expenses?.forEach(exp => {
      const key = exp.date.slice(0, 7);
      if (monthMap[key]) monthMap[key].expenses += exp.amount;
    });

    const chartData = Object.values(monthMap).map(m => ({ ...m, profit: m.revenue - m.expenses }));
    setData(chartData);
    setSummary({
      revenue: chartData.reduce((s, m) => s + m.revenue, 0),
      expenses: chartData.reduce((s, m) => s + m.expenses, 0),
      profit: chartData.reduce((s, m) => s + m.profit, 0),
    });

    const catMap: Record<string, number> = {};
    expenses?.forEach(exp => {
      const cat = exp.category || "Other";
      catMap[cat] = (catMap[cat] ?? 0) + exp.amount;
    });
    setExpenseByCategory(Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
    setPageLoading(false);
  }

  function exportCSV() {
    const rows: string[][] = [["Type", "Date", "Description", "Category / Customer", "Amount", "Status"]];
    rawInvoices.forEach(inv => {
      rows.push(["Revenue", inv.issue_date, "Invoice " + inv.invoice_number, (inv as any).customers?.name ?? "", String(inv.total), "paid"]);
    });
    rawExpenses.forEach(exp => {
      rows.push(["Expense", exp.date, exp.description, exp.category ?? "", String(exp.amount), ""]);
    });
    const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '\"\"  ') + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "brandfledger-report-" + period + "mo-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (pageLoading) return (
    <div>
      <Header title="Reports" description="Financial overview and analytics" icon={BarChart3} />
      <div className="p-6 flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  return (
    <div>
      <Header title="Reports" description="Financial overview and analytics" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Last 3 months</SelectItem>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="12">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Total Revenue", value: summary.revenue, icon: TrendingUp, color: "text-green-600" },
            { label: "Total Expenses", value: summary.expenses, icon: TrendingDown, color: "text-red-500" },
            { label: "Net Profit", value: summary.profit, icon: DollarSign, color: summary.profit >= 0 ? "text-green-600" : "text-red-500" },
          ].map(stat => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <stat.icon className={"h-5 w-5 " + stat.color} />
              </CardHeader>
              <CardContent>
                <div className={"text-2xl font-bold " + stat.color}>{formatCurrency(stat.value, business?.currency)}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Revenue vs Expenses</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-50" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v, business?.currency)} />
                <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Profit Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-50" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v, business?.currency)} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {expenseByCategory.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Expenses by Category</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={expenseByCategory} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name">
                      {expenseByCategory.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v, business?.currency)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}