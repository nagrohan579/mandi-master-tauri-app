import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Master Data Tables
  items: defineTable({
    name: v.string(),
    quantity_type: v.union(v.literal("crates"), v.literal("weight"), v.literal("mixed")),
    unit_name: v.string(),
    is_active: v.boolean(),
  }).index("by_name", ["name"]),

  suppliers: defineTable({
    name: v.string(),
    contact_info: v.optional(v.string()),
    is_active: v.boolean(),
  }).index("by_name", ["name"]),

  sellers: defineTable({
    name: v.string(),
    contact_info: v.optional(v.string()),
    is_active: v.boolean(),
  }).index("by_name", ["name"]),

  // Opening Balance Tables
  seller_opening_balances: defineTable({
    seller_id: v.id("sellers"),
    item_id: v.id("items"),
    opening_payment_due: v.number(),
    opening_quantity_due: v.number(),
    effective_from_date: v.string(),
    created_date: v.string(),
    last_modified_date: v.string(),
  })
    .index("by_seller_item", ["seller_id", "item_id"])
    .index("by_seller", ["seller_id"]),

  supplier_opening_balances: defineTable({
    supplier_id: v.id("suppliers"),
    item_id: v.id("items"),
    opening_payment_due: v.number(),
    opening_quantity_due: v.number(),
    effective_from_date: v.string(),
    created_date: v.string(),
    last_modified_date: v.string(),
  })
    .index("by_supplier_item", ["supplier_id", "item_id"])
    .index("by_supplier", ["supplier_id"]),

  // Inventory Management Tables
  item_types: defineTable({
    item_id: v.id("items"),
    type_name: v.string(),
    first_introduced_date: v.string(),
    last_seen_date: v.string(),
    is_active: v.boolean(),
  })
    .index("by_item", ["item_id"])
    .index("by_item_type", ["item_id", "type_name"]),

  // Current real-time inventory (single source of truth)
  current_inventory: defineTable({
    item_id: v.id("items"),
    type_name: v.string(),
    current_stock: v.number(),
    weighted_avg_rate: v.number(),
    last_updated: v.string(),
  })
    .index("by_item", ["item_id"])
    .index("by_item_type", ["item_id", "type_name"]),

  // Historical daily inventory snapshots
  daily_inventory: defineTable({
    inventory_date: v.string(),
    item_id: v.id("items"),
    type_name: v.string(),
    opening_stock: v.number(),
    purchased_today: v.number(),
    sold_today: v.number(),
    closing_stock: v.number(),
    weighted_avg_purchase_rate: v.number(),
  })
    .index("by_date", ["inventory_date"])
    .index("by_date_item", ["inventory_date", "item_id"])
    .index("by_item_type", ["item_id", "type_name"]),

  // Procurement Tables
  procurement_sessions: defineTable({
    session_date: v.string(),
    total_suppliers: v.number(),
    total_amount: v.number(),
    status: v.union(v.literal("active"), v.literal("completed")),
  }).index("by_date", ["session_date"]),

  procurement_entries: defineTable({
    procurement_session_id: v.id("procurement_sessions"),
    supplier_id: v.id("suppliers"),
    item_id: v.id("items"),
    type_name: v.string(),
    quantity: v.number(),
    rate: v.number(),
    total_amount: v.number(),
  })
    .index("by_session", ["procurement_session_id"])
    .index("by_date_supplier", ["procurement_session_id", "supplier_id"])
    .index("by_date_item", ["procurement_session_id", "item_id"]),

  // Sales Tables
  sales_sessions: defineTable({
    session_date: v.string(),
    total_sellers: v.number(),
    total_sales_amount: v.number(),
    status: v.union(v.literal("active"), v.literal("completed")),
  }).index("by_date", ["session_date"]),

  sales_entries: defineTable({
    sales_session_id: v.id("sales_sessions"),
    seller_id: v.id("sellers"),
    item_id: v.id("items"),
    total_amount_purchased: v.number(),
    total_quantity_purchased: v.number(),
    crates_returned: v.number(),
    amount_paid: v.number(),
    less_discount: v.number(),
    final_quantity_outstanding: v.number(),
    final_payment_outstanding: v.number(),
  })
    .index("by_session", ["sales_session_id"])
    .index("by_seller", ["seller_id"])
    .index("by_seller_item", ["seller_id", "item_id"]),

  sales_line_items: defineTable({
    sales_entry_id: v.id("sales_entries"),
    type_name: v.string(),
    quantity: v.number(),
    sale_rate: v.number(),
    amount: v.number(),
  }).index("by_sales_entry", ["sales_entry_id"]),

  // Payment Tables
  supplier_payments: defineTable({
    payment_date: v.string(),
    supplier_id: v.id("suppliers"),
    item_id: v.id("items"),
    amount_paid: v.number(),
    crates_returned: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_date", ["payment_date"])
    .index("by_supplier", ["supplier_id"])
    .index("by_supplier_item", ["supplier_id", "item_id"]),

  seller_payments: defineTable({
    payment_date: v.string(),
    seller_id: v.id("sellers"),
    item_id: v.id("items"),
    amount_received: v.number(),
    crates_returned: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_date", ["payment_date"])
    .index("by_seller", ["seller_id"])
    .index("by_seller_item", ["seller_id", "item_id"]),

  // Current Outstanding Balance Tables
  seller_outstanding: defineTable({
    seller_id: v.id("sellers"),
    item_id: v.id("items"),
    payment_due: v.number(),
    quantity_due: v.number(),
    last_updated: v.string(),
  })
    .index("by_seller", ["seller_id"])
    .index("by_seller_item", ["seller_id", "item_id"]),

  supplier_outstanding: defineTable({
    supplier_id: v.id("suppliers"),
    item_id: v.id("items"),
    payment_due: v.number(),
    quantity_due: v.number(),
    last_updated: v.string(),
  })
    .index("by_supplier", ["supplier_id"])
    .index("by_supplier_item", ["supplier_id", "item_id"]),

  // Damage Management Table
  damage_entries: defineTable({
    damage_date: v.string(),
    supplier_id: v.id("suppliers"),
    item_id: v.id("items"),
    type_name: v.string(),
    damaged_quantity: v.number(),
    damaged_returned_quantity: v.number(),
    supplier_discount_amount: v.number(),
  })
    .index("by_date", ["damage_date"])
    .index("by_supplier", ["supplier_id"])
    .index("by_supplier_item", ["supplier_id", "item_id"])
    .index("by_date_supplier", ["damage_date", "supplier_id"]),
});