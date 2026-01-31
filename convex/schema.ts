import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Tabla principal de procedimientos médicos autorizables
  procedures: defineTable({
    // Información básica
    name: v.string(),
    nameEs: v.string(),
    category: v.string(), // surgery, imaging, therapy, pharmacy, etc.
    
    // Reglas de autorización
    requiresPreAuth: v.boolean(),
    costThreshold: v.optional(v.number()), // Límite de costo en USD
    sessionLimit: v.optional(v.number()), // Límite de sesiones anuales
    conditions: v.array(v.string()), // Condiciones para aprobación
    
    // Estado
    isExcluded: v.boolean(), // Si está excluido de cobertura
    
    // Metadata
    createdBy: v.string(), // "system" o "agent"
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_createdBy", ["createdBy"]),

  // Tabla de evaluaciones (historial completo)
  evaluations: defineTable({
    // Configuración
    type: v.string(), // "single" | "multi"
    evaluationPrompt: v.string(),
    
    // Config para single
    maxTurns: v.optional(v.number()),
    
    // Config para multi-round
    turnsPerRound: v.optional(v.number()),
    totalRounds: v.optional(v.number()),
    
    // Rondas con estructura completa
    rounds: v.array(
      v.object({
        roundNumber: v.number(),
        systemPrompt: v.string(),
        messages: v.array(
          v.object({
            role: v.string(), // "red-agent" | "green-agent"
            content: v.string(),
            turnNumber: v.number(),
            timestamp: v.number(),
            toolCalls: v.optional(
              v.array(
                v.object({
                  tool: v.string(),
                  args: v.any(),
                  result: v.any(),
                })
              )
            ),
          })
        ),
        tacticCounts: v.object({
          emotional: v.number(),
          legal: v.number(),
          technical: v.number(),
        }),
        evaluation: v.object({
          outcome: v.string(), // "total_success" | "partial_success" | "failure"
          successScore: v.number(),
          authorizationDecision: v.string(), // "approved" | "denied" | "pending" | "unclear"
          keyVulnerabilities: v.array(v.string()),
          effectiveTactics: v.array(v.string()),
          summary: v.string(),
          detailedAnalysis: v.string(),
        }),
      })
    ),
    
    // Resultado final
    bestScore: v.optional(v.number()),
    scoreProgression: v.optional(v.array(v.number())),
    
    // Cambios en DB hechos por el Green Agent (tracking de vulnerabilidades)
    dbChanges: v.array(
      v.object({
        action: v.string(), // "create" | "update" | "delete"
        procedureId: v.optional(v.string()),
        procedureName: v.string(),
        roundNumber: v.number(),
        timestamp: v.number(),
      })
    ),
    
    // Estado
    status: v.string(), // "running" | "completed" | "failed" | "cancelled"
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  // Tabla de pacientes registrados via WhatsApp
  patients: defineTable({
    // Identificación
    cedula: v.string(), // Documento de identidad (obligatorio)
    phoneNumber: v.string(), // Número de WhatsApp
    name: v.optional(v.string()), // Nombre del paciente (si lo proporciona)
    
    // Solicitud de procedimiento
    requestedProcedure: v.string(), // Procedimiento solicitado
    procedureId: v.optional(v.id("procedures")), // Referencia al procedimiento en DB
    
    // Evaluación de requisitos
    meetsRequirements: v.boolean(), // Si cumple los requisitos
    requirementDetails: v.optional(v.string()), // Detalles de por qué sí/no cumple
    
    // Estado de la solicitud
    status: v.string(), // "pending" | "approved" | "denied" | "info_needed"
    
    // Historial de conversación (resumen)
    conversationSummary: v.optional(v.string()),
    
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_cedula", ["cedula"])
    .index("by_phoneNumber", ["phoneNumber"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  // Tabla de mensajes de conversación de WhatsApp
  conversationMessages: defineTable({
    phoneNumber: v.string(), // Número de WhatsApp
    role: v.string(), // "user" | "agent"
    content: v.string(), // Contenido del mensaje
    turnNumber: v.number(), // Número de turno en la conversación
    timestamp: v.number(), // Timestamp del mensaje
    toolCalls: v.optional(
      v.array(
        v.object({
          tool: v.string(),
          args: v.any(),
          result: v.any(),
        })
      )
    ), // Tools usadas por el agente (opcional)
  })
    .index("by_phone_and_time", ["phoneNumber", "timestamp"]),
});
