import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

// ============================================================================
// TIPOS
// ============================================================================

interface KapsoWebhookPayload {
  message: {
    id: string;
    from: string;
    timestamp: string;
    type: string;
    text?: {
      body: string;
    };
    kapso: {
      direction: string;
      status: string;
      content: string;
    };
  };
  conversation: {
    id: string;
    contact_name: string;
    phone_number: string;
    phone_number_id: string;
  };
  phone_number_id: string;
  is_new_conversation: boolean;
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export const healthCheck = httpAction(async () => {
  return new Response(
    JSON.stringify({ status: "Kapso webhook endpoint ready (Convex)" }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
});

// ============================================================================
// HTTP ACTION PRINCIPAL
// ============================================================================

export const handleKapsoWebhook = httpAction(async (ctx, request) => {
  try {
    // Parsear el payload
    const payload: KapsoWebhookPayload = await request.json();
    const eventType = request.headers.get("X-Webhook-Event");

    console.log("📥 Webhook recibido:", JSON.stringify(payload, null, 2));
    console.log("📥 Event type:", eventType);

    // Validar que sea un mensaje inbound
    if (eventType !== "whatsapp.message.received") {
      return new Response(
        JSON.stringify({ status: "ignored", reason: "not an inbound message event" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (payload.message?.kapso?.direction !== "inbound") {
      return new Response(
        JSON.stringify({ status: "ignored", reason: "not an inbound message" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (payload.message.type !== "text" || !payload.message.text?.body) {
      return new Response(
        JSON.stringify({ status: "ignored", reason: "not a text message" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const userMessage = payload.message.text.body;
    const from = payload.message.from;
    const phoneNumberId = payload.phone_number_id;

    console.log(`💬 Mensaje de ${from}: ${userMessage}`);

    // Llamar a la acción interna que procesa el mensaje (Node.js action)
    const result = await ctx.runAction(internal.kapsoWebhookAction.processMessage, {
      userMessage,
      from,
      phoneNumberId,
    });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Error en webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error processing webhook" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
