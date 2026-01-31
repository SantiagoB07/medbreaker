import { httpRouter } from "convex/server";
import { handleKapsoWebhook, healthCheck } from "./kapsoWebhook";

const http = httpRouter();

// Webhook de Kapso para WhatsApp
http.route({
  path: "/kapso-webhook",
  method: "POST",
  handler: handleKapsoWebhook,
});

// Endpoint de health check / verificación
http.route({
  path: "/kapso-webhook",
  method: "GET",
  handler: healthCheck,
});

export default http;
