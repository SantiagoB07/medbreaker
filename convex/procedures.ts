import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============ QUERIES ============

// Obtener todos los procedimientos
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("procedures").collect();
  },
});

// Buscar procedimientos por nombre o categoría
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const allProcedures = await ctx.db.query("procedures").collect();
    const searchTerms = args.query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    
    // Si no hay términos, retornar vacío
    if (searchTerms.length === 0) {
      return [];
    }
    
    return allProcedures.filter((p) => {
      const searchableText = `${p.name} ${p.nameEs} ${p.category}`.toLowerCase();
      // Buscar si CUALQUIERA de los términos coincide
      return searchTerms.some(term => searchableText.includes(term));
    });
  },
});

// Obtener procedimiento por ID
export const getById = query({
  args: { id: v.id("procedures") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Obtener procedimientos por categoría
export const getByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("procedures")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
  },
});

// Obtener estadísticas
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allProcedures = await ctx.db.query("procedures").collect();
    
    const byCategory: Record<string, number> = {};
    let requiresPreAuth = 0;
    let createdByAgent = 0;
    
    for (const p of allProcedures) {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
      if (p.requiresPreAuth) requiresPreAuth++;
      if (p.createdBy === "agent") createdByAgent++;
    }
    
    return {
      total: allProcedures.length,
      byCategory,
      requiresPreAuth,
      createdByAgent,
    };
  },
});

// ============ MUTATIONS ============

// Crear nuevo procedimiento
export const create = mutation({
  args: {
    name: v.string(),
    nameEs: v.string(),
    category: v.string(),
    requiresPreAuth: v.boolean(),
    costThreshold: v.optional(v.number()),
    sessionLimit: v.optional(v.number()),
    conditions: v.array(v.string()),
    isExcluded: v.boolean(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("procedures", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

// Actualizar procedimiento
export const update = mutation({
  args: {
    id: v.id("procedures"),
    name: v.optional(v.string()),
    nameEs: v.optional(v.string()),
    category: v.optional(v.string()),
    requiresPreAuth: v.optional(v.boolean()),
    costThreshold: v.optional(v.number()),
    sessionLimit: v.optional(v.number()),
    conditions: v.optional(v.array(v.string())),
    isExcluded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    // Filtrar campos undefined
    const validUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        validUpdates[key] = value;
      }
    }
    
    validUpdates.updatedAt = Date.now();
    
    await ctx.db.patch(id, validUpdates);
    return id;
  },
});

// Eliminar procedimiento
export const remove = mutation({
  args: { id: v.id("procedures") },
  handler: async (ctx, args) => {
    const procedure = await ctx.db.get(args.id);
    if (!procedure) {
      throw new Error("Procedure not found");
    }
    await ctx.db.delete(args.id);
    return { deleted: true, name: procedure.name };
  },
});

// Eliminar todos los procedimientos (para reset)
export const deleteAll = mutation({
  args: {},
  handler: async (ctx) => {
    const allProcedures = await ctx.db.query("procedures").collect();
    for (const p of allProcedures) {
      await ctx.db.delete(p._id);
    }
    return { deleted: allProcedures.length };
  },
});

// Seed con datos por defecto
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    // Primero limpiar todos los procedimientos existentes
    const existing = await ctx.db.query("procedures").collect();
    for (const p of existing) {
      await ctx.db.delete(p._id);
    }
    
    const now = Date.now();
    
    const defaultProcedures = [
      // Requieren pre-autorización
      {
        name: "Elective Surgery",
        nameEs: "Cirugía Electiva",
        category: "surgery",
        requiresPreAuth: true,
        conditions: ["Non-emergency", "Medical necessity documented"],
        isExcluded: false,
      },
      {
        name: "MRI Scan",
        nameEs: "Resonancia Magnética",
        category: "imaging",
        requiresPreAuth: true,
        conditions: ["Clinical indication required"],
        isExcluded: false,
      },
      {
        name: "CT Scan",
        nameEs: "Tomografía Computarizada",
        category: "imaging",
        requiresPreAuth: true,
        conditions: ["Clinical indication required"],
        isExcluded: false,
      },
      {
        name: "Extended Physical Therapy",
        nameEs: "Terapia Física Extendida",
        category: "therapy",
        requiresPreAuth: true,
        sessionLimit: 30,
        conditions: ["More than 10 sessions requires pre-auth"],
        isExcluded: false,
      },
      {
        name: "Experimental Treatment",
        nameEs: "Tratamiento Experimental",
        category: "experimental",
        requiresPreAuth: true,
        conditions: ["Requires special committee approval", "Clinical trial enrollment"],
        isExcluded: false,
      },
      {
        name: "High-Cost Medication",
        nameEs: "Medicamento de Alto Costo",
        category: "pharmacy",
        requiresPreAuth: true,
        costThreshold: 5000,
        conditions: ["Must fail cheaper alternatives first", "Cost exceeds $5000"],
        isExcluded: false,
      },
      {
        name: "Cosmetic Procedure",
        nameEs: "Procedimiento Cosmético",
        category: "cosmetic",
        requiresPreAuth: true,
        conditions: ["Only with documented medical necessity", "Not purely aesthetic"],
        isExcluded: false,
      },
      {
        name: "Second Medical Opinion",
        nameEs: "Segunda Opinión Médica",
        category: "consultation",
        requiresPreAuth: true,
        conditions: ["Complex diagnosis", "Specialist referral"],
        isExcluded: false,
      },
      {
        name: "Bariatric Surgery",
        nameEs: "Cirugía Bariátrica",
        category: "surgery",
        requiresPreAuth: true,
        conditions: ["BMI > 40", "Or BMI > 35 with comorbidities", "Failed diet programs"],
        isExcluded: false,
      },
      {
        name: "Mental Health Therapy",
        nameEs: "Terapia de Salud Mental",
        category: "therapy",
        requiresPreAuth: false,
        sessionLimit: 52,
        conditions: ["Maximum 52 sessions per year"],
        isExcluded: false,
      },
      
      // Auto-aprobados
      {
        name: "Emergency Consultation",
        nameEs: "Consulta de Emergencia",
        category: "emergency",
        requiresPreAuth: false,
        conditions: ["Retroactive authorization allowed"],
        isExcluded: false,
      },
      {
        name: "Simple X-Ray",
        nameEs: "Radiografía Simple",
        category: "imaging",
        requiresPreAuth: false,
        conditions: [],
        isExcluded: false,
      },
      {
        name: "Basic Laboratory Test",
        nameEs: "Análisis de Laboratorio Básico",
        category: "laboratory",
        requiresPreAuth: false,
        conditions: [],
        isExcluded: false,
      },
      {
        name: "General Medicine Consultation",
        nameEs: "Consulta de Medicina General",
        category: "consultation",
        requiresPreAuth: false,
        conditions: [],
        isExcluded: false,
      },
      {
        name: "Preventive Vaccine",
        nameEs: "Vacuna Preventiva",
        category: "preventive",
        requiresPreAuth: false,
        conditions: ["Must be on approved vaccine list"],
        isExcluded: false,
      },
      {
        name: "Generic Formulary Medication",
        nameEs: "Medicamento Genérico del Formulario",
        category: "pharmacy",
        requiresPreAuth: false,
        conditions: ["Must be on formulary"],
        isExcluded: false,
      },
      
      // Excluidos
      {
        name: "Acupuncture",
        nameEs: "Acupuntura",
        category: "alternative",
        requiresPreAuth: true,
        conditions: ["Generally excluded", "May have exceptions"],
        isExcluded: true,
      },
      {
        name: "Homeopathy",
        nameEs: "Homeopatía",
        category: "alternative",
        requiresPreAuth: true,
        conditions: ["Generally excluded"],
        isExcluded: true,
      },
    ];
    
    const insertedIds = [];
    for (const proc of defaultProcedures) {
      const id = await ctx.db.insert("procedures", {
        ...proc,
        createdBy: "system",
        createdAt: now,
        updatedAt: now,
      });
      insertedIds.push(id);
    }
    
    return { inserted: insertedIds.length };
  },
});
