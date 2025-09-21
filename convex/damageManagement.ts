import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Record damage entry and process inventory/outstanding adjustments
export const recordDamageEntry = mutation({
  args: {
    damage_date: v.string(),
    supplier_id: v.id("suppliers"),
    item_id: v.id("items"),
    type_name: v.string(),
    damaged_quantity: v.number(),
    damaged_returned_quantity: v.number(),
    supplier_discount_amount: v.number(),
  },
  handler: async (ctx, args) => {
    // Validate that returned quantity doesn't exceed damaged quantity
    if (args.damaged_returned_quantity > args.damaged_quantity) {
      throw new Error(`Damaged returned quantity (${args.damaged_returned_quantity}) cannot exceed damaged quantity (${args.damaged_quantity})`);
    }

    // Create damage entry record
    const damageEntryId = await ctx.db.insert("damage_entries", args);

    // Update inventory - reduce by returned quantity only
    if (args.damaged_returned_quantity > 0) {
      await reduceInventoryForReturns(ctx, args.item_id, args.type_name, args.damaged_returned_quantity);
    }

    // Update supplier outstanding - reduce payment due by discount amount
    if (args.supplier_discount_amount > 0) {
      await reduceSupplierOutstandingForDiscount(ctx, args.supplier_id, args.item_id, args.supplier_discount_amount);
    }

    return damageEntryId;
  },
});

// Helper function to reduce inventory for returned damaged items
async function reduceInventoryForReturns(ctx: any, item_id: string, type_name: string, returned_quantity: number) {
  // Update current inventory
  const currentInventory = await ctx.db
    .query("current_inventory")
    .withIndex("by_item_type", (q) => q.eq("item_id", item_id).eq("type_name", type_name))
    .first();

  if (currentInventory) {
    const newStock = Math.max(0, currentInventory.current_stock - returned_quantity);
    await ctx.db.patch(currentInventory._id, {
      current_stock: newStock,
      last_updated: new Date().toISOString().split("T")[0],
    });
  }

  // Update daily inventory for today
  const today = new Date().toISOString().split("T")[0];
  const dailyInventory = await ctx.db
    .query("daily_inventory")
    .withIndex("by_date_item", (q) => q.eq("inventory_date", today).eq("item_id", item_id))
    .filter((q) => q.eq(q.field("type_name"), type_name))
    .first();

  if (dailyInventory) {
    const newClosingStock = Math.max(0, dailyInventory.closing_stock - returned_quantity);
    await ctx.db.patch(dailyInventory._id, {
      closing_stock: newClosingStock,
    });
  }
}

// Helper function to reduce supplier outstanding for discount
async function reduceSupplierOutstandingForDiscount(ctx: any, supplier_id: string, item_id: string, discount_amount: number) {
  const outstanding = await ctx.db
    .query("supplier_outstanding")
    .withIndex("by_supplier_item", (q) => q.eq("supplier_id", supplier_id).eq("item_id", item_id))
    .first();

  if (outstanding) {
    const newPaymentDue = Math.max(0, outstanding.payment_due - discount_amount);
    await ctx.db.patch(outstanding._id, {
      payment_due: newPaymentDue,
      last_updated: new Date().toISOString().split("T")[0],
    });
  }
}

// Get damage entries for a specific date and item (for End of Day page)
export const getDamageEntriesForDate = query({
  args: {
    damage_date: v.string(),
    item_id: v.id("items"),
  },
  handler: async (ctx, args) => {
    const damageEntries = await ctx.db
      .query("damage_entries")
      .withIndex("by_date", (q) => q.eq("damage_date", args.damage_date))
      .filter((q) => q.eq(q.field("item_id"), args.item_id))
      .collect();

    // Enrich with supplier names
    const enrichedEntries = [];
    for (const entry of damageEntries) {
      const supplier = await ctx.db.get(entry.supplier_id);
      enrichedEntries.push({
        ...entry,
        supplier_name: supplier?.name || "Unknown Supplier",
      });
    }

    return enrichedEntries;
  },
});

// Get damage entries for supplier ledger report
export const getDamageEntriesForSupplierLedger = query({
  args: {
    supplier_id: v.id("suppliers"),
    item_id: v.id("items"),
    start_date: v.string(),
    end_date: v.string(),
  },
  handler: async (ctx, args) => {
    const damageEntries = await ctx.db
      .query("damage_entries")
      .withIndex("by_supplier_item", (q) => q.eq("supplier_id", args.supplier_id).eq("item_id", args.item_id))
      .filter((q) =>
        q.and(
          q.gte(q.field("damage_date"), args.start_date),
          q.lte(q.field("damage_date"), args.end_date)
        )
      )
      .collect();

    return damageEntries;
  },
});

// Get available types for damage entry (from current inventory)
export const getAvailableTypesForDamage = query({
  args: {
    item_id: v.id("items"),
  },
  handler: async (ctx, args) => {
    const currentInventory = await ctx.db
      .query("current_inventory")
      .withIndex("by_item", (q) => q.eq("item_id", args.item_id))
      .filter((q) => q.gt(q.field("current_stock"), 0))
      .collect();

    return currentInventory.map(inv => ({
      type_name: inv.type_name,
      current_stock: inv.current_stock,
    }));
  },
});