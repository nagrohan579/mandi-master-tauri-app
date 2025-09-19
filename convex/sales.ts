import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Sales Sessions
export const createSalesSession = mutation({
  args: {
    session_date: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if session already exists for this date
    const existing = await ctx.db
      .query("sales_sessions")
      .withIndex("by_date", (q) => q.eq("session_date", args.session_date))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("sales_sessions", {
      session_date: args.session_date,
      total_sellers: 0,
      total_sales_amount: 0,
      status: "active",
    });
  },
});

export const addSalesEntry = mutation({
  args: {
    sales_session_id: v.id("sales_sessions"),
    seller_id: v.id("sellers"),
    item_id: v.id("items"),
    line_items: v.array(v.object({
      type_name: v.string(),
      quantity: v.number(),
      sale_rate: v.number(),
    })),
    quantity_returned: v.number(),
    amount_paid: v.number(),
    less_discount: v.number(),
  },
  handler: async (ctx, args) => {
    // Calculate totals from line items
    const total_amount_purchased = args.line_items.reduce((sum, item) => sum + (item.quantity * item.sale_rate), 0);
    const total_quantity_purchased = args.line_items.reduce((sum, item) => sum + item.quantity, 0);

    // Get previous outstanding balance
    const previousOutstanding = await getPreviousOutstanding(ctx, args.seller_id, args.item_id);

    // Calculate new outstanding balances
    const final_quantity_outstanding = previousOutstanding.quantity + total_quantity_purchased - args.quantity_returned;
    const final_payment_outstanding = previousOutstanding.payment + total_amount_purchased - args.amount_paid - args.less_discount;

    // Create sales entry
    const salesEntryId = await ctx.db.insert("sales_entries", {
      sales_session_id: args.sales_session_id,
      seller_id: args.seller_id,
      item_id: args.item_id,
      total_amount_purchased,
      total_quantity_purchased,
      quantity_returned: args.quantity_returned,
      amount_paid: args.amount_paid,
      less_discount: args.less_discount,
      final_quantity_outstanding,
      final_payment_outstanding,
    });

    // Create line items
    for (const lineItem of args.line_items) {
      await ctx.db.insert("sales_line_items", {
        sales_entry_id: salesEntryId,
        type_name: lineItem.type_name,
        quantity: lineItem.quantity,
        sale_rate: lineItem.sale_rate,
        amount: lineItem.quantity * lineItem.sale_rate,
      });

      // Update daily inventory (reduce sold_today)
      await updateInventoryForSale(ctx, args.sales_session_id, args.item_id, lineItem.type_name, lineItem.quantity);
    }

    // Update seller outstanding balance
    await updateSellerOutstanding(ctx, args.seller_id, args.item_id, final_payment_outstanding, final_quantity_outstanding);

    // Update session totals
    const session = await ctx.db.get(args.sales_session_id);
    if (session) {
      await ctx.db.patch(args.sales_session_id, {
        total_sales_amount: session.total_sales_amount + total_amount_purchased,
      });
    }

    return salesEntryId;
  },
});

// Helper function to get previous outstanding balance
async function getPreviousOutstanding(ctx: any, seller_id: string, item_id: string) {
  // Get opening balance
  const openingBalance = await ctx.db
    .query("seller_opening_balances")
    .withIndex("by_seller_item", (q) => q.eq("seller_id", seller_id).eq("item_id", item_id))
    .first();

  // Get current outstanding
  const currentOutstanding = await ctx.db
    .query("seller_outstanding")
    .withIndex("by_seller_item", (q) => q.eq("seller_id", seller_id).eq("item_id", item_id))
    .first();

  if (currentOutstanding) {
    return {
      payment: currentOutstanding.payment_due,
      quantity: currentOutstanding.quantity_due,
    };
  } else if (openingBalance) {
    return {
      payment: openingBalance.opening_payment_due,
      quantity: openingBalance.opening_quantity_due,
    };
  } else {
    return { payment: 0, quantity: 0 };
  }
}

// Helper function to update seller outstanding
async function updateSellerOutstanding(ctx: any, seller_id: string, item_id: string, payment_due: number, quantity_due: number) {
  const currentDate = new Date().toISOString().split("T")[0];

  const existing = await ctx.db
    .query("seller_outstanding")
    .withIndex("by_seller_item", (q) => q.eq("seller_id", seller_id).eq("item_id", item_id))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      payment_due,
      quantity_due,
      last_updated: currentDate,
    });
  } else {
    await ctx.db.insert("seller_outstanding", {
      seller_id,
      item_id,
      payment_due,
      quantity_due,
      last_updated: currentDate,
    });
  }
}

// Helper function to update inventory for sales
async function updateInventoryForSale(ctx: any, sales_session_id: string, item_id: string, type_name: string, quantity: number) {
  // Get session to find date
  const session = await ctx.db.get(sales_session_id);
  if (!session) return;

  const existing = await ctx.db
    .query("daily_inventory")
    .withIndex("by_date_item", (q) => q.eq("inventory_date", session.session_date).eq("item_id", item_id))
    .filter((q) => q.eq(q.field("type_name"), type_name))
    .first();

  if (existing) {
    const newSold = existing.sold_today + quantity;
    const newClosing = existing.opening_stock + existing.purchased_today - newSold;

    await ctx.db.patch(existing._id, {
      sold_today: newSold,
      closing_stock: Math.max(0, newClosing), // Prevent negative stock
    });
  }
}

export const getSalesEntries = query({
  args: {
    session_id: v.optional(v.id("sales_sessions")),
    seller_id: v.optional(v.id("sellers")),
  },
  handler: async (ctx, args) => {
    if (args.session_id) {
      return await ctx.db
        .query("sales_entries")
        .withIndex("by_session", (q) => q.eq("sales_session_id", args.session_id))
        .collect();
    } else if (args.seller_id) {
      return await ctx.db
        .query("sales_entries")
        .withIndex("by_seller", (q) => q.eq("seller_id", args.seller_id))
        .order("desc")
        .take(10);
    } else {
      return await ctx.db
        .query("sales_entries")
        .order("desc")
        .take(10);
    }
  },
});

export const getSalesLineItems = query({
  args: { sales_entry_id: v.id("sales_entries") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sales_line_items")
      .withIndex("by_sales_entry", (q) => q.eq("sales_entry_id", args.sales_entry_id))
      .collect();
  },
});

// Get all sales entries for a specific date with enriched data
export const getTodaysSales = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    // Get the session for this date
    const session = await ctx.db
      .query("sales_sessions")
      .withIndex("by_date", (q) => q.eq("session_date", args.date))
      .first();

    if (!session) {
      return [];
    }

    // Get all sales entries for this session
    const entries = await ctx.db
      .query("sales_entries")
      .withIndex("by_session", (q) => q.eq("sales_session_id", session._id))
      .collect();

    // Enrich with seller and item names
    const enrichedEntries = [];
    for (const entry of entries) {
      const seller = await ctx.db.get(entry.seller_id);
      const item = await ctx.db.get(entry.item_id);

      enrichedEntries.push({
        ...entry,
        seller_name: seller?.name || "Unknown Seller",
        item_name: item?.name || "Unknown Item",
      });
    }

    return enrichedEntries;
  },
});

// Get available stock for sales on a specific date and item
export const getAvailableStock = query({
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