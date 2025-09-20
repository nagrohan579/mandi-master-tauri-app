import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Daily Dues Report
export const getDailyDuesReport = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    // Get all sellers with outstanding balances
    const sellerOutstanding = await ctx.db.query("seller_outstanding").collect();

    // Get all supplier outstanding balances
    const supplierOutstanding = await ctx.db.query("supplier_outstanding").collect();

    // Get sales for the specific date
    const salesSessions = await ctx.db
      .query("sales_sessions")
      .withIndex("by_date", (q) => q.eq("session_date", args.date))
      .collect();

    const salesData = [];
    for (const session of salesSessions) {
      const entries = await ctx.db
        .query("sales_entries")
        .withIndex("by_session", (q) => q.eq("sales_session_id", session._id))
        .collect();
      salesData.push(...entries);
    }

    return {
      date: args.date,
      seller_outstanding: sellerOutstanding,
      supplier_outstanding: supplierOutstanding,
      daily_sales: salesData,
    };
  },
});

// Stock Report
export const getStockReport = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const targetDate = args.date || new Date().toISOString().split("T")[0];

    const inventory = await ctx.db
      .query("daily_inventory")
      .withIndex("by_date", (q) => q.eq("inventory_date", targetDate))
      .collect();

    // Group by item
    const stockSummary = inventory.reduce((acc: any, item: any) => {
      if (!acc[item.item_id]) {
        acc[item.item_id] = {
          item_id: item.item_id,
          types: [],
          total_stock: 0,
        };
      }

      acc[item.item_id].types.push({
        type_name: item.type_name,
        closing_stock: item.closing_stock,
        weighted_avg_rate: item.weighted_avg_purchase_rate,
      });

      acc[item.item_id].total_stock += item.closing_stock;

      return acc;
    }, {});

    return {
      date: targetDate,
      stock_summary: Object.values(stockSummary),
    };
  },
});

// Outstanding Summary Report
export const getOutstandingSummary = query({
  args: {},
  handler: async (ctx) => {
    const sellerOutstanding = await ctx.db.query("seller_outstanding").collect();
    const supplierOutstanding = await ctx.db.query("supplier_outstanding").collect();

    // Calculate totals
    const sellerTotals = sellerOutstanding.reduce(
      (acc, item: any) => ({
        total_payment_due: acc.total_payment_due + item.payment_due,
        total_quantity_due: acc.total_quantity_due + item.quantity_due,
        total_sellers: acc.total_sellers + 1,
      }),
      { total_payment_due: 0, total_quantity_due: 0, total_sellers: 0 }
    );

    const supplierTotals = supplierOutstanding.reduce(
      (acc, item: any) => ({
        total_payment_due: acc.total_payment_due + item.payment_due,
        total_quantity_due: acc.total_quantity_due + item.quantity_due,
        total_suppliers: acc.total_suppliers + 1,
      }),
      { total_payment_due: 0, total_quantity_due: 0, total_suppliers: 0 }
    );

    return {
      seller_summary: {
        ...sellerTotals,
        details: sellerOutstanding,
      },
      supplier_summary: {
        ...supplierTotals,
        details: supplierOutstanding,
      },
    };
  },
});

// Profit Analysis Report
export const getProfitAnalysis = query({
  args: {
    start_date: v.string(),
    end_date: v.string(),
    item_id: v.optional(v.id("items")),
  },
  handler: async (ctx, args) => {
    // Get sales sessions in date range
    const allSalesSessions = await ctx.db.query("sales_sessions").collect();
    const filteredSessions = allSalesSessions.filter(
      (session: any) => session.session_date >= args.start_date && session.session_date <= args.end_date
    );

    // Get procurement sessions in date range
    const allProcurementSessions = await ctx.db.query("procurement_sessions").collect();
    const filteredProcurementSessions = allProcurementSessions.filter(
      (session: any) => session.session_date >= args.start_date && session.session_date <= args.end_date
    );

    // Calculate total sales and procurement
    const totalSales = filteredSessions.reduce((sum: number, session: any) => sum + session.total_sales_amount, 0);
    const totalProcurement = filteredProcurementSessions.reduce((sum: number, session: any) => sum + session.total_amount, 0);

    // Get detailed breakdown if item_id specified
    let itemDetails = null;
    if (args.item_id) {
      // Get detailed analysis for specific item
      // This would require more complex queries to join data
      itemDetails = {
        item_id: args.item_id,
        // TODO: Implement detailed item-wise profit calculation
      };
    }

    return {
      period: {
        start_date: args.start_date,
        end_date: args.end_date,
      },
      summary: {
        total_sales: totalSales,
        total_procurement: totalProcurement,
        gross_profit: totalSales - totalProcurement,
        profit_margin: totalSales > 0 ? ((totalSales - totalProcurement) / totalSales) * 100 : 0,
      },
      item_details: itemDetails,
    };
  },
});

// Ledger Report
export const getLedgerReport = query({
  args: {
    entity_type: v.union(v.literal("seller"), v.literal("supplier")),
    entity_id: v.string(),
    start_date: v.optional(v.string()),
    end_date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ledgerEntries: any[] = [];

    if (args.entity_type === "seller") {
      // Get seller transactions
      const sales = await ctx.db
        .query("sales_entries")
        .withIndex("by_seller", (q) => q.eq("seller_id", args.entity_id as Id<"sellers">))
        .collect();

      const payments = await ctx.db
        .query("seller_payments")
        .withIndex("by_seller", (q) => q.eq("seller_id", args.entity_id as Id<"sellers">))
        .collect();

      // Combine and sort by date
      sales.forEach((sale: any) => {
        ledgerEntries.push({
          date: sale.sales_session_id, // Need to resolve to actual date
          type: "sale",
          debit: sale.total_amount_purchased,
          credit: sale.amount_paid + sale.less_discount,
          balance: sale.final_payment_outstanding,
          description: `Sale entry`,
        });
      });

      payments.forEach((payment: any) => {
        ledgerEntries.push({
          date: payment.payment_date,
          type: "payment",
          debit: 0,
          credit: payment.amount_received,
          description: `Payment received`,
        });
      });
    } else {
      // Get supplier transactions
      const procurements = await ctx.db
        .query("procurement_entries")
        .filter((q) => q.eq(q.field("supplier_id"), args.entity_id))
        .collect();

      const payments = await ctx.db
        .query("supplier_payments")
        .withIndex("by_supplier", (q) => q.eq("supplier_id", args.entity_id as Id<"suppliers">))
        .collect();

      // Similar processing for suppliers
    }

    return {
      entity_type: args.entity_type,
      entity_id: args.entity_id,
      ledger_entries: ledgerEntries.sort((a: any, b: any) => a.date.localeCompare(b.date)),
    };
  },
});

// Get seller outstanding balance for a specific seller and item
export const getSellerOutstanding = query({
  args: {
    seller_id: v.id("sellers"),
    item_id: v.id("items"),
  },
  handler: async (ctx, args) => {
    // First check if there's a current outstanding record
    const currentOutstanding = await ctx.db
      .query("seller_outstanding")
      .withIndex("by_seller_item", (q) => q.eq("seller_id", args.seller_id).eq("item_id", args.item_id))
      .first();

    if (currentOutstanding) {
      return {
        payment_due: currentOutstanding.payment_due,
        quantity_due: currentOutstanding.quantity_due,
        last_updated: currentOutstanding.last_updated,
      };
    }

    // If no current outstanding, check opening balance
    const openingBalance = await ctx.db
      .query("seller_opening_balances")
      .withIndex("by_seller_item", (q) => q.eq("seller_id", args.seller_id).eq("item_id", args.item_id))
      .first();

    if (openingBalance) {
      return {
        payment_due: openingBalance.opening_payment_due,
        quantity_due: openingBalance.opening_quantity_due,
        last_updated: openingBalance.last_modified_date || openingBalance.created_date,
      };
    }

    // If neither exists, return zero balance
    return {
      payment_due: 0,
      quantity_due: 0,
      last_updated: new Date().toISOString().split("T")[0],
    };
  },
});

// Sales Ledger Report for specific seller and item
export const getSalesLedger = query({
  args: {
    seller_id: v.id("sellers"),
    item_id: v.id("items"),
    start_date: v.string(),
    end_date: v.string(),
  },
  handler: async (ctx, args) => {
    // Get item details to determine if crates are relevant
    const item = await ctx.db.get(args.item_id);
    if (!item) {
      throw new Error("Item not found");
    }

    // Get seller details
    const seller = await ctx.db.get(args.seller_id);
    if (!seller) {
      throw new Error("Seller not found");
    }

    // Get all sales sessions in the date range
    const allSalesSessions = await ctx.db.query("sales_sessions").collect();
    const filteredSessions = allSalesSessions.filter(
      (session: any) => session.session_date >= args.start_date && session.session_date <= args.end_date
    );

    const ledgerEntries = [];

    // Process each session to find entries for this seller and item
    for (const session of filteredSessions) {
      const salesEntries = await ctx.db
        .query("sales_entries")
        .withIndex("by_session", (q) => q.eq("sales_session_id", session._id))
        .filter((q) => q.eq(q.field("seller_id"), args.seller_id))
        .filter((q) => q.eq(q.field("item_id"), args.item_id))
        .collect();

      for (const entry of salesEntries) {
        // Get line items for type breakdown
        const lineItems = await ctx.db
          .query("sales_line_items")
          .withIndex("by_sales_entry", (q) => q.eq("sales_entry_id", entry._id))
          .collect();

        ledgerEntries.push({
          _id: entry._id,
          session_date: session.session_date,
          total_amount_purchased: entry.total_amount_purchased,
          total_quantity_purchased: entry.total_quantity_purchased,
          crates_returned: entry.crates_returned,
          amount_paid: entry.amount_paid,
          less_discount: entry.less_discount,
          final_quantity_outstanding: entry.final_quantity_outstanding,
          final_payment_outstanding: entry.final_payment_outstanding,
          line_items: lineItems.map((item: any) => ({
            type_name: item.type_name,
            quantity: item.quantity,
            sale_rate: item.sale_rate,
            amount: item.amount,
          })),
        });
      }
    }

    // Sort by date
    ledgerEntries.sort((a: any, b: any) => a.session_date.localeCompare(b.session_date));

    return {
      seller_name: seller.name,
      item_name: item.name,
      item_unit: item.unit_name,
      show_crates: item.quantity_type === "crates" || item.quantity_type === "mixed",
      date_range: {
        start_date: args.start_date,
        end_date: args.end_date,
      },
      entries: ledgerEntries,
    };
  },
});

// Daily Dues Report for specific item and date
export const getDailyDuesByItem = query({
  args: {
    item_id: v.id("items"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    // Get item details to determine if crates are relevant
    const item = await ctx.db.get(args.item_id);
    if (!item) {
      throw new Error("Item not found");
    }

    // Get sales session for the specific date
    const salesSession = await ctx.db
      .query("sales_sessions")
      .withIndex("by_date", (q) => q.eq("session_date", args.date))
      .first();

    if (!salesSession) {
      return {
        item_name: item.name,
        item_unit: item.unit_name,
        show_crates: item.quantity_type === "crates" || item.quantity_type === "mixed",
        date: args.date,
        entries: [],
      };
    }

    // Get all sales entries for this session and item
    const salesEntries = await ctx.db
      .query("sales_entries")
      .withIndex("by_session", (q) => q.eq("sales_session_id", salesSession._id))
      .filter((q) => q.eq(q.field("item_id"), args.item_id))
      .collect();

    const duesEntries = [];

    // Process each sales entry
    for (const entry of salesEntries) {
      // Get seller details
      const seller = await ctx.db.get(entry.seller_id);
      if (!seller) continue;

      // Get line items for type breakdown
      const lineItems = await ctx.db
        .query("sales_line_items")
        .withIndex("by_sales_entry", (q) => q.eq("sales_entry_id", entry._id))
        .collect();

      duesEntries.push({
        _id: entry._id,
        seller_id: entry.seller_id,
        seller_name: seller.name,
        total_amount_purchased: entry.total_amount_purchased,
        total_quantity_purchased: entry.total_quantity_purchased,
        crates_returned: entry.crates_returned,
        amount_paid: entry.amount_paid,
        less_discount: entry.less_discount,
        final_quantity_outstanding: entry.final_quantity_outstanding,
        final_payment_outstanding: entry.final_payment_outstanding,
        line_items: lineItems.map((item: any) => ({
          type_name: item.type_name,
          quantity: item.quantity,
          sale_rate: item.sale_rate,
          amount: item.amount,
        })),
      });
    }

    // Sort by seller name
    duesEntries.sort((a: any, b: any) => a.seller_name.localeCompare(b.seller_name));

    return {
      item_name: item.name,
      item_unit: item.unit_name,
      show_crates: item.quantity_type === "crates" || item.quantity_type === "mixed",
      date: args.date,
      entries: duesEntries,
    };
  },
});

// End of Day Report for specific item and date
export const getEndOfDayData = query({
  args: {
    item_id: v.id("items"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    // Get item details to determine if crates are relevant
    const item = await ctx.db.get(args.item_id);
    if (!item) {
      throw new Error("Item not found");
    }

    // Get sales session for the specific date
    const salesSession = await ctx.db
      .query("sales_sessions")
      .withIndex("by_date", (q) => q.eq("session_date", args.date))
      .first();

    let sellerTotals = {
      amount_sold: 0,
      amount_received: 0,
      total_crates_sold: 0,
      total_crates_received: 0,
    };

    // Calculate seller totals if sales session exists
    if (salesSession) {
      const salesEntries = await ctx.db
        .query("sales_entries")
        .withIndex("by_session", (q) => q.eq("sales_session_id", salesSession._id))
        .filter((q) => q.eq(q.field("item_id"), args.item_id))
        .collect();

      sellerTotals = salesEntries.reduce((totals, entry) => ({
        amount_sold: totals.amount_sold + entry.total_amount_purchased,
        amount_received: totals.amount_received + entry.amount_paid,
        total_crates_sold: totals.total_crates_sold + entry.total_quantity_purchased,
        total_crates_received: totals.total_crates_received + entry.crates_returned,
      }), sellerTotals);
    }

    // Get all supplier outstanding balances for this item
    const supplierOutstanding = await ctx.db
      .query("supplier_outstanding")
      .filter((q) => q.eq(q.field("item_id"), args.item_id))
      .collect();

    const supplierDues = [];
    for (const outstanding of supplierOutstanding) {
      // Only include suppliers with actual dues
      if (outstanding.payment_due > 0 || outstanding.quantity_due > 0) {
        const supplier = await ctx.db.get(outstanding.supplier_id);
        if (supplier) {
          supplierDues.push({
            supplier_id: outstanding.supplier_id,
            supplier_name: supplier.name,
            payment_due: outstanding.payment_due,
            quantity_due: outstanding.quantity_due,
          });
        }
      }
    }

    return {
      seller_totals: sellerTotals,
      supplier_dues: supplierDues,
      item_info: {
        name: item.name,
        unit: item.unit_name,
        show_crates: item.quantity_type === "crates" || item.quantity_type === "mixed",
      },
    };
  },
});