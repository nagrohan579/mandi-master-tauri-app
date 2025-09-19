import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Supplier Payments
export const addSupplierPayment = mutation({
  args: {
    payment_date: v.string(),
    supplier_id: v.id("suppliers"),
    item_id: v.id("items"),
    amount_paid: v.number(),
    crates_returned: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Create payment record
    const paymentId = await ctx.db.insert("supplier_payments", args);

    // Update supplier outstanding balance
    await updateSupplierOutstanding(ctx, args.supplier_id, args.item_id, args.amount_paid, args.crates_returned);

    return paymentId;
  },
});

// Helper function to update supplier outstanding
async function updateSupplierOutstanding(ctx: any, supplier_id: string, item_id: string, amount_paid: number, crates_returned: number) {
  const currentDate = new Date().toISOString().split("T")[0];

  const existing = await ctx.db
    .query("supplier_outstanding")
    .withIndex("by_supplier_item", (q) => q.eq("supplier_id", supplier_id).eq("item_id", item_id))
    .first();

  if (existing) {
    const newPaymentDue = existing.payment_due - amount_paid;
    const newQuantityDue = existing.quantity_due - crates_returned;

    await ctx.db.patch(existing._id, {
      payment_due: Math.max(0, newPaymentDue),
      quantity_due: Math.max(0, newQuantityDue),
      last_updated: currentDate,
    });
  } else {
    // If no existing outstanding, check opening balance
    const openingBalance = await ctx.db
      .query("supplier_opening_balances")
      .withIndex("by_supplier_item", (q) => q.eq("supplier_id", supplier_id).eq("item_id", item_id))
      .first();

    if (openingBalance) {
      const newPaymentDue = openingBalance.opening_payment_due - amount_paid;
      const newQuantityDue = openingBalance.opening_quantity_due - crates_returned;

      await ctx.db.insert("supplier_outstanding", {
        supplier_id,
        item_id,
        payment_due: Math.max(0, newPaymentDue),
        quantity_due: Math.max(0, newQuantityDue),
        last_updated: currentDate,
      });
    }
  }
}

// Seller Payments
export const addSellerPayment = mutation({
  args: {
    payment_date: v.string(),
    seller_id: v.id("sellers"),
    item_id: v.id("items"),
    amount_received: v.number(),
    crates_returned: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Create payment record
    const paymentId = await ctx.db.insert("seller_payments", args);

    // Update seller outstanding balance
    await updateSellerOutstandingFromPayment(ctx, args.seller_id, args.item_id, args.amount_received, args.crates_returned);

    return paymentId;
  },
});

// Helper function to update seller outstanding from payment
async function updateSellerOutstandingFromPayment(ctx: any, seller_id: string, item_id: string, amount_received: number, crates_returned: number) {
  const currentDate = new Date().toISOString().split("T")[0];

  const existing = await ctx.db
    .query("seller_outstanding")
    .withIndex("by_seller_item", (q) => q.eq("seller_id", seller_id).eq("item_id", item_id))
    .first();

  if (existing) {
    const newPaymentDue = existing.payment_due - amount_received;
    const newQuantityDue = existing.quantity_due - crates_returned;

    await ctx.db.patch(existing._id, {
      payment_due: Math.max(0, newPaymentDue),
      quantity_due: Math.max(0, newQuantityDue),
      last_updated: currentDate,
    });
  } else {
    // If no existing outstanding, check opening balance
    const openingBalance = await ctx.db
      .query("seller_opening_balances")
      .withIndex("by_seller_item", (q) => q.eq("seller_id", seller_id).eq("item_id", item_id))
      .first();

    if (openingBalance) {
      const newPaymentDue = openingBalance.opening_payment_due - amount_received;
      const newQuantityDue = openingBalance.opening_quantity_due - crates_returned;

      await ctx.db.insert("seller_outstanding", {
        seller_id,
        item_id,
        payment_due: Math.max(0, newPaymentDue),
        quantity_due: Math.max(0, newQuantityDue),
        last_updated: currentDate,
      });
    }
  }
}

// Query Functions
export const getSupplierPayments = query({
  args: {
    supplier_id: v.optional(v.id("suppliers")),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("supplier_payments");

    if (args.supplier_id && args.date) {
      return await query
        .withIndex("by_supplier", (q) => q.eq("supplier_id", args.supplier_id))
        .filter((q) => q.eq(q.field("payment_date"), args.date))
        .collect();
    } else if (args.supplier_id) {
      return await query
        .withIndex("by_supplier", (q) => q.eq("supplier_id", args.supplier_id))
        .order("desc")
        .take(10);
    } else if (args.date) {
      return await query
        .withIndex("by_date", (q) => q.eq("payment_date", args.date))
        .collect();
    } else {
      return await query.order("desc").take(10);
    }
  },
});

export const getSellerPayments = query({
  args: {
    seller_id: v.optional(v.id("sellers")),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("seller_payments");

    if (args.seller_id && args.date) {
      return await query
        .withIndex("by_seller", (q) => q.eq("seller_id", args.seller_id))
        .filter((q) => q.eq(q.field("payment_date"), args.date))
        .collect();
    } else if (args.seller_id) {
      return await query
        .withIndex("by_seller", (q) => q.eq("seller_id", args.seller_id))
        .order("desc")
        .take(10);
    } else if (args.date) {
      return await query
        .withIndex("by_date", (q) => q.eq("payment_date", args.date))
        .collect();
    } else {
      return await query.order("desc").take(10);
    }
  },
});