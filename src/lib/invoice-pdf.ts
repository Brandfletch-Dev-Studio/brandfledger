"use client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface InvoicePDFData {
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  total: number;
  subtotal?: number;
  tax_rate?: number;
  tax_amount?: number;
  discount_amount?: number;
  notes?: string;
  items?: any[];
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  amount_paid?: number;
  balance_due?: number;
}

export interface BusinessPDFData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  currency?: string;
}

function currencySymbol(currency: string): string {
  const map: Record<string, string> = {
    MWK: "MK",
    USD: "$",
    EUR: "\u20AC",
    GBP: "\u00A3",
    ZAR: "R",
    NGN: "\u20A6",
    KES: "KSh",
    GHS: "\u20B5",
    CAD: "CA$",
    AUD: "A$",
  };
  return map[currency] ?? currency + " ";
}

function formatMoney(amount: number, currency: string): string {
  const sym = currencySymbol(currency);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount || 0));
  return `${amount < 0 ? "-" : ""}${sym}${formatted}`;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "\u2014";
  try {
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(date));
  } catch {
    return String(date);
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "DRAFT",
    sent: "SENT",
    paid: "PAID",
    overdue: "OVERDUE",
    partial: "PARTIALLY PAID",
    pending_verification: "PAYMENT UNDER REVIEW",
  };
  return map[status] ?? status.toUpperCase();
}

function statusColor(status: string): [number, number, number] {
  const map: Record<string, [number, number, number]> = {
    paid: [16, 185, 129],
    sent: [59, 130, 246],
    overdue: [225, 29, 72],
    partial: [245, 158, 11],
    pending_verification: [245, 158, 11],
    draft: [107, 114, 128],
  };
  return map[status] ?? [107, 114, 128];
}

export function generateInvoicePDF(invoice: InvoicePDFData, business: BusinessPDFData): boolean {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const currency = business.currency ?? "MWK";

  // Header band
  doc.setFillColor(79, 70, 229);
  doc.roundedRect(margin, margin, contentWidth, 28, 2, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(business.name || "Your Business", margin + 5, margin + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const contactParts: string[] = [];
  if (business.email) contactParts.push(business.email);
  if (business.phone) contactParts.push(business.phone);
  if (business.address) contactParts.push(business.address);
  if (contactParts.length > 0) {
    doc.text(contactParts.join("  -  "), margin + 5, margin + 18);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(199, 210, 254);
  doc.text("INVOICE", pageWidth - margin - 5, margin + 10, { align: "right" });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text(invoice.invoice_number, pageWidth - margin - 5, margin + 18, { align: "right" });

  // Status badge
  const stColor = statusColor(invoice.status);
  doc.setFillColor(stColor[0], stColor[1], stColor[2]);
  const stText = statusLabel(invoice.status);
  doc.setFontSize(8);
  const stWidth = doc.getTextWidth(stText) + 8;
  doc.roundedRect(pageWidth - margin - stWidth, margin + 32, stWidth, 6, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(stText, pageWidth - margin - stWidth / 2, margin + 36.3, { align: "center" });

  // Bill To + Dates
  let y = margin + 44;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text("BILL TO", margin, y);
  doc.text("ISSUE DATE", pageWidth / 2, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text(invoice.customer_name || "\u2014", margin, y + 5);
  doc.text(formatDate(invoice.issue_date), pageWidth / 2, y + 5);

  if (invoice.customer_email || invoice.customer_phone) {
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    const clientContact: string[] = [];
    if (invoice.customer_email) clientContact.push(invoice.customer_email);
    if (invoice.customer_phone) clientContact.push(invoice.customer_phone);
    doc.text(clientContact.join("  -  "), margin, y + 10);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text("DUE DATE", pageWidth / 2, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text(formatDate(invoice.due_date), pageWidth / 2, y + 15);

  // Items table
  y += 22;

  const items = (invoice.items || []).map((it: any) => {
    const desc = it.name || it.description || "Item";
    const qty = Number(it.quantity ?? 1);
    const unitPrice = Number(it.unit_price ?? it.price ?? it.amount ?? 0);
    const lineTotal = Number(it.total ?? qty * unitPrice);
    return [desc, String(qty), formatMoney(unitPrice, currency), formatMoney(lineTotal, currency)];
  });

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit Price", "Total"]],
    body: items.length > 0 ? items : [["No items", "", "", ""]],
    theme: "striped",
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [17, 24, 39],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.45 },
      1: { cellWidth: contentWidth * 0.15, halign: "center" },
      2: { cellWidth: contentWidth * 0.20, halign: "right" },
      3: { cellWidth: contentWidth * 0.20, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  let afterTableY = ((doc as any).lastAutoTable?.finalY || y + 20) + 10;
  const labelX = pageWidth - margin - 65;
  const valueX = pageWidth - margin;

  doc.setFontSize(9);

  if (Number(invoice.subtotal) > 0 && Number(invoice.subtotal) !== Number(invoice.total)) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text("Subtotal", labelX, afterTableY);
    doc.setTextColor(17, 24, 39);
    doc.text(formatMoney(Number(invoice.subtotal), currency), valueX, afterTableY, { align: "right" });
    afterTableY += 5;
  }

  if (Number(invoice.discount_amount) > 0) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text("Discount", labelX, afterTableY);
    doc.setTextColor(17, 24, 39);
    doc.text("-" + formatMoney(Number(invoice.discount_amount), currency), valueX, afterTableY, { align: "right" });
    afterTableY += 5;
  }

  if (Number(invoice.tax_amount) > 0) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(`Tax (${invoice.tax_rate || 0}%)`, labelX, afterTableY);
    doc.setTextColor(17, 24, 39);
    doc.text(formatMoney(Number(invoice.tax_amount), currency), valueX, afterTableY, { align: "right" });
    afterTableY += 5;
  }

  if (Number(invoice.amount_paid) > 0 && Number(invoice.balance_due) > 0) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text("Amount Paid", labelX, afterTableY);
    doc.setTextColor(16, 185, 129);
    doc.text(formatMoney(Number(invoice.amount_paid), currency), valueX, afterTableY, { align: "right" });
    afterTableY += 5;

    doc.setTextColor(107, 114, 128);
    doc.text("Balance Due", labelX, afterTableY);
    doc.setTextColor(225, 29, 72);
    doc.text(formatMoney(Number(invoice.balance_due), currency), valueX, afterTableY, { align: "right" });
    afterTableY += 5;
  }

  // Total line
  afterTableY += 2;
  doc.setDrawColor(229, 231, 235);
  doc.line(labelX, afterTableY, valueX, afterTableY);
  afterTableY += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text("TOTAL", labelX, afterTableY);
  doc.setTextColor(79, 70, 229);
  doc.text(formatMoney(Number(invoice.total), currency), valueX, afterTableY, { align: "right" });

  // Notes
  if (invoice.notes) {
    afterTableY += 12;
    if (afterTableY > pageHeight - 40) {
      doc.addPage();
      afterTableY = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text("NOTES", margin, afterTableY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    const splitNotes = doc.splitTextToSize(invoice.notes, contentWidth);
    doc.text(splitNotes, margin, afterTableY + 5);
  }

  // Footer
  const footerY = pageHeight - 15;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `Invoice ${invoice.invoice_number} - Generated by Brandfledger - ${formatDate(new Date().toISOString())}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  const safeName = (invoice.invoice_number || "invoice").replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`${safeName}.pdf`);
  return true;
}
