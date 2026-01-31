"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ============================================================================
// TIPOS
// ============================================================================

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const KAPSO_API_URL = "https://api.kapso.ai/meta/whatsapp/v24.0";

const SIMPLE_WHATSAPP_PROMPT = `# GREEN AGENT - Sistema de Autorización Médica

Eres un asistente que ayuda a pacientes a autorizar procedimientos médicos por WhatsApp.

## FLUJO BÁSICO
1. Saluda brevemente
2. Pregunta qué procedimiento necesita
3. Pide su cédula
4. Pide su nombre completo
5. Pregunta si tiene los documentos médicos
6. Registra al paciente con registerPatient (OBLIGATORIO)

## TOOLS DISPONIBLES

### getPatientInfo
Busca si el paciente ya existe en el sistema.
**Cuándo usarlo:** Al inicio de la conversación para ver si es un paciente recurrente
**Ejemplo:** getPatientInfo({ phoneNumber: "573012052395" }) o getPatientInfo({ cedula: "12345678" })
**Respuesta:** { found: true/false, patient: {...} }

### searchProcedures
Busca procedimientos médicos en la base de datos.
**Cuándo usarlo:** Cuando el paciente menciona un procedimiento
**Ejemplo:** searchProcedures({ query: "resonancia" })
**Respuesta:** { found: true, count: 2, procedures: [...] }

### registerPatient (OBLIGATORIO)
Registra o actualiza la solicitud del paciente en el sistema.
**Cuándo usarlo:** SIEMPRE al final de la conversación, antes de despedirte
**Parámetros obligatorios:**
- cedula: Número de cédula del paciente
- phoneNumber: Número de WhatsApp
- requestedProcedure: Nombre del procedimiento solicitado
- meetsRequirements: true si tiene documentos, false si no
- status: "approved" si dijo SÍ a documentos, "info_needed" si dijo NO

**Ejemplo con documentos:**
registerPatient({
  cedula: "12345678",
  phoneNumber: "573012052395",
  requestedProcedure: "Resonancia Magnética",
  meetsRequirements: true,
  status: "approved"
})

**Ejemplo sin documentos:**
registerPatient({
  cedula: "12345678",
  phoneNumber: "573012052395",
  requestedProcedure: "Resonancia Magnética",
  meetsRequirements: false,
  status: "info_needed"
})

## REGLAS IMPORTANTES
- ✅ Respuestas CORTAS: Máximo 30 palabras
- ✅ UNA pregunta por mensaje
- ✅ SIEMPRE usa registerPatient antes de despedirte
- ❌ NO pidas información médica adicional
- ❌ NO inventes requisitos

## VERIFICACIÓN DE PROCEDIMIENTO
- Si el paciente menciona un procedimiento, verifica si está en la lista de disponibles
- Si el procedimiento NO está en la lista, usa el tool createProcedure para crearlo
- Al crear un procedimiento, usa estos valores por defecto:
  - name: Nombre en inglés (puedes traducir)
  - nameEs: Nombre exacto que dijo el paciente
  - category: "surgery" si es cirugía, "therapy" si es terapia, "imaging" si es imagen, "pharmacy" si es medicamento, "consultation" si es consulta, "emergency" si es emergencia, o "preventive" si es preventivo
  - requiresPreAuth: true
  - isExcluded: false
  - conditions: ["Documentación requerida"]
  - createdBy: "patient"

## EJEMPLO DE CONVERSACIÓN COMPLETA

Turno 1:
Usuario: Hola
Tú: [getPatientInfo con phoneNumber]
Tú: ¡Hola! ¿Qué procedimiento necesitas autorizar?

Turno 2:
Usuario: Necesito una resonancia magnética
Tú: [searchProcedures({ query: "resonancia" })]
Tú: Perfecto. ¿Cuál es tu número de cédula?

Turno 3:
Usuario: 12345678
Tú: ¿Cuál es tu nombre completo?

Turno 4:
Usuario: Juan Pérez
Tú: ¿Tienes los documentos médicos listos?

Turno 5 (SI tiene documentos):
Usuario: Sí
Tú: [registerPatient con status="approved", name="Juan Pérez"]
Tú: ¡Listo! Tu solicitud ha sido aprobada. ✅

Turno 5 (NO tiene documentos):
Usuario: No, aún no
Tú: [registerPatient con status="info_needed", name="Juan Pérez"]
Tú: Entendido. Necesitarás los documentos para continuar.

## EJEMPLO DE PROCEDIMIENTO NO ENCONTRADO

Usuario: Necesito una liposucción
Tú: [createProcedure({ name: "Liposuction", nameEs: "liposucción", category: "surgery", requiresPreAuth: true, isExcluded: false, conditions: ["Documentación requerida"], createdBy: "patient" })]
Tú: Procedimiento "liposucción" registrado. ¿Cuál es tu número de cédula?`;

// Definición de tools para OpenAI
const TOOLS_DEFINITION = [
  {
    type: "function" as const,
    function: {
      name: "getPatientInfo",
      description: "Buscar información de un paciente existente por cédula o teléfono",
      parameters: {
        type: "object",
        properties: {
          cedula: { type: "string", description: "Cédula del paciente" },
          phoneNumber: { type: "string", description: "Número de teléfono del paciente" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "searchProcedures",
      description: "Buscar procedimientos médicos en la base de datos",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Término de búsqueda" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "registerPatient",
      description: "Registrar un nuevo paciente o actualizar uno existente. OBLIGATORIO al final de la conversación.",
      parameters: {
        type: "object",
        properties: {
          cedula: { type: "string", description: "Documento de identidad del paciente (obligatorio)" },
          phoneNumber: { type: "string", description: "Número de teléfono/WhatsApp del paciente" },
          name: { type: "string", description: "Nombre del paciente si lo proporcionó" },
          requestedProcedure: { type: "string", description: "Nombre del procedimiento solicitado" },
          meetsRequirements: { type: "boolean", description: "Si el paciente cumple los requisitos" },
          requirementDetails: { type: "string", description: "Detalles de por qué sí/no cumple" },
          status: { 
            type: "string", 
            enum: ["pending", "approved", "denied", "info_needed"],
            description: "Estado de la solicitud" 
          },
          conversationSummary: { type: "string", description: "Resumen breve de la conversación" },
        },
        required: ["cedula", "phoneNumber", "requestedProcedure", "meetsRequirements", "status"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "createProcedure",
      description: "Crear un nuevo procedimiento médico en el sistema. Úsalo cuando el paciente solicite un procedimiento que no está en la lista de disponibles.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre del procedimiento en inglés" },
          nameEs: { type: "string", description: "Nombre del procedimiento en español" },
          category: { 
            type: "string", 
            enum: ["surgery", "imaging", "therapy", "pharmacy", "consultation", "emergency", "preventive", "cosmetic", "experimental", "alternative"],
            description: "Categoría del procedimiento" 
          },
          requiresPreAuth: { type: "boolean", description: "Si requiere pre-autorización" },
          costThreshold: { type: "number", description: "Umbral de costo en USD" },
          sessionLimit: { type: "number", description: "Límite de sesiones por año" },
          conditions: { type: "array", items: { type: "string" }, description: "Lista de condiciones" },
          isExcluded: { type: "boolean", description: "Si está excluido de cobertura" },
          createdBy: { type: "string", description: "Quién creó el procedimiento" },
        },
        required: ["name", "nameEs", "category", "requiresPreAuth", "isExcluded", "createdBy"],
      },
    },
  },
];

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Envía un mensaje de respuesta via Kapso API
 */
async function sendWhatsAppMessage(
  phoneNumberId: string,
  to: string,
  message: string,
  kapsoApiKey: string
): Promise<boolean> {
  try {
    const response = await fetch(`${KAPSO_API_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "X-API-Key": kapsoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          body: message,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Error enviando mensaje a WhatsApp:", error);
      return false;
    }

    console.log("✅ Mensaje enviado a WhatsApp");
    return true;
  } catch (error) {
    console.error("Error en sendWhatsAppMessage:", error);
    return false;
  }
}

/**
 * Llama a OpenAI Chat Completions API directamente
 */
async function callOpenAI(
  messages: OpenAIMessage[],
  openaiApiKey: string
): Promise<{ content: string; toolCalls?: Array<{ id: string; name: string; arguments: string }> }> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: messages,
      tools: TOOLS_DEFINITION,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const choice = data.choices[0];
  const message = choice.message;

  return {
    content: message.content || "",
    toolCalls: message.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    })),
  };
}

// ============================================================================
// ACCIÓN INTERNA PRINCIPAL
// ============================================================================

export const processMessage = internalAction({
  args: {
    userMessage: v.string(),
    from: v.string(),
    phoneNumberId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userMessage, from, phoneNumberId } = args;

    // Obtener API keys de las variables de entorno de Convex
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const kapsoApiKey = process.env.KAPSO_API_KEY;

    if (!openaiApiKey || !kapsoApiKey) {
      console.error("❌ Faltan API keys en variables de entorno");
      return { error: "Missing API keys", status: "error" };
    }

    // Cargar procedimientos disponibles para contexto
    const procedures = await ctx.runQuery(api.procedures.getAll);
    const proceduresList = procedures
      .map(p => `- ${p.nameEs} (${p.category})${p.requiresPreAuth ? ' [requiere autorización]' : ' [autorización automática]'}`)
      .join('\n');
    console.log(`📋 Cargados ${procedures.length} procedimientos`);

    // Cargar últimos 5 mensajes de Convex
    const history = await ctx.runQuery(api.messages.getRecentMessages, {
      phoneNumber: from,
      limit: 5,
    });
    console.log(`📚 Historial cargado: ${history.length} mensajes`);

    // Calcular turno actual
    const currentTurn = history.length > 0
      ? Math.max(...history.map((m) => m.turnNumber)) + 1
      : 1;

    // Construir el system prompt con contexto del teléfono y procedimientos
    const systemPrompt = `
CONTEXTO DE LA CONVERSACIÓN ACTUAL:
- Número de teléfono del paciente: ${from}
- Este paciente está contactando via WhatsApp
- Al inicio de la conversación, busca si ya existe con getPatientInfo usando este número
- Recuerda pedir la CÉDULA si aún no la tienes
- Recuerda pedir el NOMBRE COMPLETO si aún no lo tienes

PROCEDIMIENTOS DISPONIBLES:
${proceduresList}

${SIMPLE_WHATSAPP_PROMPT}`;

    // Preparar mensajes para OpenAI
    const openaiMessages: OpenAIMessage[] = [
      { role: "system", content: systemPrompt },
    ];

    // Agregar historial
    for (const msg of history) {
      openaiMessages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }

    // Agregar mensaje actual
    openaiMessages.push({ role: "user", content: userMessage });

    // Llamar a OpenAI
    console.log("🤖 Llamando a OpenAI...");
    let response = await callOpenAI(openaiMessages, openaiApiKey);
    const toolCallsExecuted: ToolCall[] = [];

    // Ejecutar tool calls si los hay (loop hasta max 5 iteraciones)
    let iterations = 0;
    while (response.toolCalls && response.toolCalls.length > 0 && iterations < 5) {
      iterations++;
      console.log(`🔧 Ejecutando ${response.toolCalls.length} tool calls (iteración ${iterations})...`);

      // Agregar el mensaje del asistente con tool_calls
      openaiMessages.push({
        role: "assistant",
        content: response.content || "",
        tool_calls: response.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        })),
      });

      // Ejecutar cada tool call
      for (const toolCall of response.toolCalls) {
        const toolArgs = JSON.parse(toolCall.arguments);
        let result: unknown;

        console.log(`🔧 Ejecutando tool: ${toolCall.name}`, toolArgs);

        try {
          switch (toolCall.name) {
            case "getPatientInfo":
              if (toolArgs.cedula) {
                result = await ctx.runQuery(api.patients.getByCedula, { cedula: toolArgs.cedula });
              } else if (toolArgs.phoneNumber) {
                result = await ctx.runQuery(api.patients.getByPhone, { phoneNumber: toolArgs.phoneNumber });
              } else {
                result = { found: false, message: "Se requiere cédula o teléfono" };
              }
              if (!result) {
                result = { found: false, message: "Paciente no encontrado" };
              } else {
                result = { found: true, patient: result };
              }
              break;

            case "searchProcedures":
              const procedures = await ctx.runQuery(api.procedures.search, { query: toolArgs.query });
              result = {
                found: procedures.length > 0,
                count: procedures.length,
                procedures: procedures.slice(0, 5), // Limitar a 5 resultados
              };
              break;

            case "registerPatient":
              const registerResult = await ctx.runMutation(api.patients.register, {
                cedula: toolArgs.cedula,
                phoneNumber: toolArgs.phoneNumber || from,
                name: toolArgs.name,
                requestedProcedure: toolArgs.requestedProcedure,
                meetsRequirements: toolArgs.meetsRequirements,
                requirementDetails: toolArgs.requirementDetails,
                status: toolArgs.status,
                conversationSummary: toolArgs.conversationSummary,
              });
              result = {
                success: true,
                ...registerResult,
                message: registerResult.action === "created"
                  ? `Paciente registrado exitosamente`
                  : `Paciente actualizado exitosamente`,
              };
              break;

            case "createProcedure":
              const createProcResult = await ctx.runMutation(api.procedures.create, {
                name: toolArgs.name,
                nameEs: toolArgs.nameEs,
                category: toolArgs.category,
                requiresPreAuth: toolArgs.requiresPreAuth,
                costThreshold: toolArgs.costThreshold,
                sessionLimit: toolArgs.sessionLimit,
                conditions: toolArgs.conditions,
                isExcluded: toolArgs.isExcluded,
                createdBy: toolArgs.createdBy || "patient",
              });
              result = {
                success: true,
                id: String(createProcResult),
                message: `Procedimiento "${toolArgs.nameEs}" registrado exitosamente`,
              };
              break;

            default:
              result = { error: `Tool desconocida: ${toolCall.name}` };
          }
        } catch (error: any) {
          console.error(`Error ejecutando tool ${toolCall.name}:`, error);
          result = { error: error.message || "Error ejecutando tool" };
        }

        toolCallsExecuted.push({
          tool: toolCall.name,
          args: toolArgs,
          result: result,
        });

        // Agregar resultado del tool call
        openaiMessages.push({
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        });
      }

      // Llamar a OpenAI de nuevo con los resultados
      response = await callOpenAI(openaiMessages, openaiApiKey);
    }

    const finalResponse = response.content || "Lo siento, no pude procesar tu solicitud.";
    console.log(`🟢 Respuesta final: ${finalResponse}`);

    // Guardar mensaje del usuario
    await ctx.runMutation(api.messages.addMessage, {
      phoneNumber: from,
      role: "user",
      content: userMessage,
      turnNumber: currentTurn,
    });

    // Guardar respuesta del agente
    await ctx.runMutation(api.messages.addMessage, {
      phoneNumber: from,
      role: "agent",
      content: finalResponse,
      turnNumber: currentTurn,
      toolCalls: toolCallsExecuted.length > 0 ? toolCallsExecuted : undefined,
    });

    console.log(`✅ Mensajes guardados para turno ${currentTurn}`);

    // Enviar respuesta por WhatsApp
    await sendWhatsAppMessage(phoneNumberId, from, finalResponse, kapsoApiKey);

    return {
      status: "processed",
      response: finalResponse,
      toolCalls: toolCallsExecuted,
      messagesInHistory: history.length,
    };
  },
});
