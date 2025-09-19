import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Seller Opening Balances
export const setSellerOpeningBalance = mutation({
  args: {
    seller_id: v.id("sellers"),
    item_id: v.id("items"),
    opening_payment_due: v.number(),
    opening_quantity_due: v.number(),
    effective_from_date: v.string(),
  },
  handler: async (ctx, args) => {
    const currentDate = new Date().toISOString().split("T")[0];

    // Check if opening balance already exists
    const existing = await ctx.db
      .query("seller_opening_balances")
      .withIndex("by_seller_item", (q) =>
        q.eq("seller_id", args.seller_id).eq("item_id", args.item_id)
      )
      .first();

    if (existing) {
      // Update existing opening balance
      await ctx.db.patch(existing._id, {
        opening_payment_due: args.opening_payment_due,
        opening_quantity_due: args.opening_quantity_due,
        effective_from_date: args.effective_from_date,
        last_modified_date: currentDate,
      });

      // TODO: Trigger recalculation of all subsequent entries for this seller+item
      return existing._id;
    } else {
      // Create new opening balance
      return await ctx.db.insert("seller_opening_balances", {
        ...args,
        created_date: currentDate,
        last_modified_date: currentDate,
      });
    }
  },
});

export const getSellerOpeningBalances = query({
  args: { seller_id: v.optional(v.id("sellers")) },
  handler: async (ctx, args) => {
    if (args.seller_id) {
      return await ctx.db
        .query("seller_opening_balances")
        .withIndex("by_seller", (q) => q.eq("seller_id", args.seller_id))
        .collect();
    } else {
      return await ctx.db.query("seller_opening_balances").collect();
    }
  },
});

// Supplier Opening Balances
export const setSupplierOpeningBalance = mutation({
  args: {
    supplier_id: v.id("suppliers"),
    item_id: v.id("items"),
    opening_payment_due: v.number(),
    opening_quantity_due: v.number(),
    effective_from_date: v.string(),
  },
  handler: async (ctx, args) => {
    const currentDate = new Date().toISOString().split("T")[0];

    // Check if opening balance already exists
    const existing = await ctx.db
      .query("supplier_opening_balances")
      .withIndex("by_supplier_item", (q) =>
        q.eq("supplier_id", args.supplier_id).eq("item_id", args.item_id)
      )
      .first();

    if (existing) {
      // Update existing opening balance
      await ctx.db.patch(existing._id, {
        opening_payment_due: args.opening_payment_due,
        opening_quantity_due: args.opening_quantity_due,
        effective_from_date: args.effective_from_date,
        last_modified_date: currentDate,
      });

      // TODO: Trigger recalculation of all subsequent entries for this supplier+item
      return existing._id;
    } else {
      // Create new opening balance
      return await ctx.db.insert("supplier_opening_balances", {
        ...args,
        created_date: currentDate,
        last_modified_date: currentDate,
      });
    }
  },
});

export const getSupplierOpeningBalances = query({
  args: { supplier_id: v.optional(v.id("suppliers")) },
  handler: async (ctx, args) => {
    if (args.supplier_id) {
      return await ctx.db
        .query("supplier_opening_balances")
        .withIndex("by_supplier", (q) => q.eq("supplier_id", args.supplier_id))
        .collect();
    } else {
      return await ctx.db.query("supplier_opening_balances").collect();
    }
  },
});