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
});
