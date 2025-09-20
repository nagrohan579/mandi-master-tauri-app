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

    // Update current inventory (real-time stock)
    await updateCurrentInventory(ctx, args.item_id, args.type_name, args.quantity, args.rate, "purchase");

    // Update daily inventory (historical record)
    await updateDailyInventory(ctx, session!.session_date, args.item_id, args.type_name, args.quantity, args.rate);

    // Update supplier outstanding balance
    await updateSupplierOutstanding(ctx, args.supplier_id, args.item_id, total_amount, args.quantity);

    return entryId;
  },
});

// Helper function to update current inventory (real-time stock)
async function updateCurrentInventory(ctx: any, item_id: string, type_name: string, quantity: number, rate: number, operation: "purchase" | "sale") {
  const currentDate = new Date().toISOString().split("T")[0];

  const existing = await ctx.db
    .query("current_inventory")
    .withIndex("by_item_type", (q) => q.eq("item_id", item_id).eq("type_name", type_name))
    .first();

  if (existing) {
    // Update existing current inventory
    let newStock: number;
    let newWeightedAvgRate: number;

    if (operation === "purchase") {
      newStock = existing.current_stock + quantity;

      // Calculate new weighted average rate
      const totalValue = (existing.current_stock * existing.weighted_avg_rate) + (quantity * rate);
      newWeightedAvgRate = newStock > 0 ? totalValue / newStock : rate;
    } else {
      // Sale operation
      newStock = Math.max(0, existing.current_stock - quantity);
      newWeightedAvgRate = existing.weighted_avg_rate; // Rate doesn't change on sale
    }

    await ctx.db.patch(existing._id, {
      current_stock: newStock,
      weighted_avg_rate: newWeightedAvgRate,
      last_updated: currentDate,
    });
  } else {
    // Create new current inventory record (only for purchases)
    if (operation === "purchase") {
      await ctx.db.insert("current_inventory", {
        item_id,
        type_name,
        current_stock: quantity,
        weighted_avg_rate: rate,
        last_updated: currentDate,
      });
    }
  }
}

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

// Helper function to get opening stock by searching backwards
async function getOpeningStock(ctx: any, date: string, item_id: string, type_name: string, maxDaysBack: number = 30) {
  const targetDateTime = new Date(date);

  for (let daysBack = 1; daysBack <= maxDaysBack; daysBack++) {
    const checkDate = new Date(targetDateTime);
    checkDate.setDate(checkDate.getDate() - daysBack);
    const checkDateStr = checkDate.toISOString().split('T')[0];

    const inventory = await ctx.db
      .query("daily_inventory")
      .withIndex("by_date_item", (q) => q.eq("inventory_date", checkDateStr).eq("item_id", item_id))
      .filter((q) => q.eq(q.field("type_name"), type_name))
      .first();

    if (inventory && inventory.closing_stock > 0) {
      return {
        opening_stock: inventory.closing_stock,
        opening_rate: inventory.weighted_avg_purchase_rate
      };
    }
  }

  return { opening_stock: 0, opening_rate: 0 };
}

// Helper function to update supplier outstanding balance
async function updateSupplierOutstanding(ctx: any, supplier_id: string, item_id: string, amount_due: number, quantity_due: number) {
  const currentDate = new Date().toISOString().split("T")[0];

  const existing = await ctx.db
    .query("supplier_outstanding")
    .withIndex("by_supplier_item", (q) => q.eq("supplier_id", supplier_id).eq("item_id", item_id))
    .first();

  if (existing) {
    // Update existing outstanding balance
    await ctx.db.patch(existing._id, {
      payment_due: existing.payment_due + amount_due,
      quantity_due: existing.quantity_due + quantity_due,
      last_updated: currentDate,
    });
  } else {
    // Create new outstanding balance record
    await ctx.db.insert("supplier_outstanding", {
      supplier_id,
      item_id,
      payment_due: amount_due,
      quantity_due: quantity_due,
      last_updated: currentDate,
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
    // Get opening stock from previous days
    const { opening_stock, opening_rate } = await getOpeningStock(ctx, date, item_id, type_name);

    // Calculate weighted average rate with opening stock
    const totalValue = (opening_stock * opening_rate) + (quantity * rate);
    const totalQuantity = opening_stock + quantity;
    const weightedAvgRate = totalQuantity > 0 ? totalValue / totalQuantity : rate;

    // Create new inventory record
    await ctx.db.insert("daily_inventory", {
      inventory_date: date,
      item_id,
      type_name,
      opening_stock,
      purchased_today: quantity,
      sold_today: 0,
      closing_stock: opening_stock + quantity,
      weighted_avg_purchase_rate: weightedAvgRate,
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