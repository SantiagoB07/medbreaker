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

  // Tabla de evaluaciones (para historial)
  evaluations: defineTable({
    type: v.string(), // "single" o "multi"
    greenAgentRules: v.optional(v.string()),
    
    // Rondas de conversación
    rounds: v.array(
      v.object({
        roundNumber: v.number(),
        redStrategy: v.string(),
        conversation: v.array(
          v.object({
            role: v.string(),
            content: v.string(),
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
        evaluation: v.optional(
          v.object({
            score: v.number(),
            reasoning: v.string(),
            winner: v.string(),
          })
        ),
      })
    ),
    
    // Cambios en la DB hechos por el agente
    dbChanges: v.array(
      v.object({
        action: v.string(), // "create", "update", "delete"
        procedureId: v.optional(v.string()),
        procedureName: v.string(),
        timestamp: v.number(),
      })
    ),
    
    finalScore: v.optional(v.number()),
    status: v.string(), // "running", "completed", "failed"
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_status", ["status"]),
});
