import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Items CRUD Operations
export const createItem = mutation({
  args: {
    name: v.string(),
    quantity_type: v.union(v.literal("crates"), v.literal("weight"), v.literal("mixed")),
    unit_name: v.string(),
    is_active: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("items", args);
  },
});

export const getItems = query({
  args: { active_only: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let query = ctx.db.query("items");

    if (args.active_only) {
      query = query.filter((q) => q.eq(q.field("is_active"), true));
    }

    return await query.order("asc").collect();
  },
});

export const updateItem = mutation({
  args: {
    id: v.id("items"),
    name: v.optional(v.string()),
    quantity_type: v.optional(v.union(v.literal("crates"), v.literal("weight"), v.literal("mixed"))),
    unit_name: v.optional(v.string()),
    is_active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    return await ctx.db.patch(id, updates);
  },
});

// Suppliers CRUD Operations
export const createSupplier = mutation({
  args: {
    name: v.string(),
    contact_info: v.optional(v.string()),
    is_active: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("suppliers", args);
  },
});

export const getSuppliers = query({
  args: { active_only: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let query = ctx.db.query("suppliers");

    if (args.active_only) {
      query = query.filter((q) => q.eq(q.field("is_active"), true));
    }

    return await query.order("asc").collect();
  },
});

export const updateSupplier = mutation({
  args: {
    id: v.id("suppliers"),
    name: v.optional(v.string()),
    contact_info: v.optional(v.string()),
    is_active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    return await ctx.db.patch(id, updates);
  },
});

// Sellers CRUD Operations
export const createSeller = mutation({
  args: {
    name: v.string(),
    contact_info: v.optional(v.string()),
    is_active: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sellers", args);
  },
});

export const getSellers = query({
  args: { active_only: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let query = ctx.db.query("sellers");

    if (args.active_only) {
      query = query.filter((q) => q.eq(q.field("is_active"), true));
    }

    return await query.order("asc").collect();
  },
});

export const updateSeller = mutation({
  args: {
    id: v.id("sellers"),
    name: v.optional(v.string()),
    contact_info: v.optional(v.string()),
    is_active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    return await ctx.db.patch(id, updates);
  },
});

