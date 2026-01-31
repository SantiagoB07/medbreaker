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
    type: v.string(),
    greenAgentRules: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("evaluations", {
      type: args.type,
      greenAgentRules: args.greenAgentRules,
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
    }),
  },
  handler: async (ctx, args) => {
    const evaluation = await ctx.db.get(args.id);
    if (!evaluation) {
      throw new Error("Evaluation not found");
    }
    
    const updatedRounds = [...evaluation.rounds, args.round];
    await ctx.db.patch(args.id, { rounds: updatedRounds });
    return args.id;
  },
});

// Registrar cambio en DB
export const addDbChange = mutation({
  args: {
    id: v.id("evaluations"),
    change: v.object({
      action: v.string(),
      procedureId: v.optional(v.string()),
      procedureName: v.string(),
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
    finalScore: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "completed",
      finalScore: args.finalScore,
      completedAt: Date.now(),
    });
    return args.id;
  },
});

// Marcar como fallida
export const fail = mutation({
  args: {
    id: v.id("evaluations"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "failed",
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
