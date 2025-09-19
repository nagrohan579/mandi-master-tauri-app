import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Procurement Sessions
export const createProcurementSession = mutation({
  args: {
    session_date: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if session already exists for this date
    const existing = await ctx.db
      .query("procurement_sessions")
      .withIndex("by_date", (q) => q.eq("session_date", args.session_date))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("procurement_sessions", {
      session_date: args.session_date,
      total_suppliers: 0,
      total_amount: 0,
      status: "active",
    });
  },
});

export const addProcurementEntry = mutation({
  args: {
    procurement_session_id: v.id("procurement_sessions"),
    supplier_id: v.id("suppliers"),
    item_id: v.id("items"),
    type_name: v.string(),
    quantity: v.number(),
    rate: v.number(),
  },
  handler: async (ctx, args) => {
    const total_amount = args.quantity * args.rate;

    // Create procurement entry
    const entryId = await ctx.db.insert("procurement_entries", {
      ...args,
      total_amount,
    });

    // Update session totals
    const session = await ctx.db.get(args.procurement_session_id);
    if (session) {
      await ctx.db.patch(args.procurement_session_id, {
        total_amount: session.total_amount + total_amount,
      });
    }

    // Update/Create item type
    await updateItemType(ctx, args.item_id, args.type_name);

    // Update daily inventory
    await updateDailyInventory(ctx, session!.session_date, args.item_id, args.type_name, args.quantity, args.rate);

    return entryId;
  },
});

// Helper function to update item types
async function updateItemType(ctx: any, item_id: string, type_name: string) {
  const currentDate = new Date().toISOString().split("T")[0];

  const existing = await ctx.db
    .query("item_types")
    .withIndex("by_item_type", (q) => q.eq("item_id", item_id).eq("type_name", type_name))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      last_seen_date: currentDate,
      is_active: true,
    });
  } else {
    await ctx.db.insert("item_types", {
      item_id,
      type_name,
      first_introduced_date: currentDate,
      last_seen_date: currentDate,
      is_active: true,
    });
  }
}

// Helper function to update daily inventory
async function updateDailyInventory(ctx: any, date: string, item_id: string, type_name: string, quantity: number, rate: number) {
  const existing = await ctx.db
    .query("daily_inventory")
    .withIndex("by_date_item", (q) => q.eq("inventory_date", date).eq("item_id", item_id))
    .filter((q) => q.eq(q.field("type_name"), type_name))
    .first();

  if (existing) {
    // Update existing inventory
    const newPurchased = existing.purchased_today + quantity;
    const newClosing = existing.opening_stock + newPurchased - existing.sold_today;

    // Calculate weighted average rate
    const totalValue = (existing.opening_stock * existing.weighted_avg_purchase_rate) + (quantity * rate);
    const totalQuantity = existing.opening_stock + newPurchased;
    const newWeightedAvg = totalQuantity > 0 ? totalValue / totalQuantity : rate;

    await ctx.db.patch(existing._id, {
      purchased_today: newPurchased,
      closing_stock: newClosing,
      weighted_avg_purchase_rate: newWeightedAvg,
    });
  } else {
    // Create new inventory record
    await ctx.db.insert("daily_inventory", {
      inventory_date: date,
      item_id,
      type_name,
      opening_stock: 0, // TODO: Get from previous day's closing
      purchased_today: quantity,
      sold_today: 0,
      closing_stock: quantity,
      weighted_avg_purchase_rate: rate,
    });
  }
}

export const getProcurementSessions = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.date) {
      return await ctx.db
        .query("procurement_sessions")
        .withIndex("by_date", (q) => q.eq("session_date", args.date))
        .collect();
    } else {
      return await ctx.db
        .query("procurement_sessions")
        .order("desc")
        .take(10);
    }
  },
});

export const getProcurementEntries = query({
  args: { session_id: v.id("procurement_sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("procurement_entries")
      .withIndex("by_session", (q) => q.eq("procurement_session_id", args.session_id))
      .collect();
  },
});

export const getYesterdayStock = query({
  args: {
    item_id: v.id("items"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("daily_inventory")
      .withIndex("by_date_item", (q) => q.eq("inventory_date", args.date).eq("item_id", args.item_id))
      .filter((q) => q.gt(q.field("closing_stock"), 0))
      .collect();
  },
});

export const getTodaysProcurement = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    // Get the session for this date
    const session = await ctx.db
      .query("procurement_sessions")
      .withIndex("by_date", (q) => q.eq("session_date", args.date))
      .first();

    if (!session) {
      return [];
    }

    // Get all procurement entries for this session
    const entries = await ctx.db
      .query("procurement_entries")
      .withIndex("by_session", (q) => q.eq("procurement_session_id", session._id))
      .collect();

    // Enrich with supplier and item names
    const enrichedEntries = [];
    for (const entry of entries) {
      const supplier = await ctx.db.get(entry.supplier_id);
      const item = await ctx.db.get(entry.item_id);

      enrichedEntries.push({
        ...entry,
        supplier_name: supplier?.name || "Unknown Supplier",
        item_name: item?.name || "Unknown Item",
      });
    }

    return enrichedEntries;
  },
});