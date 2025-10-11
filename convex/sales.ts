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
    crates_returned: v.number(),
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
    const final_quantity_outstanding = previousOutstanding.quantity + total_quantity_purchased - args.crates_returned;
    const final_payment_outstanding = previousOutstanding.payment + total_amount_purchased - args.amount_paid - args.less_discount;

    // Create sales entry
    const salesEntryId = await ctx.db.insert("sales_entries", {
      sales_session_id: args.sales_session_id,
      seller_id: args.seller_id,
      item_id: args.item_id,
      total_amount_purchased,
      total_quantity_purchased,
      crates_returned: args.crates_returned,
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

      // Update current inventory (real-time stock)
      await updateCurrentInventoryForSale(ctx, args.item_id, lineItem.type_name, lineItem.quantity);

      // Update daily inventory (historical record)
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

// Helper function to update current inventory for sales
async function updateCurrentInventoryForSale(ctx: any, item_id: string, type_name: string, quantity: number) {
  const currentDate = new Date().toISOString().split("T")[0];

  const existing = await ctx.db
    .query("current_inventory")
    .withIndex("by_item_type", (q: any) => q.eq("item_id", item_id).eq("type_name", type_name))
    .first();

  if (existing) {
    const newStock = Math.max(0, existing.current_stock - quantity);

    await ctx.db.patch(existing._id, {
      current_stock: newStock,
      last_updated: currentDate,
    });
  }
  // If no current inventory exists, this indicates a data inconsistency
  // The frontend should validate stock availability before allowing sales
}

// Helper function to get previous outstanding balance
async function getPreviousOutstanding(ctx: any, seller_id: string, item_id: string) {
  // Get opening balance
  const openingBalance = await ctx.db
    .query("seller_opening_balances")
    .withIndex("by_seller_item", (q: any) => q.eq("seller_id", seller_id).eq("item_id", item_id))
    .first();

  // Get current outstanding
  const currentOutstanding = await ctx.db
    .query("seller_outstanding")
    .withIndex("by_seller_item", (q: any) => q.eq("seller_id", seller_id).eq("item_id", item_id))
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
    .withIndex("by_seller_item", (q: any) => q.eq("seller_id", seller_id).eq("item_id", item_id))
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

// Helper function to get opening stock by searching backwards for sales
async function getOpeningStockForSales(ctx: any, date: string, item_id: string, type_name: string, maxDaysBack: number = 30) {
  const targetDateTime = new Date(date);

  for (let daysBack = 1; daysBack <= maxDaysBack; daysBack++) {
    const checkDate = new Date(targetDateTime);
    checkDate.setDate(checkDate.getDate() - daysBack);
    const checkDateStr = checkDate.toISOString().split('T')[0];

    const inventory = await ctx.db
      .query("daily_inventory")
      .withIndex("by_date_item", (q: any) => q.eq("inventory_date", checkDateStr).eq("item_id", item_id))
      .filter((q: any) => q.eq(q.field("type_name"), type_name))
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

// Helper function to update inventory for sales
async function updateInventoryForSale(ctx: any, sales_session_id: string, item_id: string, type_name: string, quantity: number) {
  // Get session to find date
  const session = await ctx.db.get(sales_session_id);
  if (!session) return;

  const existing = await ctx.db
    .query("daily_inventory")
    .withIndex("by_date_item", (q: any) => q.eq("inventory_date", session.session_date).eq("item_id", item_id))
    .filter((q: any) => q.eq(q.field("type_name"), type_name))
    .first();

  if (existing) {
    // Update existing inventory
    const newSold = existing.sold_today + quantity;
    const newClosing = existing.opening_stock + existing.purchased_today - newSold;

    await ctx.db.patch(existing._id, {
      sold_today: newSold,
      closing_stock: Math.max(0, newClosing), // Prevent negative stock
    });
  } else {
    // No inventory exists for this date - create with carry-forward stock
    const { opening_stock, opening_rate } = await getOpeningStockForSales(ctx, session.session_date, item_id, type_name);

    if (opening_stock > 0) {
      // Create inventory record with carried-forward opening stock
      await ctx.db.insert("daily_inventory", {
        inventory_date: session.session_date,
        item_id,
        type_name,
        opening_stock,
        purchased_today: 0,
        sold_today: quantity,
        closing_stock: Math.max(0, opening_stock - quantity),
        weighted_avg_purchase_rate: opening_rate,
      });
    }
    // If no opening stock found, we can't sell what we don't have
    // This should be caught by validation in the frontend
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
        .withIndex("by_session", (q: any) => q.eq("sales_session_id", args.session_id!))
        .collect();
    } else if (args.seller_id) {
      return await ctx.db
        .query("sales_entries")
        .withIndex("by_seller", (q: any) => q.eq("seller_id", args.seller_id!))
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
    const enrichedEntries: any[] = [];
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

// Get available stock for sales - date-aware inventory lookup
export const getAvailableStock = query({
  args: {
    item_id: v.id("items"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0];
    const requestedDate = args.date;

    // For today's date, use current_inventory (real-time)
    if (requestedDate === today) {
      const currentStock = await ctx.db
        .query("current_inventory")
        .withIndex("by_item", (q) => q.eq("item_id", args.item_id))
        .filter((q) => q.gt(q.field("current_stock"), 0))
        .collect();

      return currentStock.map(stock => ({
        type_name: stock.type_name,
        closing_stock: stock.current_stock,
        weighted_avg_purchase_rate: stock.weighted_avg_rate,
        is_carried_forward: false,
        carried_from_date: args.date,
        days_carried: 0
      }));
    }

    // For past/future dates, use daily_inventory historical data
    const historicalStock = await ctx.db
      .query("daily_inventory")
      .withIndex("by_date_item", (q) => q.eq("inventory_date", requestedDate).eq("item_id", args.item_id))
      .filter((q) => q.gt(q.field("closing_stock"), 0))
      .collect();

    // Collect type names that have explicit records for this date
    const typesWithRecords = new Set(historicalStock.map(stock => stock.type_name));

    // Get all active types for this item from item_types table
    const allItemTypes = await ctx.db
      .query("item_types")
      .withIndex("by_item", (q) => q.eq("item_id", args.item_id))
      .filter((q) => q.eq(q.field("is_active"), true))
      .collect();

    // For each type that doesn't have a record on this date, try carry-forward
    const carriedForwardStock: any[] = [];
    for (const itemType of allItemTypes) {
      if (!typesWithRecords.has(itemType.type_name)) {
        // Check if this type had stock on previous days
        const carriedStock = await getCarriedForwardStockForType(
          ctx, 
          args.item_id, 
          itemType.type_name, 
          requestedDate
        );
        if (carriedStock) {
          carriedForwardStock.push(carriedStock);
        }
      }
    }

    // Combine explicit records with carried-forward stock
    const combinedStock = [
      ...historicalStock.map(stock => ({
        type_name: stock.type_name,
        closing_stock: stock.closing_stock,
        weighted_avg_purchase_rate: stock.weighted_avg_purchase_rate,
        is_carried_forward: false,
        carried_from_date: args.date,
        days_carried: 0
      })),
      ...carriedForwardStock
    ];

    if (combinedStock.length > 0) {
      return combinedStock;
    }

    // If no exact date match, try carry-forward logic for past dates only
    if (requestedDate < today) {
      return await getCarriedForwardStock(ctx, args.item_id, requestedDate);
    }

    // Future dates or no stock available
    return [];
  },
});

// Helper function for carry-forward stock lookup
async function getCarriedForwardStock(ctx: any, item_id: string, date: string, maxDaysBack: number = 30) {
  const targetDateTime = new Date(date);

  for (let daysBack = 1; daysBack <= maxDaysBack; daysBack++) {
    const checkDate = new Date(targetDateTime);
    checkDate.setDate(checkDate.getDate() - daysBack);
    const checkDateStr = checkDate.toISOString().split('T')[0];

    const inventory = await ctx.db
      .query("daily_inventory")
      .withIndex("by_date_item", (q: any) => q.eq("inventory_date", checkDateStr).eq("item_id", item_id))
      .filter((q: any) => q.gt(q.field("closing_stock"), 0))
      .collect();

    if (inventory.length > 0) {
      return inventory.map((stock: any) => ({
        type_name: stock.type_name,
        closing_stock: stock.closing_stock,
        weighted_avg_purchase_rate: stock.weighted_avg_purchase_rate,
        is_carried_forward: true,
        carried_from_date: checkDateStr,
        days_carried: daysBack
      }));
    }
  }

  return [];
}

// Helper function to get carried-forward stock for a specific type
async function getCarriedForwardStockForType(ctx: any, item_id: string, type_name: string, date: string, maxDaysBack: number = 30) {
  const targetDateTime = new Date(date);

  for (let daysBack = 1; daysBack <= maxDaysBack; daysBack++) {
    const checkDate = new Date(targetDateTime);
    checkDate.setDate(checkDate.getDate() - daysBack);
    const checkDateStr = checkDate.toISOString().split('T')[0];

    const inventory = await ctx.db
      .query("daily_inventory")
      .withIndex("by_date_item", (q: any) => q.eq("inventory_date", checkDateStr).eq("item_id", item_id))
      .filter((q: any) => q.eq(q.field("type_name"), type_name))
      .first();

    if (inventory && inventory.closing_stock > 0) {
      return {
        type_name: inventory.type_name,
        closing_stock: inventory.closing_stock,
        weighted_avg_purchase_rate: inventory.weighted_avg_purchase_rate,
        is_carried_forward: true,
        carried_from_date: checkDateStr,
        days_carried: daysBack
      };
    }
  }

  return null;
}

// Helper function to reverse current inventory for sales (used during updates)
async function updateCurrentInventoryForSaleReversal(ctx: any, item_id: string, type_name: string, quantity: number) {
  const currentDate = new Date().toISOString().split("T")[0];

  const existing = await ctx.db
    .query("current_inventory")
    .withIndex("by_item_type", (q: any) => q.eq("item_id", item_id).eq("type_name", type_name))
    .first();

  if (existing) {
    // Add back the quantity that was previously sold
    const newStock = existing.current_stock + quantity;

    await ctx.db.patch(existing._id, {
      current_stock: newStock,
      last_updated: currentDate,
    });
  }
}

// Helper function to reverse daily inventory for sales (used during updates)
async function updateDailyInventoryForSaleReversal(ctx: any, date: string, item_id: string, type_name: string, quantity: number) {
  const existing = await ctx.db
    .query("daily_inventory")
    .withIndex("by_date_item", (q: any) => q.eq("inventory_date", date).eq("item_id", item_id))
    .filter((q: any) => q.eq(q.field("type_name"), type_name))
    .first();

  if (existing) {
    // Reduce sold_today and increase closing_stock
    const newSold = Math.max(0, existing.sold_today - quantity);
    const newClosing = existing.opening_stock + existing.purchased_today - newSold;

    await ctx.db.patch(existing._id, {
      sold_today: newSold,
      closing_stock: Math.max(0, newClosing),
    });
  }
}

// Export unused functions to avoid lint errors (may be used in future for entry updates/deletions)
export const _unusedHelpers = {
  updateCurrentInventoryForSaleReversal,
  updateDailyInventoryForSaleReversal,
};