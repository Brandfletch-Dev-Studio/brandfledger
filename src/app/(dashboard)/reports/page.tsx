"use client";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { formatCurrency, formatCurrencyFull } from "@/lib/utils";
import { Download, TrendingUp, TrendingDown, DollarSign, Loader2, BarChart3, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

export default function ReportsPage() {
  const { toast } = useToast();
  const [business, setBusiness] = useState<any>(null);
  const [period, setPeriod] = useState("12");
  const [data, setData] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const loadData = useCallback(async () => {
    setPageLoading(true);
    try {
      const res = await fetch(`/api/data/reports?months=${period}`);
      if (!res.ok) throw new Error("Failed to load report data");
      const reportData = await res.json();
      setBusiness(reportData.business);
      setData(reportData);
    } catch (err: any) {
      toast({ title: "Couldn't load report data", description: err.message, variant: "destructive" });
    } finally {
      setPageLoading(false);
    }
  }, [period, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  function handleExport() {
    window.open(`/api/data/export?type=summary`, "_blank");
  }

  if (pageLoading || !data) return (
    <div>
      <Header title="Reports" description="Financial analytics & insights" icon={BarChart3} />
      <div className="p-6 flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  const currency = business?.currency ?? "MWK";
  const { summary, monthlyData, incomeByCategory, expenseByCategory, topCustomers } = data;

  return (
    <div>
      <Header
        title="Reports"
        description="Financial analytics & insights"
        icon={BarChart3}
        actions={
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="mr-1.5 h-4 w-4" />Export
          </Button>
        }
      />
      <div className="p-3 sm:p-6 space-y-6 max-w-4xl">
        {/* Period selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Period:</span>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Last 3 months</SelectItem>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="12">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="shadow-sm"><CardContent className="p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Revenue</div>
            <div className="text-lg sm:text-xl font-bold text-emerald-600">{formatCurrency(summary.revenue, currency)}</div>
          </CardContent></Card>
          <Card className="shadow-sm"><CardContent className="p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Cost of Sales</div>
            <div className="text-lg sm:text-xl font-bold text-rose-600">{formatCurrency(summary.cost, currency)}</div>
          </CardContent></Card>
          <Card className="shadow-sm"><CardContent className="p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Expenses</div>
            <div className="text-lg sm:text-xl font-bold text-rose-600">{formatCurrency(summary.expenses, currency)}</div>
          </CardContent></Card>
          <Card className="shadow-sm"><CardContent className="p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Net Profit</div>
            <div className={`text-lg sm:text-xl font-bold ${summary.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {formatCurrency(summary.netProfit, currency)}
            </div>
          </CardContent></Card>
        </div>

        {/* Monthly chart */}
        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-sm font-semibold mb-4">Revenue vs Expenses</h3>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} />
                  <Tooltip
                    formatter={(v: any) => formatCurrencyFull(v, currency)}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="revenue" fill="#22c55e" name="Revenue" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Income by Category */}
          {incomeByCategory && incomeByCategory.length > 0 && (
            <Card className="shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-sm font-semibold mb-4">Income by Category</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={incomeByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={{ fontSize: 10 }}>
                      {incomeByCategory.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrencyFull(v, currency)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Expense by Category */}
          {expenseByCategory && expenseByCategory.length > 0 && (
            <Card className="shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-sm font-semibold mb-4">Expenses by Category</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={{ fontSize: 10 }}>
                      {expenseByCategory.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrencyFull(v, currency)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Top Customers */}
        {topCustomers && topCustomers.length > 0 && (
          <Card className="shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-sm font-semibold mb-4">Top Customers by Revenue</h3>
              <div className="space-y-2">
                {topCustomers.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.count} transaction{c.count !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-emerald-600">{formatCurrency(c.revenue, currency)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
