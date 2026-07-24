import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// This endpoint checks all businesses for trial status and creates notifications
// Called by Vercel cron daily, or manually via POST/GET

async function runTrialCheck() {
  try {
    // Find businesses in trial with 5, 3, or 1 days left that haven't been notified
    const businesses = await query(`
      SELECT b.id, b.name, b.email, b.trial_ends_at,
        EXTRACT(DAY FROM b.trial_ends_at - now()) as days_left
      FROM businesses b
      WHERE b.subscription_status = 'trial'
        AND b.trial_ends_at IS NOT NULL
        AND b.trial_ends_at > now()
    `);

    let notificationsCreated = 0;

    for (const biz of businesses) {
      const daysLeft = Math.ceil(Number(biz.days_left));

      // Notify at 5, 3, and 1 day(s) left
      if (![5, 3, 1].includes(daysLeft)) continue;

      // Check if we already sent a notification for this day threshold
      const existing = await query(
        `SELECT id FROM notifications 
         WHERE business_id = $1 AND type = 'trial_reminder' 
         AND created_at > now() - INTERVAL '26 hours'`,
        [biz.id]
      );

      if (existing.length > 0) continue;

      let title = "";
      let message = "";

      if (daysLeft === 5) {
        title = "5 days left in your trial";
        message = `Hi ${biz.name}, your Brandfledger free trial ends in 5 days. Subscribe to keep full access to all features.`;
      } else if (daysLeft === 3) {
        title = "3 days left — don't lose access";
        message = `Your free trial ends in 3 days. Subscribe now to avoid interruption to your business finances.`;
      } else if (daysLeft === 1) {
        title = "Last day of your free trial!";
        message = `Your Brandfledger trial ends tomorrow. Subscribe today to keep creating transactions, invoices, and managing your finances.`;
      }

      await query(
        `INSERT INTO notifications (business_id, type, title, message) VALUES ($1, 'trial_reminder', $2, $3)`,
        [biz.id, title, message]
      );

      notificationsCreated++;
    }

    // Also check for expired trials
    const expired = await query(`
      SELECT b.id FROM businesses b
      WHERE b.subscription_status = 'trial'
        AND b.trial_ends_at < now()
    `);

    for (const biz of expired) {
      await query(
        `UPDATE businesses SET subscription_status = 'expired' WHERE id = $1 AND subscription_status = 'trial'`,
        [biz.id]
      );

      const existing = await query(
        `SELECT id FROM notifications 
         WHERE business_id = $1 AND type = 'trial_expired' 
         AND created_at > now() - INTERVAL '24 hours'`,
        [biz.id]
      );

      if (existing.length === 0) {
        await query(
          `INSERT INTO notifications (business_id, type, title, message) 
           VALUES ($1, 'trial_expired', 'Trial expired', 'Your free trial has ended. Subscribe to Brandfledger Pro to unlock all features.')`,
          [biz.id]
        );
        notificationsCreated++;
      }
    }

    return NextResponse.json({ success: true, notificationsCreated, checked: businesses.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  return runTrialCheck();
}

export async function GET() {
  return runTrialCheck();
}
