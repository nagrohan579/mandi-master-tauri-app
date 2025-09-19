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

### `daily_inventory`
**Purpose:** Track available stock for each type each day (opening + new purchases - sales = closing)
- `id` (Id<"daily_inventory">) - Unique identifier
- `inventory_date` (string) - Date (YYYY-MM-DD)
- `item_id` (Id<"items">) - Reference to item
- `type_name` (string) - Daily type name
- `opening_stock` (number) - Stock carried forward from yesterday
- `purchased_today` (number) - New procurement today
- `sold_today` (number) - Total sold to all customers
- `closing_stock` (number) - Remaining stock for tomorrow (calculated)
- `weighted_avg_purchase_rate` (number) - Blended rate of opening + today's purchase

**Calculation:** `closing_stock = opening_stock + purchased_today - sold_today`

**Indexes:**
- `by_date` on `["inventory_date"]`
- `by_date_item` on `["inventory_date", "item_id"]`
- `by_item_type` on `["item_id", "type_name"]`

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
- `quantity_returned` (number) - Crates/kg returned by seller
- `amount_paid` (number) - Cash received from seller
- `less_discount` (number) - Discount given to seller
- `final_quantity_outstanding` (number) - **Calculated running balance INCLUDING opening balance**
- `final_payment_outstanding` (number) - **Calculated running balance INCLUDING opening balance**

**Key Calculations:**
```
final_quantity_outstanding = previous_outstanding + total_quantity_purchased - quantity_returned
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
- `quantity_returned` (number) - Crates returned to supplier
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
- `quantity_returned` (number) - Crates returned by seller
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
Final Outstanding Quantity = Opening Quantity + Sum(All Quantities Bought) - Sum(All Quantities Returned)
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
- Types become inactive when no stock remains
- Weighted average rates calculated for carry-forward stock

This database structure supports complete business operations with automatic recalculations, inventory tracking, and financial management for wholesale fruit/vegetable markets.