"use client";
import { useState, useEffect, useRef } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileText, CheckCircle2, Clock, Upload, Phone, X, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { useParams } from "next/navigation";

export default function PublicInvoiceView() {
  const params = useParams();
  const invoiceId = params.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTab, setPayTab] = useState<"mobile" | "upload">("mobile");
  const [paying, setPaying] = useState(false);
  const [payStatus, setPayStatus] = useState<"idle" | "polling" | "success" | "failed">("idle");
  const [payMessage, setPayMessage] = useState("");
  const [chargeId, setChargeId] = useState("");

  // Mobile money form
  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState("");
  const [payerName, setPayerName] = useState("");

  // Proof upload form
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/invoices/view?id=${invoiceId}`);
        if (!res.ok) {
          if (res.status === 404) setError("Invoice not found");
          else if (res.status === 400) setError("Invalid invoice link");
          else setError("Failed to load invoice");
          return;
        }
        const d = await res.json();
        setData(d);
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [invoiceId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function handlePaychanguPayment() {
    if (!phone.trim()) { setPayMessage("Enter your phone number"); return; }
    setPaying(true);
    setPayStatus("idle");
    setPayMessage("");

    try {
      const res = await fetch("/api/invoices/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: invoiceId,
          phone: phone.trim(),
          operator: operator || undefined,
          payer_name: payerName.trim() || undefined,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        setPayMessage(result.error || "Payment failed to start");
        setPaying(false);
        return;
      }

      setChargeId(result.chargeId);
      setPayStatus("polling");
      setPayMessage(result.message || "Check your phone and approve the payment prompt.");

      // Poll for payment status
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        if (attempts > 30) { // ~5 min timeout
          if (pollRef.current) clearInterval(pollRef.current);
          setPayStatus("failed");
          setPayMessage("Payment timed out. Please try again.");
          setPaying(false);
          return;
        }

        try {
          const pollRes = await fetch(`/api/invoices/verify-payment?charge_id=${result.chargeId}`);
          const pollData = await pollRes.json();

          if (pollData.status === "success") {
            if (pollRef.current) clearInterval(pollRef.current);
            setPayStatus("success");
            setPayMessage("Payment confirmed! Thank you.");
            setPaying(false);
            // Reload invoice data
            const refreshRes = await fetch(`/api/invoices/view?id=${invoiceId}`);
            if (refreshRes.ok) setData(await refreshRes.json());
          } else if (pollData.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setPayStatus("failed");
            setPayMessage(pollData.reason === "timeout" ? "Payment timed out." : "Payment was declined or cancelled.");
            setPaying(false);
          }
        } catch {}
      }, 10000); // poll every 10 seconds
    } catch {
      setPayMessage("Network error. Please try again.");
      setPaying(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPayMessage("File too large. Maximum 5MB.");
      return;
    }
    setProofFile(file);
    setPayMessage("");

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setProofPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setProofPreview("");
    }
  }

  async function handleProofUpload() {
    if (!proofFile) { setPayMessage("Select a proof of payment file first"); return; }
    setUploading(true);
    setPayMessage("");

    try {
    // Convert to base64
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64Data = result.split(",")[1] || result;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(proofFile);
    });

    const res = await fetch("/api/invoices/proof", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice_id: invoiceId,
        proof_base64: base64,
        proof_filename: proofFile.name,
        proof_content_type: proofFile.type,
        payer_name: payerName.trim() || undefined,
        payer_phone: phone.trim() || undefined,
      }),
    });
    const result = await res.json();

    if (!res.ok) {
      setPayMessage(result.error || "Upload failed");
    } else {
      setUploadDone(true);
      setPayMessage(result.message || "Proof uploaded successfully.");
      // Reload invoice data
      const refreshRes = await fetch(`/api/invoices/view?id=${invoiceId}`);
      if (refreshRes.ok) setData(await refreshRes.json());
    }
  } catch {
    setPayMessage("Network error. Please try again.");
  } finally {
    setUploading(false);
  }
  }

  function closeModal() {
    if (pollRef.current) clearInterval(pollRef.current);
    setShowPayModal(false);
    setPayStatus("idle");
    setPayMessage("");
    setProofFile(null);
    setProofPreview("");
    setUploadDone(false);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="animate-pulse text-muted-foreground">Loading invoice...</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center space-y-3">
        <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto" />
        <h1 className="text-xl font-semibold">{error}</h1>
        <p className="text-muted-foreground text-sm">This invoice may have been deleted or the link is invalid.</p>
      </div>
    </div>
  );

  const { invoice, business, customer } = data;
  const currency = business?.currency ?? "MWK";
  const items = invoice.items || [];

  const balanceDue = Number(invoice.balance_due || (invoice.total - (invoice.amount_paid || 0)));
  const amountPaid = Number(invoice.amount_paid || 0);
  const isPaid = balanceDue <= 0;
  const isPendingVerification = invoice.status === "pending_verification";

  const statusConfig: Record<string, { label: string; color: string }> = {
    draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
    sent: { label: "Sent", color: "bg-blue-100 text-blue-700" },
    paid: { label: "Paid", color: "bg-emerald-100 text-emerald-700" },
    partial: { label: "Partial Payment", color: "bg-amber-100 text-amber-700" },
    overdue: { label: "Overdue", color: "bg-rose-100 text-rose-700" },
    pending_verification: { label: "Payment Under Review", color: "bg-purple-100 text-purple-700" },
  };
  const status = statusConfig[invoice.status] ?? statusConfig.draft;

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-3">
      <div className="max-w-2xl mx-auto bg-card rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{business?.name ?? "Invoice"}</h1>
              <p className="opacity-80 text-sm mt-1">{business?.email ?? ""}</p>
              {business?.phone && <p className="opacity-80 text-sm">{business.phone}</p>}
              {business?.address && <p className="opacity-80 text-sm">{business.address}</p>}
            </div>
            <div className="text-right">
              <p className="opacity-70 text-xs uppercase tracking-wider">Invoice</p>
              <p className="text-lg font-bold mt-1">{invoice.invoice_number}</p>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className="px-6 sm:px-8 pt-4 flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
          {isPaid && (
            <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" /> Fully Paid
            </span>
          )}
        </div>

        {/* Payment banner for pending verification */}
        {isPendingVerification && (
          <div className="mx-6 sm:mx-8 mt-3 rounded-lg bg-purple-50 border border-purple-200 p-3 flex items-start gap-2">
            <Clock className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-purple-900">Payment under review</p>
              <p className="text-xs text-purple-700 mt-0.5">Proof of payment has been submitted. The business owner will confirm your payment shortly.</p>
            </div>
          </div>
        )}

        {/* Bill to + dates */}
        <div className="px-6 sm:px-8 py-4 flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Bill To</p>
            <p className="font-medium">{customer?.name ?? invoice.customer_name ?? "Unknown"}</p>
            {customer?.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
            {customer?.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
          </div>
          <div className="sm:text-right space-y-1">
            <p className="text-sm"><span className="text-muted-foreground">Issued: </span><span className="font-medium">{formatDate(invoice.issue_date)}</span></p>
            <p className="text-sm"><span className="text-muted-foreground">Due: </span><span className="font-medium">{invoice.due_date ? formatDate(invoice.due_date) : "—"}</span></p>
          </div>
        </div>

        {/* Items table */}
        <div className="px-6 sm:px-8 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left font-semibold text-muted-foreground p-2">Description</th>
                  <th className="text-center font-semibold text-muted-foreground p-2 w-12">Qty</th>
                  <th className="text-right font-semibold text-muted-foreground p-2 w-24">Price</th>
                  <th className="text-right font-semibold text-muted-foreground p-2 w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2">
                      <p className="font-medium">{item.name}</p>
                      {item.description && item.description !== item.name && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                    </td>
                    <td className="p-2 text-center">{item.quantity}</td>
                    <td className="p-2 text-right">{formatCurrency(Number(item.unit_price), currency)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(Number(item.total), currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="px-6 sm:px-8 pb-4 flex justify-end">
          <div className="w-full sm:w-64 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(Number(invoice.subtotal), currency)}</span>
            </div>
            {Number(invoice.tax_rate) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({invoice.tax_rate}%)</span>
                <span className="font-medium">{formatCurrency(Number(invoice.tax_amount), currency)}</span>
              </div>
            )}
            {amountPaid > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-medium text-emerald-600">{formatCurrency(amountPaid, currency)}</span>
              </div>
            )}
            <div className="border-t pt-1.5 flex justify-between">
              <span className="font-semibold">{isPaid ? "Total" : "Balance Due"}</span>
              <span className={`font-bold text-lg ${isPaid ? "text-emerald-600" : "text-primary"}`}>
                {formatCurrency(isPaid ? Number(invoice.total) : balanceDue, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Pay Now button */}
        {!isPaid && !isPendingVerification && (
          <div className="px-6 sm:px-8 pb-4">
            <button
              onClick={() => setShowPayModal(true)}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Phone className="h-4 w-4" />
              Pay {formatCurrency(balanceDue, currency)}
            </button>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="px-6 sm:px-8 pb-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 sm:px-8 py-6 border-t text-center">
          <p className="text-xs text-muted-foreground">
            {business?.name ?? ""}{business?.email ? ` · ${business.email}` : ""}{business?.phone ? ` · ${business.phone}` : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Powered by <span className="font-semibold">Brandfledger</span>
          </p>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={closeModal}>
          <div
            className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* Modal header */}
            <div className="sticky top-0 bg-card border-b px-5 py-4 flex items-center justify-between z-10">
              <h2 className="font-semibold text-lg">Pay {formatCurrency(balanceDue, currency)}</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Success state */}
            {payStatus === "success" || uploadDone ? (
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-lg">{uploadDone ? "Proof Uploaded" : "Payment Confirmed!"}</p>
                  <p className="text-sm text-muted-foreground mt-1">{payMessage}</p>
                </div>
                <button onClick={closeModal} className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-medium text-sm">
                  Done
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Tab switcher */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setPayTab("mobile")}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                      payTab === "mobile" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    Mobile Money
                  </button>
                  <button
                    onClick={() => setPayTab("upload")}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                      payTab === "upload" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    Upload Proof
                  </button>
                </div>

                {/* Payer name (shared) */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Your Name (optional)</label>
                  <input
                    type="text"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full rounded-lg border border-input bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Mobile Money Tab */}
                {payTab === "mobile" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone Number</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0991234567"
                        className="w-full rounded-lg border border-input bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Enter the number registered with your mobile money account.</p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Operator (auto-detected)</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setOperator("airtel")}
                          className={`flex-1 rounded-lg py-2 text-sm font-medium border ${operator === "airtel" || (!operator && phone && !phone.match(/^(88|89)/)) ? "border-primary bg-primary/5" : "border-input bg-white"}`}
                        >
                          Airtel Money
                        </button>
                        <button
                          onClick={() => setOperator("tnm")}
                          className={`flex-1 rounded-lg py-2 text-sm font-medium border ${operator === "tnm" ? "border-primary bg-primary/5" : "border-input bg-white"}`}
                        >
                          TNM Mpamba
                        </button>
                      </div>
                    </div>

                    {payStatus === "polling" ? (
                      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-center space-y-2">
                        <Loader2 className="h-6 w-6 text-blue-600 animate-spin mx-auto" />
                        <p className="text-sm text-blue-700 font-medium">{payMessage}</p>
                        <p className="text-xs text-blue-600">Waiting for payment confirmation...</p>
                      </div>
                    ) : payStatus === "failed" ? (
                      <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-rose-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-rose-700">{payMessage}</p>
                      </div>
                    ) : null}

                    {payMessage && payStatus === "idle" && (
                      <p className="text-sm text-rose-600">{payMessage}</p>
                    )}

                    <button
                      onClick={handlePaychanguPayment}
                      disabled={paying || payStatus === "polling"}
                      className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {paying || payStatus === "polling" ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                      ) : (
                        <>Pay {formatCurrency(balanceDue, currency)}</>
                      )}
                    </button>
                  </>
                )}

                {/* Upload Proof Tab */}
                {payTab === "upload" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone Number (optional)</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0991234567"
                        className="w-full rounded-lg border border-input bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Proof of Payment</label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full rounded-xl border-2 border-dashed border-input bg-muted/30 py-6 flex flex-col items-center gap-2 hover:bg-muted/50 transition-colors"
                      >
                        {proofPreview ? (
                          <img src={proofPreview} alt="Proof preview" className="max-h-32 rounded-lg" />
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Tap to upload screenshot or photo</span>
                            <span className="text-xs text-muted-foreground/70">JPG, PNG, WebP, or PDF · Max 5MB</span>
                          </>
                        )}
                      </button>
                      {proofFile && !proofPreview && (
                        <p className="text-xs text-muted-foreground mt-1.5 truncate">{proofFile.name}</p>
                      )}
                    </div>

                    {payMessage && payStatus === "idle" && (
                      <p className="text-sm text-rose-600">{payMessage}</p>
                    )}

                    <button
                      onClick={handleProofUpload}
                      disabled={uploading || !proofFile}
                      className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {uploading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                      ) : (
                        <>Submit Proof</>
                      )}
                    </button>

                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700">Your payment will be marked as "under review" until the business owner verifies it.</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
