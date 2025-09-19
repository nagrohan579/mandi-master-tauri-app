# MandiMaster Database Structure

## Overview
MandiMaster is a comprehensive wholesale fruit/vegetable market management system that handles procurement, inventory, sales, payments, and dues tracking with real-time stock management and automatic calculations.

## Database Technology
- **Platform:** Convex (TypeScript-first reactive database)
- **Key Features:** Real-time updates, automatic schema management, type safety, offline support

## Master Data Tables

### `items`
Core item/product definitions
- `id` (Id<"items">) - Unique identifier
- `name` (string) - Item name ("banana", "papaya", "onion")
- `quantity_type` (union: "crates" | "weight" | "mixed") - How item is measured
- `unit_name` (string) - Unit display name ("crates", "kg", "quintal")
- `is_active` (boolean) - Whether item is currently traded

**Indexes:**
- `by_name` on `["name"]`

### `suppliers`
Supplier/vendor information
- `id` (Id<"suppliers">) - Unique identifier
- `name` (string) - Supplier name
- `contact_info` (optional string) - Phone/address details
- `is_active` (boolean) - Whether supplier is currently active

**Indexes:**
- `by_name` on `["name"]`

### `sellers`
Customer/buyer information (fruit shop owners, etc.)
- `id` (Id<"sellers">) - Unique identifier
- `name` (string) - Seller name
- `contact_info` (optional string) - Phone/address details
- `is_active` (boolean) - Whether seller is currently active

**Indexes:**
- `by_name` on `["name"]`

## Opening Balance Tables

### `seller_opening_balances`
**Purpose:** Pre-app historical dues that existed before data entry started (modifiable)
- `id` (Id<"seller_opening_balances">) - Unique identifier
- `seller_id` (Id<"sellers">) - Reference to seller
- `item_id` (Id<"items">) - Reference to item
- `opening_payment_due` (number) - Amount seller owed before app started
- `opening_quantity_due` (number) - Crates/kg seller owed before app started
- `effective_from_date` (string) - Date when app data entry started (YYYY-MM-DD)
- `created_date` (string) - When this opening balance was set
- `last_modified_date` (string) - When this opening balance was last changed

**Critical:** When modified, ALL subsequent entries for this seller+item must be recalculated

**Indexes:**
- `by_seller_item` on `["seller_id", "item_id"]`
- `by_seller` on `["seller_id"]`

### `supplier_opening_balances`
**Purpose:** Pre-app historical dues dad owed to suppliers before data entry started
- `id` (Id<"supplier_opening_balances">) - Unique identifier
- `supplier_id` (Id<"suppliers">) - Reference to supplier
- `item_id` (Id<"items">) - Reference to item
- `opening_payment_due` (number) - Amount dad owed before app started
- `opening_quantity_due` (number) - Crates dad owed before app started
- `effective_from_date` (string) - Date when app data entry started
- `created_date` (string) - When this opening balance was set
- `last_modified_date` (string) - When this opening balance was last changed

**Indexes:**
- `by_supplier_item` on `["supplier_id", "item_id"]`
- `by_supplier` on `["supplier_id"]`

## Inventory Management Tables

### `item_types`
**Purpose:** Track dynamic daily types (Type X, Type Y, etc.) across all days
- `id` (Id<"item_types">) - Unique identifier
- `item_id` (Id<"items">) - Which fruit/vegetable this type belongs to
- `type_name` (string) - Daily type name ("Type X", "Type Y", "Type A")
- `first_introduced_date` (string) - Date when this type first appeared
- `last_seen_date` (string) - Date when this type was last procured/sold
- `is_active` (boolean) - False when no inventory exists anywhere

**Indexes:**
- `by_item` on `["item_id"]`
- `by_item_type` on `["item_id", "type_name"]`

### `current_inventory` ⭐ **NEW - Primary Inventory Table**
**Purpose:** Real-time current stock levels (single source of truth)
- `id` (Id<"current_inventory">) - Unique identifier
- `item_id` (Id<"items">) - Reference to item
- `type_name` (string) - Type name ("Type X", "Type Y", etc.)
- `current_stock` (number) - Real-time available stock
- `weighted_avg_rate` (number) - Current weighted average purchase rate
- `last_updated` (string) - Last modification timestamp

**Key Benefits:**
- **Instant stock lookup** - No backward searching required
- **Always accurate** - Updated on every procurement/sale transaction
- **High performance** - Single query to get current stock
- **Real-time** - Reflects actual available inventory

**Indexes:**
- `by_item` on `["item_id"]`
- `by_item_type` on `["item_id", "type_name"]`

### `daily_inventory`
**Purpose:** Historical daily snapshots for reporting and audit trail
- `id` (Id<"daily_inventory">) - Unique identifier
- `inventory_date` (string) - Date (YYYY-MM-DD)
- `item_id` (Id<"items">) - Reference to item
- `type_name` (string) - Daily type name
- `opening_stock` (number) - Stock at start of day
- `purchased_today` (number) - New procurement today
- `sold_today` (number) - Total sold to all customers
- `closing_stock` (number) - Stock at end of day
- `weighted_avg_purchase_rate` (number) - Blended rate for the day

**Calculation:** `closing_stock = opening_stock + purchased_today - sold_today`

**Note:** This table is now used primarily for historical reporting and date-specific inventory lookups. Real-time stock queries use `current_inventory`.

**Indexes:**
- `by_date` on `["inventory_date"]`
- `by_date_item` on `["inventory_date", "item_id"]`
- `by_item_type` on `["item_id", "type_name"]`

## **🔄 DUAL INVENTORY SYSTEM ARCHITECTURE**

### **Real-Time vs Historical Inventory**

The system now uses a **dual inventory approach** for optimal performance and accuracy:

#### **1. Current Inventory (`current_inventory`) - Real-Time**
- **Purpose**: Single source of truth for current available stock
- **Updates**: Every procurement and sales transaction updates this table
- **Usage**: Today's operations, real-time stock checking
- **Performance**: Instant lookups, no date calculations needed

#### **2. Daily Inventory (`daily_inventory`) - Historical**
- **Purpose**: Historical snapshots and audit trail for specific dates
- **Updates**: Maintained for historical record keeping
- **Usage**: Past date operations, reporting, carry-forward calculations
- **Performance**: Date-based queries for historical analysis

### **Date-Aware Stock Lookup Logic**

The `getAvailableStock` function implements intelligent date-aware inventory:

```typescript
if (requestedDate === today) {
    // Use current_inventory for real-time accuracy
    return getCurrentStock();
} else if (requestedDate < today) {
    // Use daily_inventory for historical accuracy
    return getHistoricalStock() || getCarriedForwardStock();
} else {
    // Future dates show no stock
    return [];
}
```

### **Stock Update Flow**

#### **On Procurement:**
1. **Current Inventory**: Add to current_stock, update weighted_avg_rate
2. **Daily Inventory**: Record daily procurement snapshot
3. **Both tables maintained in sync**

#### **On Sales:**
1. **Current Inventory**: Subtract from current_stock
2. **Daily Inventory**: Record daily sales snapshot
3. **Real-time stock immediately updated**

### **Inventory Query Behavior**

| Date Type | Data Source | Behavior |
|-----------|-------------|----------|
| **Today** | `current_inventory` | Real-time current stock |
| **Past Dates** | `daily_inventory` | Historical stock for that date |
| **Before First Procurement** | Empty | Correctly shows no stock |
| **Future Dates** | Empty | No stock available |
| **Missing Historical Data** | Carry-forward | Searches backward up to 30 days |

## Procurement Tables

### `procurement_sessions`
**Purpose:** Group all procurement for a specific date
- `id` (Id<"procurement_sessions">) - Unique identifier
- `session_date` (string) - Procurement date (YYYY-MM-DD)
- `total_suppliers` (number) - How many suppliers involved
- `total_amount` (number) - Sum of all purchases
- `status` (union: "active" | "completed") - Session status

**Indexes:**
- `by_date` on `["session_date"]`

### `procurement_entries`
**Purpose:** Individual procurement transactions by type
- `id` (Id<"procurement_entries">) - Unique identifier
- `procurement_session_id` (Id<"procurement_sessions">) - Reference to session
- `supplier_id` (Id<"suppliers">) - Reference to supplier
- `item_id` (Id<"items">) - Reference to item
- `type_name` (string) - Daily type name ("Type X")
- `quantity` (number) - Quantity purchased
- `rate` (number) - Purchase rate per unit
- `total_amount` (number) - quantity × rate

**Indexes:**
- `by_session` on `["procurement_session_id"]`
- `by_date_supplier` on `["session_date", "supplier_id"]`
- `by_date_item` on `["session_date", "item_id"]`

## Sales Tables

### `sales_sessions`
**Purpose:** Group all sales for a specific date
- `id` (Id<"sales_sessions">) - Unique identifier
- `session_date` (string) - Sales date (YYYY-MM-DD)
- `total_sellers` (number) - Number of people who bought
- `total_sales_amount` (number) - Total sales amount
- `status` (union: "active" | "completed") - Session status

**Indexes:**
- `by_date` on `["session_date"]`

### `sales_entries`
**Purpose:** Individual sales to each person for each item
- `id` (Id<"sales_entries">) - Unique identifier
- `sales_session_id` (Id<"sales_sessions">) - Reference to session
- `seller_id` (Id<"sellers">) - Reference to seller
- `item_id` (Id<"items">) - Reference to item
- `total_amount_purchased` (number) - Sum of all line items for this sale
- `total_quantity_purchased` (number) - Sum of all quantities for this sale
- `crates_returned` (number) - Empty crates returned by seller
- `amount_paid` (number) - Cash received from seller
- `less_discount` (number) - Discount given to seller
- `final_quantity_outstanding` (number) - **Calculated running balance INCLUDING opening balance**
- `final_payment_outstanding` (number) - **Calculated running balance INCLUDING opening balance**

**Key Calculations:**
```
final_quantity_outstanding = previous_outstanding + total_quantity_purchased - crates_returned
final_payment_outstanding = previous_outstanding + total_amount_purchased - amount_paid - less_discount
```

**Indexes:**
- `by_session` on `["sales_session_id"]`
- `by_date` on `["session_date"]` (derived from sales_session_id)
- `by_seller` on `["seller_id"]`
- `by_seller_item` on `["seller_id", "item_id"]`
- `by_date_seller_item` on `["session_date", "seller_id", "item_id"]`

### `sales_line_items`
**Purpose:** Break down each sale by type (Person buys Type X + Type Y)
- `id` (Id<"sales_line_items">) - Unique identifier
- `sales_entry_id` (Id<"sales_entries">) - Reference to main sales entry
- `type_name` (string) - Daily type name ("Type X")
- `quantity` (number) - How many of this type sold
- `sale_rate` (number) - Selling rate for this type
- `amount` (number) - quantity × sale_rate

**Indexes:**
- `by_sales_entry` on `["sales_entry_id"]`

## Payment Tables

### `supplier_payments`
**Purpose:** Track payments made to suppliers
- `id` (Id<"supplier_payments">) - Unique identifier
- `payment_date` (string) - Date of payment (YYYY-MM-DD)
- `supplier_id` (Id<"suppliers">) - Reference to supplier
- `item_id` (Id<"items">) - Reference to item
- `amount_paid` (number) - Amount paid to supplier
- `crates_returned` (number) - Empty crates returned to supplier
- `notes` (optional string) - Additional notes

**Indexes:**
- `by_date` on `["payment_date"]`
- `by_supplier` on `["supplier_id"]`
- `by_supplier_item` on `["supplier_id", "item_id"]`

### `seller_payments`
**Purpose:** Track standalone payments received from sellers (without sales)
- `id` (Id<"seller_payments">) - Unique identifier
- `payment_date` (string) - Date of payment (YYYY-MM-DD)
- `seller_id` (Id<"sellers">) - Reference to seller
- `item_id` (Id<"items">) - Reference to item
- `amount_received` (number) - Amount received from seller
- `crates_returned` (number) - Empty crates returned by seller
- `notes` (optional string) - Additional notes

**Indexes:**
- `by_date` on `["payment_date"]`
- `by_seller` on `["seller_id"]`
- `by_seller_item` on `["seller_id", "item_id"]`

## Current Outstanding Balance Tables

### `seller_outstanding`
**Purpose:** Current outstanding balances for each seller per item (includes opening balance + all transactions)
- `id` (Id<"seller_outstanding">) - Unique identifier
- `seller_id` (Id<"sellers">) - Reference to seller
- `item_id` (Id<"items">) - Reference to item
- `payment_due` (number) - **TOTAL amount they owe including opening balance**
- `quantity_due` (number) - **TOTAL crates/kg they should return including opening balance**
- `last_updated` (string) - Date when last calculated

**Indexes:**
- `by_seller` on `["seller_id"]`
- `by_seller_item` on `["seller_id", "item_id"]`

### `supplier_outstanding`
**Purpose:** Current outstanding balances dad owes to suppliers (includes opening balance + all transactions)
- `id` (Id<"supplier_outstanding">) - Unique identifier
- `supplier_id` (Id<"suppliers">) - Reference to supplier
- `item_id` (Id<"items">) - Reference to item
- `payment_due` (number) - **TOTAL amount dad owes including opening balance**
- `quantity_due` (number) - **TOTAL crates dad should return including opening balance**
- `last_updated` (string) - Date when last calculated

**Indexes:**
- `by_supplier` on `["supplier_id"]`
- `by_supplier_item` on `["supplier_id", "item_id"]`

## Critical Business Logic

### **Calculation Formula:**
For any person+item on any date:
```
Final Outstanding Payment = Opening Balance + Sum(All Purchases) - Sum(All Payments) - Sum(All Discounts)
Final Outstanding Quantity = Opening Quantity + Sum(All Quantities Bought) - Sum(All Crates Returned)
```

### **Recalculation Triggers:**
When ANY of these events occur, ALL subsequent entries for the affected person+item must be recalculated:
1. Opening balance is modified
2. Sales entry is added/updated/deleted
3. Payment entry is added/updated/deleted
4. System data integrity check

### **Stock Flow Example:**
**Day 1:** Buy 100 banana crates (Type X: 60, Type Y: 40) → Sell 80 → Closing: Type X: 10, Type Y: 30  
**Day 2:** Buy 80 banana crates (Type X: 20, Type A: 60) → Available: Type X: 30, Type Y: 30, Type A: 60

### **Type Management:**
- Types are dynamic and created daily during procurement
- Same type names across days refer to the same quality/grade
- Types become inactive when no stock remains in current_inventory
- Weighted average rates calculated for carry-forward stock

### **🎯 KEY ARCHITECTURAL BENEFITS:**

#### **Performance Improvements:**
- **Instant Stock Lookups**: No backward searching for current inventory
- **Date-Aware Queries**: Intelligent routing between current vs historical data
- **Optimized Indexes**: Separate indexes for real-time vs historical operations

#### **Data Accuracy:**
- **Real-Time Current Stock**: Always reflects actual available inventory
- **Historical Accuracy**: Past dates show correct stock for that specific date
- **Temporal Consistency**: No anachronistic stock showing before procurement dates

#### **Business Logic Compliance:**
- **Date Validation**: Stock only shows when it actually existed
- **Carry-Forward Logic**: Historical dates can inherit from previous days
- **Future Date Handling**: Prevents impossible future stock scenarios

This dual inventory architecture supports complete business operations with:
- **Real-time accuracy** for current operations
- **Historical precision** for past date analysis
- **Automatic recalculations** for financial management
- **Optimized performance** for wholesale fruit/vegetable markets

The system now properly handles the fundamental business requirement that **inventory should only be available on or after the date it was actually procured**.