// Brandfledger WhatsApp Finance Manager — LLM Agent
// Uses OpenAI's function calling API to process WhatsApp messages

import { buildSystemPrompt } from "./system-prompt";
import { functionDefinitions, executeFunction, FunctionContext } from "./functions";
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

  // Look up business_members by WhatsApp number
  let businessId: string | null = null;
  let userId: string | null = null;

  const { data: member } = await supabase
    .from("business_members")
    .select("business_id, user_id, whatsapp_number")
    .eq("whatsapp_number", normalized)
    .maybeSingle();

  if (member) {
    businessId = member.business_id;
    userId = member.user_id;
  } else {
    // Fallback: search all members
    const { data: allMembers } = await supabase
      .from("business_members")
      .select("business_id, user_id, whatsapp_number");
    const match = allMembers?.find((m: any) => m.whatsapp_number?.replace(/[\s+]/g, "") === normalized);
    if (!match) return null;
    businessId = match.business_id;
    userId = match.user_id;
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
      await sendWhatsAppMessage(
        whatsappNumber,
        "Hi! I'm the Brandfledger Finance Manager. To connect your WhatsApp, go to Settings then WhatsApp in your Brandfledger account."
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

    // 3. Build system prompt with context
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
    if (convCtx.pending_action) {
      contextLines.push(`PENDING ACTION: ${convCtx.pending_action}`);
      contextLines.push(`Pending action data: ${JSON.stringify(convCtx.pending_action_data)}`);
      contextLines.push("If the user says confirm or yes, execute the pending action by calling the appropriate function. If they say edit, ask what to change.");
    }
    if (contextLines.length > 0) {
      systemPrompt += "\n\n## Current Conversation Context\n" + contextLines.join("\n");
    }

    // 4. Call OpenAI with function calling
    const openaiKey = await getOpenAIKey();
    if (!openaiKey) {
      console.error("OpenAI API key not configured");
      await sendWhatsAppMessage(whatsappNumber, "I'm having trouble connecting right now. Please try again later.");
      return;
    }

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: messageText },
    ];

    let functionCallCount = 0;
    let finalResponse: string | null = null;

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
          functions: functionDefinitions,
          function_call: "auto",
          temperature: 0.3,
          max_tokens: 1000,
        }),
      });

      if (!res.ok) {
        console.error("OpenAI API error:", await res.text());
        await sendWhatsAppMessage(whatsappNumber, "I'm having trouble processing that. Please try again.");
        return;
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      if (!message) {
        await sendWhatsAppMessage(whatsappNumber, "I didn't catch that. Could you rephrase?");
        return;
      }

      if (message.function_call) {
        const fnName = message.function_call.name;
        const fnArgs = JSON.parse(message.function_call.arguments || "{}");
        const fnResult = await executeFunction(fnName, fnArgs, ctx);

        messages.push({
          role: "assistant",
          content: null,
          function_call: { name: fnName, arguments: message.function_call.arguments },
        });
        messages.push({
          role: "function",
          name: fnName,
          content: JSON.stringify(fnResult),
        });

        functionCallCount++;
        continue;
      }

      finalResponse = message.content;
      break;
    }

    if (!finalResponse) {
      finalResponse = "I'm having trouble with that request. Could you rephrase?";
    }

    // 5. Send the response
    await sendWhatsAppMessage(whatsappNumber, finalResponse);

    // 6. Update conversation context
    if (finalResponse.includes("confirm") && (finalResponse.includes("Reply") || finalResponse.includes("reply"))) {
      await upsertContext({
        ...convCtx,
        pending_action: "awaiting_confirmation",
        pending_action_data: { preview_message: finalResponse },
      });
    } else if (finalResponse.startsWith("✅") || finalResponse.startsWith("Recorded") || finalResponse.startsWith("Created") || finalResponse.startsWith("Done")) {
      await clearPendingAction(ctx.business_id, whatsappNumber);
    }
  } catch (err) {
    console.error("WhatsApp message processing error:", err);
    await sendWhatsAppMessage(whatsappNumber, "Something went wrong. Please try again.");
  }
}
