// Brandfledger WhatsApp Finance Manager — Conversation Context
// Manages per-user conversation state for pronoun resolution and pending actions

import { supabase } from "@/lib/db";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ConversationContext {
  business_id: string;
  whatsapp_number: string;
  recent_customers: string[];
  recent_invoices: string[];
  recent_amounts: number[];
  last_subject_type?: string;
  last_subject_name?: string;
  last_subject_entity?: string;
  last_amount?: number;
  pending_action?: string;
  pending_action_data?: any;
  chat_history?: ChatMessage[];
}

const MAX_HISTORY = 20; // Keep last 20 messages (10 exchanges)

export async function getContext(businessId: string, whatsappNumber: string): Promise<ConversationContext | null> {
  const { data } = await supabase
    .from("whatsapp_conversation_context")
    .select("*")
    .eq("business_id", businessId)
    .eq("whatsapp_number", whatsappNumber)
    .maybeSingle();
  if (!data) return null;
  return {
    business_id: data.business_id,
    whatsapp_number: data.whatsapp_number,
    recent_customers: data.recent_customers || [],
    recent_invoices: data.recent_invoices || [],
    recent_amounts: data.recent_amounts || [],
    last_subject_type: data.last_subject_type,
    last_subject_name: data.last_subject_name,
    last_subject_entity: data.last_subject_entity,
    last_amount: data.last_amount,
    pending_action: data.pending_action,
    pending_action_data: data.pending_action_data,
    chat_history: data.chat_history || [],
  };
}

export async function upsertContext(ctx: ConversationContext): Promise<void> {
  const row = {
    business_id: ctx.business_id,
    whatsapp_number: ctx.whatsapp_number,
    recent_customers: ctx.recent_customers,
    recent_invoices: ctx.recent_invoices,
    recent_amounts: ctx.recent_amounts,
    last_subject_type: ctx.last_subject_type || null,
    last_subject_name: ctx.last_subject_name || null,
    last_subject_entity: ctx.last_subject_entity || null,
    last_amount: ctx.last_amount || 0,
    pending_action: ctx.pending_action || null,
    pending_action_data: ctx.pending_action_data || null,
    chat_history: (ctx.chat_history || []).slice(-MAX_HISTORY),
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("whatsapp_conversation_context")
    .select("id")
    .eq("business_id", ctx.business_id)
    .eq("whatsapp_number", ctx.whatsapp_number)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("whatsapp_conversation_context")
      .update(row)
      .eq("id", existing.id);
  } else {
    await supabase
      .from("whatsapp_conversation_context")
      .insert(row);
  }
}

export async function clearPendingAction(businessId: string, whatsappNumber: string): Promise<void> {
  await supabase
    .from("whatsapp_conversation_context")
    .update({
      pending_action: null,
      pending_action_data: null,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("whatsapp_number", whatsappNumber);
}

export async function updateContext(
  businessId: string,
  whatsappNumber: string,
  updates: Partial<ConversationContext>
): Promise<void> {
  const row: any = { updated_at: new Date().toISOString() };
  if (updates.recent_customers !== undefined) row.recent_customers = updates.recent_customers;
  if (updates.recent_invoices !== undefined) row.recent_invoices = updates.recent_invoices;
  if (updates.recent_amounts !== undefined) row.recent_amounts = updates.recent_amounts;
  if (updates.last_subject_type !== undefined) row.last_subject_type = updates.last_subject_type;
  if (updates.last_subject_name !== undefined) row.last_subject_name = updates.last_subject_name;
  if (updates.last_subject_entity !== undefined) row.last_subject_entity = updates.last_subject_entity;
  if (updates.last_amount !== undefined) row.last_amount = updates.last_amount;
  if (updates.pending_action !== undefined) row.pending_action = updates.pending_action;
  if (updates.pending_action_data !== undefined) row.pending_action_data = updates.pending_action_data;
  if (updates.chat_history !== undefined) row.chat_history = updates.chat_history;

  await supabase
    .from("whatsapp_conversation_context")
    .update(row)
    .eq("business_id", businessId)
    .eq("whatsapp_number", whatsappNumber);
}

export async function appendChatHistory(
  businessId: string,
  whatsappNumber: string,
  messages: ChatMessage[]
): Promise<ChatMessage[]> {
  const ctx = await getContext(businessId, whatsappNumber);
  const history = ctx?.chat_history || [];
  const updated = [...history, ...messages].slice(-MAX_HISTORY);
  await updateContext(businessId, whatsappNumber, { chat_history: updated });
  return updated;
}
