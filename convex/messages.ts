import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Agregar un mensaje a la conversación
 */
export const addMessage = mutation({
  args: {
    phoneNumber: v.string(),
    role: v.string(), // "user" | "agent"
    content: v.string(),
    turnNumber: v.number(),
    toolCalls: v.optional(
      v.array(
        v.object({
          tool: v.string(),
          args: v.any(),
          result: v.any(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("conversationMessages", {
      ...args,
      timestamp: Date.now(),
    });
    return id;
  },
});

/**
 * Obtener los últimos N mensajes de una conversación por número de teléfono
 * Por defecto retorna los últimos 5 mensajes
 */
export const getRecentMessages = query({
  args: {
    phoneNumber: v.string(),
    limit: v.optional(v.number()), // Default: 5
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;
    
    // Obtener mensajes ordenados por timestamp descendente
    const messages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_phone_and_time", (q) => q.eq("phoneNumber", args.phoneNumber))
      .order("desc")
      .take(limit);
    
    // Revertir para tener orden cronológico (más antiguo primero)
    return messages.reverse();
  },
});

/**
 * Obtener todos los mensajes de una conversación (para debug/admin)
 */
export const getAllMessages = query({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_phone_and_time", (q) => q.eq("phoneNumber", args.phoneNumber))
      .order("asc")
      .collect();
    
    return messages;
  },
});

/**
 * Contar mensajes de una conversación
 */
export const countMessages = query({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_phone_and_time", (q) => q.eq("phoneNumber", args.phoneNumber))
      .collect();
    
    return messages.length;
  },
});

/**
 * Limpiar conversación de un número (para testing)
 */
export const clearConversation = mutation({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_phone_and_time", (q) => q.eq("phoneNumber", args.phoneNumber))
      .collect();
    
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    
    return { deleted: messages.length };
  },
});
