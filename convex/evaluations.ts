import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============ QUERIES ============

// Obtener todas las evaluaciones
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("evaluations")
      .order("desc")
      .collect();
  },
});

// Obtener evaluación por ID
export const getById = query({
  args: { id: v.id("evaluations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Obtener evaluaciones recientes
export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    return await ctx.db
      .query("evaluations")
      .order("desc")
      .take(limit);
  },
});

// ============ MUTATIONS ============

// Crear nueva evaluación
export const create = mutation({
  args: {
    type: v.string(), // "single" | "multi"
    evaluationPrompt: v.string(),
    maxTurns: v.optional(v.number()), // Para single
    turnsPerRound: v.optional(v.number()), // Para multi
    totalRounds: v.optional(v.number()), // Para multi
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("evaluations", {
      type: args.type,
      evaluationPrompt: args.evaluationPrompt,
      maxTurns: args.maxTurns,
      turnsPerRound: args.turnsPerRound,
      totalRounds: args.totalRounds,
      rounds: [],
      dbChanges: [],
      status: "running",
      createdAt: Date.now(),
    });
    return id;
  },
});

// Agregar ronda a evaluación
export const addRound = mutation({
  args: {
    id: v.id("evaluations"),
    round: v.object({
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
    }),
  },
  handler: async (ctx, args) => {
    const evaluation = await ctx.db.get(args.id);
    if (!evaluation) {
      throw new Error("Evaluation not found");
    }
    
    const updatedRounds = [...evaluation.rounds, args.round];
    
    // Calculate scoreProgression
    const scoreProgression = updatedRounds.map((r) => r.evaluation.successScore);
    const bestScore = Math.max(...scoreProgression);
    
    await ctx.db.patch(args.id, { 
      rounds: updatedRounds,
      scoreProgression,
      bestScore,
    });
    return args.id;
  },
});

// Registrar cambio en DB (cuando Green Agent modifica la base de datos)
export const addDbChange = mutation({
  args: {
    id: v.id("evaluations"),
    change: v.object({
      action: v.string(), // "create" | "update" | "delete"
      procedureId: v.optional(v.string()),
      procedureName: v.string(),
      roundNumber: v.number(),
      timestamp: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const evaluation = await ctx.db.get(args.id);
    if (!evaluation) {
      throw new Error("Evaluation not found");
    }
    
    const updatedChanges = [...evaluation.dbChanges, args.change];
    await ctx.db.patch(args.id, { dbChanges: updatedChanges });
    return args.id;
  },
});

// Completar evaluación
export const complete = mutation({
  args: {
    id: v.id("evaluations"),
  },
  handler: async (ctx, args) => {
    const evaluation = await ctx.db.get(args.id);
    if (!evaluation) {
      throw new Error("Evaluation not found");
    }
    
    // bestScore and scoreProgression are already updated in addRound
    await ctx.db.patch(args.id, {
      status: "completed",
      completedAt: Date.now(),
    });
    return args.id;
  },
});

// Marcar como fallida
export const fail = mutation({
  args: {
    id: v.id("evaluations"),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "failed",
      completedAt: Date.now(),
    });
    return args.id;
  },
});

// Cancelar evaluación
export const cancel = mutation({
  args: {
    id: v.id("evaluations"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "cancelled",
      completedAt: Date.now(),
    });
    return args.id;
  },
});

// Eliminar evaluación
export const remove = mutation({
  args: { id: v.id("evaluations") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { deleted: true };
  },
});
