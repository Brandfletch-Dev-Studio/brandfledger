// Brandfledger WhatsApp Finance Manager — LLM Agent
// Uses OpenAI's function calling API to process WhatsApp messages
// TWO-PHASE DESIGN: preview_action (phase 1) → execute_pending_action (phase 2)
// The LLM can NEVER call write functions directly — only through the confirmed pending action.

import { buildSystemPrompt } from "./system-prompt";
import {
  readFunctionDefinitions,
  previewActionDefinition,
  executePendingActionDefinition,
  executeReadFunction,
  executePendingAction,
  FunctionContext,
} from "./functions";
import { getContext, upsertContext, clearPendingAction, ConversationContext } from "./context";
import { sendWhatsAppMessage } from "./send";
import { supabase } from "@/lib/db";

const MAX_FUNCTION_CALLS = 5;
const MODEL = "gpt-4o";

async function getOpenAIKey(): Promise<string> {
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "openai_api_key")
    .maybeSingle();
  if (data?.value && typeof data.value === "object" && "encoded" in data.value) {
    return Buffer.from(data.value.encoded, "base64").toString("utf-8");
  }
  return process.env.OPENAI_API_KEY || "";
}

export async function resolveUser(whatsappNumber: string): Promise<FunctionContext | null> {
  const normalized = whatsappNumber.replace(/[\s+]/g, "");

  // Look up business_members by WhatsApp number (exact match first)
  const { data: member } = await supabase
    .from("business_members")
    .select("business_id, user_id, whatsapp_number")
    .eq("whatsapp_number", normalized)
    .maybeSingle();

  let businessId: string | null = null;

  if (member) {
    businessId = member.business_id;
  } else {
    // Fallback: search all members for a normalized match
    const { data: allMembers } = await supabase
      .from("business_members")
      .select("business_id, user_id, whatsapp_number");
    const match = allMembers?.find((m: any) => m.whatsapp_number?.replace(/[\s+]/g, "") === normalized);
    if (!match) return null;
    businessId = match.business_id;
  }

  if (!businessId) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, currency, owner_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) return null;

  return {
    business_id: business.id,
    business_name: business.name,
    currency: business.currency || "MWK",
  };
}

export async function processWhatsAppMessage(
  whatsappNumber: string,
  messageText: string
): Promise<void> {
  try {
    // 1. Resolve user
    const ctx = await resolveUser(whatsappNumber);
    if (!ctx) {
      // Send "not recognized" message using platform-level WhatsApp credentials
      console.error("Could not resolve WhatsApp user:", whatsappNumber);
      await sendWhatsAppMessage(
        whatsappNumber,
        "I don't recognize this number. Please connect your WhatsApp in Brandfledger's settings to get started."
      );
      return;
    }

    // 2. Get conversation context
    let convCtx = await getContext(ctx.business_id, whatsappNumber);
    if (!convCtx) {
      convCtx = {
        business_id: ctx.business_id,
        whatsapp_number: whatsappNumber,
        recent_customers: [],
        recent_invoices: [],
        recent_amounts: [],
      };
    }

    // 3. Determine which functions are available (two-phase design)
    const hasPendingAction = !!convCtx.pending_action;
    const availableFunctions = hasPendingAction
      ? [...readFunctionDefinitions, executePendingActionDefinition]
      : [...readFunctionDefinitions, previewActionDefinition];

    // 4. Build system prompt with context
    let systemPrompt = buildSystemPrompt(ctx.business_name, ctx.currency, "Africa/Blantyre");

    const contextLines: string[] = [];
    if (convCtx.recent_customers?.length > 0) {
      contextLines.push(`Recently mentioned customers: ${convCtx.recent_customers.join(", ")}`);
    }
    if (convCtx.recent_invoices?.length > 0) {
      contextLines.push(`Recently mentioned invoices: ${convCtx.recent_invoices.join(", ")}`);
    }
    if (convCtx.last_subject_name) {
      contextLines.push(`Last subject: ${convCtx.last_subject_name} (${convCtx.last_subject_type || "unknown"})`);
    }
    if (convCtx.last_amount) {
      contextLines.push(`Last discussed amount: ${ctx.currency === "MWK" ? "MK" : ""}${convCtx.last_amount}`);
    }

    if (hasPendingAction) {
      const pending = convCtx.pending_action_data as any;
      contextLines.push(`\n## PENDING ACTION AWAITING CONFIRMATION`);
      contextLines.push(`Action type: ${convCtx.pending_action}`);
      if (pending?.preview_text) {
        contextLines.push(`Preview shown to user:\n${pending.preview_text}`);
      }
      contextLines.push(`The user has a pending action. If they say "confirm", "yes", "ok", "proceed", or similar — call execute_pending_action. If they say "edit" or want to change something — ask what to change, then call preview_action again with updated params. If they change topic entirely — ignore the pending action and handle their new request.`);
    } else {
      contextLines.push(`\n## AVAILABLE ACTIONS`);
      contextLines.push(`For any write action (recording a transaction, creating an invoice, recording a payment), you MUST call preview_action first. Never attempt to write directly. The system will not allow it.`);
    }

    if (contextLines.length > 0) {
      systemPrompt += "\n\n## Current Conversation Context\n" + contextLines.join("\n");
    }

    // 5. Call OpenAI with function calling
    const openaiKey = await getOpenAIKey();
    if (!openaiKey) {
      console.error("OpenAI API key not configured");
      await sendWhatsAppMessage(
        whatsappNumber,
        "I'm having trouble connecting right now. Please try again later.",
        ctx.business_id
      );
      return;
    }

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: messageText },
    ];

    let functionCallCount = 0;
    let finalResponse: string | null = null;
    let pendingActionStored = false;
    let pendingActionExecuted = false;
    let executionResult: any = null;

    while (functionCallCount < MAX_FUNCTION_CALLS) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          tools: availableFunctions,
          tool_choice: "auto",
          temperature: 0.3,
          max_tokens: 1000,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("OpenAI API error:", errText);
        await sendWhatsAppMessage(
          whatsappNumber,
          "I'm having trouble processing that. Please try again.",
          ctx.business_id
        );
        return;
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      if (!message) {
        await sendWhatsAppMessage(
          whatsappNumber,
          "I didn't catch that. Could you rephrase?",
          ctx.business_id
        );
        return;
      }

      // Handle function calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        const fnName = toolCall.function.name;
        const fnArgs = JSON.parse(toolCall.function.arguments || "{}");

        // Add the assistant message with the tool call to the conversation
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [{ id: toolCall.id, type: "function", function: { name: fnName, arguments: toolCall.function.arguments } }],
        });

        if (fnName === "preview_action") {
          // Phase 1: Store the pending action
          const { action_type, action_params, preview_text } = fnArgs;

          convCtx.pending_action = action_type;
          convCtx.pending_action_data = {
            action_type,
            action_params,
            preview_text,
          };

          await upsertContext(convCtx);
          pendingActionStored = true;

          // Return the preview text as the function result — the LLM will relay it to the user
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ success: true, message: "Preview stored. Show the preview_text to the user and wait for confirmation." }),
          });

          functionCallCount++;
          continue;
        }

        if (fnName === "execute_pending_action") {
          // Phase 2: Execute the stored pending action
          if (!convCtx.pending_action || !convCtx.pending_action_data) {
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: "No pending action to execute" }),
            });
            functionCallCount++;
            continue;
          }

          const pendingData = convCtx.pending_action_data as any;
          try {
            executionResult = await executePendingAction(ctx, pendingData);
            pendingActionExecuted = true;

            // Clear the pending action
            await clearPendingAction(ctx.business_id, whatsappNumber);
            convCtx.pending_action = undefined;
            convCtx.pending_action_data = undefined;

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(executionResult),
            });
          } catch (execErr: any) {
            console.error("Pending action execution error:", execErr);
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: execErr.message || "Execution failed" }),
            });
          }

          functionCallCount++;
          continue;
        }

        // READ function — execute and continue
        const fnResult = await executeReadFunction(fnName, fnArgs, ctx);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(fnResult),
        });

        functionCallCount++;
        continue;
      }

      // Text response — this is the final message
      finalResponse = message.content;
      break;
    }

    if (!finalResponse) {
      finalResponse = "I'm having trouble with that request. Could you rephrase?";
    }

    // 6. Send the response
    await sendWhatsAppMessage(whatsappNumber, finalResponse, ctx.business_id);

    // 7. Update conversation context based on what happened
    if (pendingActionExecuted && executionResult) {
      // After a successful write, update context with the entities involved
      if (executionResult.transaction) {
        const tx = executionResult.transaction;
        convCtx.recent_amounts = [Number(tx.amount), ...(convCtx.recent_amounts || [])].slice(0, 3);
        convCtx.last_amount = Number(tx.amount);
        if (tx.client_name) {
          convCtx.recent_customers = [tx.client_name, ...(convCtx.recent_customers || [])].slice(0, 3);
          convCtx.last_subject_name = tx.client_name;
          convCtx.last_subject_type = "customer";
        }
      }
      if (executionResult.invoice_number) {
        convCtx.recent_invoices = [executionResult.invoice_number, ...(convCtx.recent_invoices || [])].slice(0, 3);
        if (executionResult.invoice?.customer_id) {
          convCtx.last_subject_type = "invoice";
          convCtx.last_subject_entity = executionResult.invoice.id;
        }
        if (executionResult.total) {
          convCtx.recent_amounts = [executionResult.total, ...(convCtx.recent_amounts || [])].slice(0, 3);
          convCtx.last_amount = executionResult.total;
        }
      }
      await upsertContext(convCtx);
    } else if (!pendingActionStored && !hasPendingAction) {
      // New conversation turn with no pending action — update context from the message
      // Extract customer names and amounts from the user's message (basic tracking)
      const amountMatch = messageText.match(/(\d[\d,]+)/);
      if (amountMatch) {
        const amt = parseInt(amountMatch[1].replace(/,/g, ""), 10);
        if (amt > 0) {
          convCtx.last_amount = amt;
          convCtx.recent_amounts = [amt, ...(convCtx.recent_amounts || [])].slice(0, 3);
        }
      }
      // Always upsert context to track conversation state
      await upsertContext(convCtx);
    }

    // If the user seems to have changed topic and there was a pending action that wasn't executed,
    // and the response doesn't reference the pending action, clear it
    if (hasPendingAction && !pendingActionExecuted && !pendingActionStored) {
      // Check if the response seems unrelated to the pending action
      const lowerResponse = finalResponse.toLowerCase();
      if (!lowerResponse.includes("confirm") && !lowerResponse.includes("edit") &&
          !lowerResponse.includes("preview") && !lowerResponse.includes("pending")) {
        // The user likely changed topic — clear the pending action
        await clearPendingAction(ctx.business_id, whatsappNumber);
      }
    }
  } catch (err) {
    console.error("WhatsApp message processing error:", err);
  }
}
