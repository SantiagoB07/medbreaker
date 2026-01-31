/**
 * Webhook endpoint para recibir mensajes de WhatsApp via Kapso
 * 
 * Flujo:
 * 1. Usuario envía mensaje por WhatsApp → Kapso lo recibe
 * 2. Kapso envía el mensaje a este webhook
 * 3. Cargamos últimos 5 mensajes de Convex como contexto
 * 4. Procesamos con el Green Agent
 * 5. Guardamos mensajes en Convex
 * 6. Respondemos via API de Kapso
 */

import { NextRequest, NextResponse } from 'next/server';
import { createGreenAgent, getSimpleWhatsAppPrompt } from '@/scripts/shared/green-agent';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const KAPSO_API_KEY = process.env.KAPSO_API_KEY;
const KAPSO_API_URL = 'https://api.kapso.ai/meta/whatsapp/v24.0';
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

// Log de configuración al iniciar
console.log('🔧 Kapso Webhook Config:', {
  hasKapsoKey: !!KAPSO_API_KEY,
  hasConvexUrl: !!CONVEX_URL,
  convexUrl: CONVEX_URL,
});

// Inicializar cliente de Convex
const convex = CONVEX_URL ? new ConvexHttpClient(CONVEX_URL) : null;
console.log('🔗 Convex client initialized:', !!convex);

// Nuevo formato de Kapso v2
interface KapsoWebhookPayloadV2 {
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

// Tipo para mensajes del historial
interface HistoryMessage {
  role: 'red-agent' | 'green-agent';
  content: string;
  timestamp: Date;
  turnNumber: number;
}

/**
 * Envía un mensaje de respuesta via Kapso API
 */
async function sendWhatsAppMessage(phoneNumberId: string, to: string, message: string) {
  if (!KAPSO_API_KEY) {
    console.error('KAPSO_API_KEY no configurada');
    return null;
  }

  const response = await fetch(`${KAPSO_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'X-API-Key': KAPSO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: {
        body: message,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Error enviando mensaje:', error);
    return null;
  }

  return await response.json();
}

/**
 * Cargar últimos N mensajes de Convex
 */
async function loadRecentMessages(phoneNumber: string, limit: number = 5): Promise<HistoryMessage[]> {
  if (!convex) {
    console.warn('Convex no configurado, usando historial vacío');
    return [];
  }

  try {
    const messages = await convex.query(api.messages.getRecentMessages, {
      phoneNumber,
      limit,
    });

    // Convertir formato de Convex a formato esperado por el agente
    return messages.map((msg) => ({
      role: msg.role === 'user' ? 'red-agent' : 'green-agent',
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      turnNumber: msg.turnNumber,
    })) as HistoryMessage[];
  } catch (error) {
    console.error('Error cargando mensajes de Convex:', error);
    return [];
  }
}

/**
 * Guardar mensaje en Convex
 */
async function saveMessage(
  phoneNumber: string,
  role: 'user' | 'agent',
  content: string,
  turnNumber: number,
  toolCalls?: Array<{ tool: string; args: unknown; result: unknown }>
) {
  console.log(`💾 Intentando guardar mensaje: ${role} - turn ${turnNumber}`);
  
  if (!convex) {
    console.warn('⚠️ Convex no configurado, mensaje no guardado');
    return;
  }

  try {
    const result = await convex.mutation(api.messages.addMessage, {
      phoneNumber,
      role,
      content,
      turnNumber,
      toolCalls: toolCalls as any,
    });
    console.log(`✅ Mensaje guardado en Convex: ${result}`);
    return result;
  } catch (error) {
    console.error('❌ Error guardando mensaje en Convex:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload: KapsoWebhookPayloadV2 = await request.json();
    
    // El evento viene en el header X-Webhook-Event
    const eventType = request.headers.get('X-Webhook-Event');
    
    console.log('📥 Webhook recibido:', JSON.stringify(payload, null, 2));
    console.log('📥 Event type (from header):', eventType);

    // Solo procesar mensajes de texto entrantes
    if (eventType !== 'whatsapp.message.received') {
      return NextResponse.json({ status: 'ignored', reason: 'not an inbound message event' });
    }

    // Verificar que sea un mensaje inbound (no nuestras respuestas)
    if (payload.message?.kapso?.direction !== 'inbound') {
      return NextResponse.json({ status: 'ignored', reason: 'not an inbound message' });
    }

    if (payload.message.type !== 'text' || !payload.message.text?.body) {
      return NextResponse.json({ status: 'ignored', reason: 'not a text message' });
    }

    const userMessage = payload.message.text.body;
    const from = payload.message.from;
    const phoneNumberId = payload.phone_number_id;

    console.log(`💬 Mensaje de ${from}: ${userMessage}`);

    // Cargar últimos 5 mensajes de Convex
    const history = await loadRecentMessages(from, 5);
    console.log(`📚 Historial cargado: ${history.length} mensajes`);

    // Calcular turno actual
    const currentTurn = history.length > 0 
      ? Math.max(...history.map(m => m.turnNumber)) + 1 
      : 1;

    // Agregar contexto del teléfono al prompt
    const phoneContext = `
CONTEXTO DE LA CONVERSACIÓN ACTUAL:
- Número de teléfono del paciente: ${from}
- Este paciente está contactando via WhatsApp
- Al inicio de la conversación, busca si ya existe con getPatientInfo usando este número
- Recuerda pedir la CÉDULA si aún no la tienes

`;
    const fullPrompt = phoneContext + getSimpleWhatsAppPrompt();

    // Crear el Green Agent con el prompt que incluye contexto del teléfono
    // disableDynamicContext: true para evitar instrucciones de red team
    const greenAgent = createGreenAgent(
      fullPrompt,
      CONVEX_URL,
      undefined,
      true, // isFullPrompt = true
      true  // disableDynamicContext = true (WhatsApp mode)
    );

    // Preparar contexto de conversación
    const context = {
      messages: history,
      currentTurn,
      maxTurns: 10,
    };

    // Generar respuesta del Green Agent
    console.log('🤖 Procesando con Green Agent...');
    const response = await greenAgent.generateResponse(context, userMessage);
    
    console.log(`🟢 Respuesta: ${response.content}`);
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log(`🔧 Tools usadas: ${response.toolCalls.map(tc => tc.tool).join(', ')}`);
    }

    // Guardar mensaje del usuario en Convex
    console.log(`📝 Guardando mensaje del usuario...`);
    await saveMessage(from, 'user', userMessage, currentTurn);

    // Guardar respuesta del agente en Convex
    console.log(`📝 Guardando respuesta del agente...`);
    await saveMessage(
      from, 
      'agent', 
      response.content, 
      currentTurn,
      response.toolCalls
    );

    console.log(`✅ Ambos mensajes guardados para turno ${currentTurn}`);

    // Enviar respuesta por WhatsApp
    await sendWhatsAppMessage(phoneNumberId, from, response.content);

    return NextResponse.json({ 
      status: 'processed',
      response: response.content,
      toolCalls: response.toolCalls,
      messagesInHistory: history.length,
    });

  } catch (error: any) {
    console.error('❌ Error en webhook:', error);
    return NextResponse.json(
      { error: error.message || 'Error processing webhook' },
      { status: 500 }
    );
  }
}

// Endpoint GET para verificación de webhook (si Kapso lo requiere)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get('hub.challenge');
  
  if (challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  
  return NextResponse.json({ status: 'Kapso webhook endpoint ready' });
}
