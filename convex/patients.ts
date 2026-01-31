import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Registrar un nuevo paciente o actualizar uno existente
 */
export const register = mutation({
  args: {
    cedula: v.string(),
    phoneNumber: v.string(),
    name: v.optional(v.string()),
    requestedProcedure: v.string(),
    procedureId: v.optional(v.id("procedures")),
    meetsRequirements: v.boolean(),
    requirementDetails: v.optional(v.string()),
    status: v.string(),
    conversationSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Buscar si ya existe un paciente con esta cédula
    const existing = await ctx.db
      .query("patients")
      .withIndex("by_cedula", (q) => q.eq("cedula", args.cedula))
      .first();
    
    if (existing) {
      // Actualizar paciente existente
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return { id: existing._id, action: "updated" };
    }
    
    // Crear nuevo paciente
    const id = await ctx.db.insert("patients", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    
    return { id, action: "created" };
  },
});

/**
 * Buscar paciente por cédula
 */
export const getByCedula = query({
  args: { cedula: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("patients")
      .withIndex("by_cedula", (q) => q.eq("cedula", args.cedula))
      .first();
  },
});

/**
 * Buscar paciente por número de teléfono
 */
export const getByPhone = query({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("patients")
      .withIndex("by_phoneNumber", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();
  },
});

/**
 * Listar todos los pacientes (para el dashboard)
 */
export const list = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let patients;
    
    if (args.status) {
      patients = await ctx.db
        .query("patients")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(args.limit || 100);
    } else {
      patients = await ctx.db
        .query("patients")
        .withIndex("by_createdAt")
        .order("desc")
        .take(args.limit || 100);
    }
    
    return patients;
  },
});

/**
 * Actualizar estado de un paciente
 */
export const updateStatus = mutation({
  args: {
    id: v.id("patients"),
    status: v.string(),
    meetsRequirements: v.optional(v.boolean()),
    requirementDetails: v.optional(v.string()),
    conversationSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    
    return { success: true };
  },
});

/**
 * Obtener estadísticas de pacientes
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("patients").collect();
    
    const stats = {
      total: all.length,
      pending: all.filter((p) => p.status === "pending").length,
      approved: all.filter((p) => p.status === "approved").length,
      denied: all.filter((p) => p.status === "denied").length,
      infoNeeded: all.filter((p) => p.status === "info_needed").length,
      meetsRequirements: all.filter((p) => p.meetsRequirements).length,
    };
    
    return stats;
  },
});

/**
 * Eliminar un paciente
 */
export const remove = mutation({
  args: { id: v.id("patients") },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.id);
    if (!patient) {
      throw new Error("Paciente no encontrado");
    }
    
    await ctx.db.delete(args.id);
    
    return { deleted: true, cedula: patient.cedula };
  },
});
