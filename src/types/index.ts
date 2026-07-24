// Updated types with transaction support and profit tracking

export type UserRole = "owner" | "admin" | "member" | "viewer";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
export type SubscriptionPlan = "free" | "starter" | "pro" | "enterprise";
export type TransactionType = "income" | "expense";

// Income categories
export const INCOME_CATEGORIES = [
  "ad_sale",
  "design",
  "poster_design",
  "video_design",
  "company_profile",
  "ad_credit",
  "eye_drops",
  "other_income",
] as const;

// Expense categories
export const EXPENSE_CATEGORIES = [
  "ad_budget",
  "usdt_purchase",
  "internet_bundle",
  "fuel",
  "food_meals",
  "education",
  "family",
  "designer_contractor",
  "loan",
  "equipment",
  "business_online",
  "vaccine",
  "other_expense",
] as const;

export const PAYMENT_METHODS = [
  "cash",
  "mobile_money",
  "bank_transfer",
  "usdt",
  "airtime",
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
  usd_exchange_rate: number;
  default_ad_rate: number;
  business_type?: string;
  tax_id?: string;
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
  category?: string;
  unit?: string;
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
// NEW: Transaction with profit tracking
// ============================================================
export interface Transaction {
  id: string;
  business_id: string;
  type: TransactionType;
  category: string;
  client_name?: string;
  description: string;
  amount: number;
  ad_usd?: number;
  ad_cost?: number;
  profit?: number;
  margin?: number;
  payment_method?: string;
  reference?: string;
  date: string;
  invoice_id?: string;
  attachment_url?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// NEW: Client ledger entry (from view)
// ============================================================
export interface ClientLedgerEntry {
  client_name: string;
  transaction_count: number;
  total_paid: number;
  total_ad_cost: number;
  total_profit: number;
  total_usd: number;
  last_transaction_date: string;
}

// ============================================================
// NEW: Daily summary entry (from view)
// ============================================================
export interface DailySummary {
  date: string;
  income: number;
  expenses: number;
  ad_cost: number;
  gross_profit: number;
  net_profit: number;
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
  // New profit tracking fields
  totalAdCost?: number;
  grossProfit?: number;
  totalUsd?: number;
  avgMargin?: number;
  salesCount?: number;
}
