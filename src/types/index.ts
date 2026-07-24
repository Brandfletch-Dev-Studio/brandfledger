// SaaS-generic types — no business-specific assumptions

export type UserRole = "owner" | "admin" | "member" | "viewer";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
export type SubscriptionPlan = "free" | "starter" | "pro" | "enterprise";
export type TransactionType = "income" | "expense";
export type CategoryType = "income" | "expense";

export const PAYMENT_METHODS = [
  "cash",
  "mobile_money",
  "bank_transfer",
  "card",
  "other",
] as const;

export interface Business {
  id: string;
  name: string;
  owner_id: string;
  logo_url?: string;
  currency: string;
  invoice_prefix: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  business_type?: string;
  tax_id?: string;
  cost_rate?: number;
  cost_rate_label?: string;
  cost_rate_unit?: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessMember {
  id: string;
  business_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  type: CategoryType;
  color?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  total_invoiced: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  category?: string;
  unit?: string;
  cost_unit?: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  product_id?: string;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: string;
  business_id: string;
  customer_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  items: InvoiceItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  customers?: Customer;
}

export interface Payment {
  id: string;
  business_id: string;
  invoice_id: string;
  amount: number;
  date: string;
  method: string;
  reference?: string;
  notes?: string;
  created_at: string;
  invoices?: Invoice;
}

export interface Expense {
  id: string;
  business_id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  vendor?: string;
  notes?: string;
  receipt_url?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Transaction — generic income/expense with profit tracking
// ============================================================
export interface Transaction {
  id: string;
  business_id: string;
  type: TransactionType;
  category_id?: string;
  category_name?: string;
  client_name?: string;
  vendor_name?: string;
  description: string;
  amount: number;
  cost_amount?: number;
  cost_qty?: number;
  profit?: number;
  margin?: number;
  payment_method?: string;
  reference?: string;
  date: string;
  product_id?: string;
  invoice_id?: string;
  attachment_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientLedgerEntry {
  client_name: string;
  transaction_count: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  total_cost_qty: number;
  avg_margin: number;
  last_transaction_date: string;
}

export interface DailySummary {
  date: string;
  income: number;
  expenses: number;
  total_cost: number;
  gross_profit: number;
  sales_count: number;
  expense_count: number;
}

export interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  outstandingInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  recentTransactions: (Invoice | Expense)[];
  totalCost?: number;
  grossProfit?: number;
  avgMargin?: number;
  salesCount?: number;
}
