import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUSINESS_ID = "7ef9b060-7679-46ce-a17e-9c6aefa84320";
const EXCHANGE_RATE = 4300;

interface TxEntry {
  type: "income" | "expense";
  date: string;
  client_name?: string;
  vendor_name?: string;
  description: string;
  amount: number;
  cost_qty?: number;
  category_name?: string;
}

interface InvoiceEntry {
  date: string;
  customer_name: string;
  total: number;
  description: string;
  cost_qty?: number;
}

// All income transactions (paid entries)
const incomeEntries: TxEntry[] = [
  // July 1
  { type: "income", date: "2026-07-01", client_name: "Radiant Son", description: "$2 ad", amount: 12000, cost_qty: 2, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-01", client_name: "Smart Poultry Farming", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-01", client_name: "Hamaz Boreholes Ltd", description: "$7 ad", amount: 39500, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-01", client_name: "Tryv", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-01", client_name: "Brandfletch Designs", description: "Company profile", amount: 92000, cost_qty: 0, category_name: "Design" },
  { type: "income", date: "2026-07-01", client_name: "RJ Car Dealers", description: "$6 ads (plus 20k credit)", amount: 30000, cost_qty: 6, category_name: "Ad Sales" },
  // July 2
  { type: "income", date: "2026-07-02", client_name: "Sanna K", description: "Poster + $7 ad (balance 12k)", amount: 42000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-02", client_name: "Best Steel", description: "$7 ad", amount: 40000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-02", client_name: "Quick Mind", description: "$2 ad", amount: 12000, cost_qty: 2, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-02", client_name: "Ngwazi Motors", description: "$7 ad", amount: 40000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-02", client_name: "Naomi Glam Hub", description: "$1 ad + poster design", amount: 26000, cost_qty: 1, category_name: "Ad Sales" },
  // July 3
  { type: "income", date: "2026-07-03", client_name: "Tapiwa Bridal", description: "$5 ad", amount: 30000, cost_qty: 5, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-03", client_name: "Mapalo Banda", description: "$10 ad + poster + video design (balance 55k)", amount: 70000, cost_qty: 10, category_name: "Ad Sales" },
  // July 4
  { type: "income", date: "2026-07-04", client_name: "Naomi", description: "$3 ad", amount: 18000, cost_qty: 3, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-04", client_name: "Bemeza Security", description: "$4 ad", amount: 24000, cost_qty: 4, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-04", client_name: "Smart Poultry", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-04", client_name: "Radiant Son", description: "$2 ad", amount: 12000, cost_qty: 2, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-04", client_name: "ZCS Screen Printing", description: "$7 ad + design", amount: 49000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-04", client_name: "Quick Mind", description: "$3 ad", amount: 18000, cost_qty: 3, category_name: "Ad Sales" },
  // July 5
  { type: "income", date: "2026-07-05", client_name: "Naomi", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-05", client_name: "Naomi", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-05", client_name: "Sishy Collection", description: "$7 ad", amount: 39000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-05", client_name: "Naomi", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-05", client_name: "Radiant Son", description: "$3 ad", amount: 18000, cost_qty: 3, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-05", client_name: "Africabrief", description: "$7 ad", amount: 39000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-05", client_name: "Bemeza Security", description: "$4 ad", amount: 24000, cost_qty: 4, category_name: "Ad Sales" },
  // July 6
  { type: "income", date: "2026-07-06", client_name: "Humble Bridal", description: "$5 ad + design", amount: 49000, cost_qty: 5, category_name: "Ad Sales" },
  // July 7
  { type: "income", date: "2026-07-07", client_name: "Sanna K", description: "$7 ad", amount: 39000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-07", client_name: "Vinda", description: "$16 ad", amount: 80000, cost_qty: 16, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-07", client_name: "Annet (Opulent Boutique)", description: "Poster design", amount: 20000, cost_qty: 0, category_name: "Design" },
  { type: "income", date: "2026-07-07", client_name: "Mapalo Banda", description: "Balance payment", amount: 55000, cost_qty: 0, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-07", client_name: "Goba", description: "$7 ad", amount: 39000, cost_qty: 7, category_name: "Ad Sales" },
  // July 8
  { type: "income", date: "2026-07-07", client_name: "Naomi", description: "$1 ad (logged on Jul 8 for previous day)", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-08", client_name: "Tryv", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-08", client_name: "Prisca", description: "$2 ad", amount: 12000, cost_qty: 2, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-08", client_name: "Dream Catcher", description: "$21 ad", amount: 105000, cost_qty: 21, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-08", client_name: "Smart Poultry", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-08", client_name: "Rora", description: "$7 ad", amount: 39000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-08", client_name: "Bemeza Security", description: "$6 ad", amount: 36000, cost_qty: 6, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-08", client_name: "Pastor Khuwayo", description: "$4 ad", amount: 20000, cost_qty: 4, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-08", client_name: "Tryv", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-08", client_name: "JC Cakes", description: "$5 ad", amount: 30000, cost_qty: 5, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-08", client_name: "Novexa", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  // July 9
  { type: "income", date: "2026-07-09", client_name: "Ngwazi", description: "$7 ad", amount: 39000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-09", client_name: "Quick Mind", description: "$3 ad", amount: 18000, cost_qty: 3, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-09", client_name: "Radiant Son", description: "$2 ad", amount: 12000, cost_qty: 2, category_name: "Ad Sales" },
  // July 10
  { type: "income", date: "2026-07-10", client_name: "Harry", description: "Annual fees at ACA", amount: 80000, cost_qty: 0, category_name: "Services" },
  { type: "income", date: "2026-07-10", client_name: "Vinda", description: "$16 ad", amount: 80000, cost_qty: 16, category_name: "Ad Sales" },
  // July 11
  { type: "income", date: "2026-07-11", client_name: "Kayira", description: "$2 ad", amount: 12000, cost_qty: 2, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-11", client_name: "Zomba College", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  // July 12
  { type: "income", date: "2026-07-12", client_name: "Radiant Son", description: "$2 ad", amount: 12000, cost_qty: 2, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-12", client_name: "Naomi", description: "$1 ad", amount: 5000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-12", client_name: "Smart Poultry", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-12", client_name: "OD Appliances", description: "$21 ad", amount: 105000, cost_qty: 21, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-12", client_name: "Akonzi Furniture", description: "$7 ad", amount: 39000, cost_qty: 7, category_name: "Ad Sales" },
  // July 13
  { type: "income", date: "2026-07-13", client_name: "Quick Mind", description: "$7 ad", amount: 42000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-13", client_name: "Bemeza", description: "$2 ad", amount: 12000, cost_qty: 2, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-13", client_name: "Stardom Printers", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-13", client_name: "Cymac", description: "$7 ad", amount: 39000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-13", client_name: "Naomi", description: "$1 ad", amount: 7000, cost_qty: 1, category_name: "Ad Sales" },
  // July 14
  { type: "income", date: "2026-07-14", client_name: "Quick Mind", description: "$7 ad", amount: 42000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-14", client_name: "Lettie", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-14", client_name: "Sanna K", description: "$5 ad", amount: 30000, cost_qty: 5, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-14", client_name: "Naomi", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-14", client_name: "Quick Mind", description: "$3 ad", amount: 18000, cost_qty: 3, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-14", client_name: "Goba", description: "$7 ad", amount: 39000, cost_qty: 7, category_name: "Ad Sales" },
  // July 15
  { type: "income", date: "2026-07-15", client_name: "Naomi", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-15", client_name: "Pasca", description: "$6 ad", amount: 30000, cost_qty: 6, category_name: "Ad Sales" },
  // July 16
  { type: "income", date: "2026-07-16", client_name: "Stardom", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-16", client_name: "Tryv", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-16", client_name: "Dream Catcher", description: "$21 ad", amount: 105000, cost_qty: 21, category_name: "Ad Sales" },
  // July 17
  { type: "income", date: "2026-07-17", client_name: "Akonzi Furniture", description: "$7 ad", amount: 39000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-17", client_name: "Smart Poultry", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  // July 18
  { type: "income", date: "2026-07-18", client_name: "Prisca Importer", description: "$2 ad", amount: 12000, cost_qty: 2, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-18", client_name: "Little Lullabies", description: "$7 ad", amount: 39000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-18", client_name: "Tapiwa Bridal", description: "$5 ad", amount: 30000, cost_qty: 5, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-18", client_name: "JC Cakes", description: "$5 ad", amount: 30000, cost_qty: 5, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-18", client_name: "Humble Bridal", description: "$5 ad", amount: 30000, cost_qty: 5, category_name: "Ad Sales" },
  // July 19
  { type: "income", date: "2026-07-19", client_name: "Quick Mind", description: "$7 ad", amount: 42000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-19", client_name: "Naomi", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-19", client_name: "Sishy", description: "$7 ad", amount: 39000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-19", client_name: "Titan Geoforce Ventures", description: "$5 ad", amount: 30000, cost_qty: 5, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-19", client_name: "Wakulu Mpaganja", description: "$7 ad", amount: 39000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-19", client_name: "Ma Gusto", description: "Eye drops", amount: 2100, cost_qty: 0, category_name: "Eye Drops" },
  { type: "income", date: "2026-07-19", client_name: "Ma Bertha", description: "Eye drops", amount: 4000, cost_qty: 0, category_name: "Eye Drops" },
  { type: "income", date: "2026-07-19", client_name: "Ma Junior", description: "Eye drops", amount: 5000, cost_qty: 0, category_name: "Eye Drops" },
  { type: "income", date: "2026-07-19", client_name: "Nachisale", description: "Eye drops (paid with chicken)", amount: 4000, cost_qty: 0, category_name: "Eye Drops" },
  { type: "income", date: "2026-07-19", client_name: "Ummar", description: "$10 ad funding", amount: 50000, cost_qty: 10, category_name: "Ad Sales" },
  // July 20
  { type: "income", date: "2026-07-20", client_name: "Radiant Son", description: "$2 ad", amount: 12000, cost_qty: 2, category_name: "Ad Sales" },
  // July 21
  { type: "income", date: "2026-07-21", client_name: "Sanna K", description: "$7 ad", amount: 42000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-21", client_name: "Home Pro", description: "$7 ad", amount: 42000, cost_qty: 7, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-21", client_name: "Gouji", description: "$9 ad", amount: 45000, cost_qty: 9, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-21", client_name: "Nexflux", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-21", client_name: "Naomi Glam Hub", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  // July 22
  { type: "income", date: "2026-07-22", client_name: "Dymark", description: "$20 ad", amount: 100000, cost_qty: 20, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-22", client_name: "Bemeza", description: "$1 ad", amount: 6000, cost_qty: 1, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-22", client_name: "Ezra Shopping", description: "$7 ad", amount: 42000, cost_qty: 7, category_name: "Ad Sales" },
  // July 23
  { type: "income", date: "2026-07-23", client_name: "Kayira", description: "$2 ad", amount: 12000, cost_qty: 2, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-23", client_name: "Radiant Son", description: "$3 ad", amount: 18000, cost_qty: 3, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-23", client_name: "Prisca Importer", description: "$2 ad", amount: 12000, cost_qty: 2, category_name: "Ad Sales" },
  { type: "income", date: "2026-07-23", client_name: "Pastor Khuwayo", description: "$7 ad", amount: 42000, cost_qty: 7, category_name: "Ad Sales" },
];

// All expense transactions
const expenseEntries: TxEntry[] = [
  // July 2
  { type: "expense", date: "2026-07-02", vendor_name: "Asher", description: "Loan repayment", amount: 35000, category_name: "Loan" },
  { type: "expense", date: "2026-07-02", vendor_name: "Daniel Chidike", description: "Designer fee", amount: 120000, category_name: "Design" },
  { type: "expense", date: "2026-07-02", vendor_name: "Chim Kalongonda", description: "WiFi router (Airtel agent)", amount: 30000, category_name: "Equipment" },
  // July 4
  { type: "expense", date: "2026-07-04", description: "$27 ad purchase", amount: 116100, category_name: "Ad Spend" },
  // July 5
  { type: "expense", date: "2026-07-05", description: "$87 ad purchase", amount: 374000, category_name: "Ad Spend" },
  { type: "expense", date: "2026-07-05", description: "Home usage and phone charge", amount: 36000, category_name: "Personal" },
  // July 6
  { type: "expense", date: "2026-07-06", vendor_name: "Asher", description: "Travel fuel", amount: 10000, category_name: "Fuel" },
  { type: "expense", date: "2026-07-06", vendor_name: "Smart Designs", description: "Airtime bonus", amount: 20000, category_name: "Bonus" },
  { type: "expense", date: "2026-07-06", description: "53 USDT at 4100", amount: 217000, category_name: "USDT" },
  // July 7
  { type: "expense", date: "2026-07-07", vendor_name: "Asher", description: "Lunch", amount: 4200, category_name: "Meals" },
  { type: "expense", date: "2026-07-07", description: "40 USDT purchase", amount: 172000, category_name: "USDT" },
  // July 8
  { type: "expense", date: "2026-07-08", description: "Gnuts topup", amount: 32000, category_name: "Supplies" },
  { type: "expense", date: "2026-07-08", description: "Google developer account reg ($25)", amount: 107500, category_name: "Software" },
  { type: "expense", date: "2026-07-08", description: "Nyasadesk.com registration at Hostinger ($10.2)", amount: 43860, category_name: "Software" },
  { type: "expense", date: "2026-07-08", vendor_name: "Asher", description: "Internet bundle", amount: 2500, category_name: "Internet" },
  { type: "expense", date: "2026-07-08", description: "Internet bundle", amount: 2500, category_name: "Internet" },
  { type: "expense", date: "2026-07-08", description: "Mom upkeep", amount: 4500, category_name: "Personal" },
  { type: "expense", date: "2026-07-08", vendor_name: "Jonathan Richard", description: "Physics lessons", amount: 50000, category_name: "Education" },
  { type: "expense", date: "2026-07-08", vendor_name: "Gloria Makina", description: "Language lessons", amount: 50000, category_name: "Education" },
  { type: "expense", date: "2026-07-08", vendor_name: "Harris", description: "Math lessons", amount: 100000, category_name: "Education" },
  // July 9
  { type: "expense", date: "2026-07-09", description: "Fuel", amount: 7000, category_name: "Fuel" },
  { type: "expense", date: "2026-07-09", vendor_name: "Asher", description: "Lunch", amount: 4000, category_name: "Meals" },
  { type: "expense", date: "2026-07-09", description: "23 USDT purchase", amount: 99000, category_name: "USDT" },
  // July 12
  { type: "expense", date: "2026-07-12", vendor_name: "Asher", description: "Meals upkeep", amount: 17000, category_name: "Meals" },
  { type: "expense", date: "2026-07-12", description: "Dad fuel", amount: 7000, category_name: "Fuel" },
  // July 14
  { type: "expense", date: "2026-07-14", description: "Self-promotion: $8 ad for designs", amount: 34400, category_name: "Ad Spend" },
  { type: "expense", date: "2026-07-14", description: "Chibondo Academy: $7 ad for enrollment", amount: 30100, category_name: "Ad Spend" },
  { type: "expense", date: "2026-07-14", description: "Dad fuel", amount: 14000, category_name: "Fuel" },
  { type: "expense", date: "2026-07-14", description: "Self-promotion: $21 ad for ads", amount: 90300, category_name: "Ad Spend" },
  { type: "expense", date: "2026-07-14", description: "$45 ad purchase", amount: 193500, category_name: "Ad Spend" },
  // July 15
  { type: "expense", date: "2026-07-15", vendor_name: "Jonathan Richard", description: "Video lessons", amount: 54000, category_name: "Education" },
  // July 16
  { type: "expense", date: "2026-07-16", vendor_name: "Asher", description: "Loan repayment", amount: 16000, category_name: "Loan" },
  { type: "expense", date: "2026-07-16", description: "Internet bundle", amount: 40000, category_name: "Internet" },
  { type: "expense", date: "2026-07-16", description: "USDT purchase", amount: 340000, category_name: "USDT" },
  // July 19
  { type: "expense", date: "2026-07-19", description: "Eye chick vaccine", amount: 20000, category_name: "Supplies" },
];

// All invoices (invoiced/ordered entries — not yet paid)
const invoiceEntries: InvoiceEntry[] = [
  { date: "2026-07-03", customer_name: "Pasca", total: 39000, description: "$7 ad", cost_qty: 7 },
  { date: "2026-07-03", customer_name: "Elim Finance", total: 21500, description: "$5 ad", cost_qty: 5 },
  { date: "2026-07-10", customer_name: "Vinda", total: 80000, description: "$16 ad", cost_qty: 16 },
  { date: "2026-07-15", customer_name: "Vinda", total: 80000, description: "$16 ad", cost_qty: 16 },
  { date: "2026-07-15", customer_name: "Jonathan Richard", total: 54000, description: "Ads plus design", cost_qty: 0 },
  { date: "2026-07-19", customer_name: "Vinda", total: 80000, description: "$16 ad", cost_qty: 16 },
  { date: "2026-07-19", customer_name: "John", total: 5800, description: "Eye drops", cost_qty: 0 },
  { date: "2026-07-19", customer_name: "Obv", total: 10000, description: "Eye drops", cost_qty: 0 },
  { date: "2026-07-19", customer_name: "Dalia", total: 1000, description: "Eye drops", cost_qty: 0 },
  { date: "2026-07-19", customer_name: "Guero", total: 800, description: "Eye drops", cost_qty: 0 },
  { date: "2026-07-19", customer_name: "Binali", total: 2600, description: "Eye drops", cost_qty: 0 },
  { date: "2026-07-23", customer_name: "Vinda", total: 80000, description: "$16 ad", cost_qty: 16 },
];

export async function POST() {
  try {
    let incomeCount = 0;
    let expenseCount = 0;
    let invoiceCount = 0;
    const errors: string[] = [];

    // 1. Insert all income transactions
    for (const entry of incomeEntries) {
      try {
        const { error } = await supabase.from('transactions').insert({
          business_id: BUSINESS_ID,
          type: 'income',
          client_name: entry.client_name,
          description: entry.description,
          amount: entry.amount,
          cost_qty: entry.cost_qty || 0,
          category_name: entry.category_name,
          date: entry.date,
          payment_method: 'cash'
        });
        if (error) throw error;
        incomeCount++;
      } catch (err: any) {
        errors.push(`Income ${entry.date} ${entry.client_name}: ${err.message}`);
      }
    }

    // 2. Insert all expense transactions
    for (const entry of expenseEntries) {
      try {
        const { error } = await supabase.from('transactions').insert({
          business_id: BUSINESS_ID,
          type: 'expense',
          vendor_name: entry.vendor_name || null,
          description: entry.description,
          amount: entry.amount,
          category_name: entry.category_name,
          date: entry.date,
          payment_method: 'cash'
        });
        if (error) throw error;
        expenseCount++;
      } catch (err: any) {
        errors.push(`Expense ${entry.date} ${entry.description}: ${err.message}`);
      }
    }

    // 3. Create invoices for "invoiced" entries
    // First, get the current max invoice number
    const { data: maxInvData, error: maxInvError } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('business_id', BUSINESS_ID)
      .order('invoice_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxInvError) throw maxInvError;

    let invNum = 1;
    if (maxInvData) {
      const match = maxInvData.invoice_number.match(/(\d+)$/);
      if (match) invNum = parseInt(match[1]) + 1;
    }

    for (const inv of invoiceEntries) {
      try {
        // Find or create customer
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('id')
          .eq('business_id', BUSINESS_ID)
          .eq('name', inv.customer_name)
          .limit(1)
          .maybeSingle();

        if (customerError) throw customerError;

        let customerId: string;
        if (!customerData) {
          const { data: newCust, error: newCustError } = await supabase
            .from('customers')
            .insert({ business_id: BUSINESS_ID, name: inv.customer_name })
            .select('id')
            .single();

          if (newCustError) throw newCustError;
          customerId = newCust.id;
        } else {
          customerId = customerData.id;
        }

        const invoiceNumber = `BFA-${String(invNum).padStart(5, "0")}`;
        invNum++;

        const { error: insertInvError } = await supabase
          .from('invoices')
          .insert({
            business_id: BUSINESS_ID,
            customer_id: customerId,
            invoice_number: invoiceNumber,
            status: 'sent',
            issue_date: inv.date,
            due_date: inv.date,
            items: [{ name: inv.description, total: inv.total, quantity: 1, unit_price: inv.total, description: "" }],
            subtotal: inv.total,
            total: inv.total
          });
        if (insertInvError) throw insertInvError;

        invoiceCount++;
      } catch (err: any) {
        errors.push(`Invoice ${inv.date} ${inv.customer_name}: ${err.message}`);
      }
    }

    // Get summary by fetching all records and computing in JS
    const { data: txs, error: txsError } = await supabase
      .from('transactions')
      .select('*')
      .eq('business_id', BUSINESS_ID);

    if (txsError) throw txsError;

    let total = 0;
    let income_count = 0;
    let expense_count = 0;
    let total_income = 0;
    let total_expenses = 0;
    let total_cost = 0;
    let total_profit = 0;

    if (txs) {
      total = txs.length;
      for (const tx of txs) {
        if (tx.type === 'income') {
          income_count++;
          total_income += Number(tx.amount || 0);
          total_cost += Number(tx.cost_amount || 0);
          total_profit += Number(tx.profit || 0);
        } else if (tx.type === 'expense') {
          expense_count++;
          total_expenses += Number(tx.amount || 0);
        }
      }
    }

    const summaryObj = {
      total,
      income_count,
      expense_count,
      total_income,
      total_expenses,
      total_cost,
      total_profit
    };

    return NextResponse.json({
      success: true,
      imported: {
        income: incomeCount,
        expenses: expenseCount,
        invoices: invoiceCount,
        total: incomeCount + expenseCount + invoiceCount,
      },
      summary: summaryObj,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}