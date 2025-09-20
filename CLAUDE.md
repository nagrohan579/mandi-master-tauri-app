# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a **Tauri 2.0 application** with React + TypeScript frontend. Tauri allows building desktop applications using web technologies with a Rust backend.

### Architecture Overview
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui (in `/src/`)
- **Backend**: Rust with Tauri framework (in `/src-tauri/`)
- **Communication**: Frontend calls Rust functions via Tauri's `invoke()` API
- **Configuration**: `src-tauri/tauri.conf.json` defines app settings, build commands, and window properties

### Key Directories
- `src/` - React frontend source code
- `src/components/` - shadcn/ui components
- `src/lib/` - Utility functions (includes `utils.ts` for `cn()` helper)
- `src-tauri/src/` - Rust backend source code
- `src-tauri/Cargo.toml` - Rust dependencies and package config
- `public/` - Static assets served by Vite
- `dist/` - Built frontend (created by `npm run build`)

## Development Commands

### Frontend Development
- `npm run dev` - Start Vite dev server (http://localhost:1420)
- `npm run build` - Build frontend (`tsc && vite build`)
- `npm run preview` - Preview built frontend

### Tauri Development
- `npm run tauri dev` - Start Tauri dev mode (launches desktop app with hot reload)
- `npm run tauri build` - Build production desktop app bundles

### Backend Development
- Rust code is in `src-tauri/src/`
- Tauri commands are defined with `#[tauri::command]` attribute
- Commands must be registered in `invoke_handler` in `lib.rs`

## Tauri Integration Points

### Frontend to Backend Communication
- Use `invoke()` from `@tauri-apps/api/core` to call Rust functions
- Example: `await invoke("greet", { name: "World" })`

### Available Tauri Plugins
- `tauri-plugin-opener` - Opens URLs/files with system default applications

### Configuration Notes
- Dev server runs on port 1420 (fixed port required by Tauri)
- Frontend build output goes to `dist/` directory
- App window defaults to 800x600px
- CSP is disabled (`"csp": null`)

## UI Framework and Styling

### Tailwind CSS v3
- Configured with PostCSS and autoprefixer
- Content paths include `./index.html` and `./src/**/*.{js,ts,jsx,tsx}`
- CSS variables enabled for shadcn/ui theme system
- Dark mode support via `class` strategy

### shadcn/ui Components
- **Style**: New York (recommended)
- **Base color**: Neutral
- **Configuration**: `components.json` in project root
- **Path aliases**: `@/components` and `@/lib/utils` configured
- **Theme**: CSS variables in `src/index.css` with light/dark mode support
- **Utilities**: `cn()` function in `src/lib/utils.ts` for conditional classes

### Adding Components
```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
```

### Key Dependencies
- `tailwindcss@^3` - CSS framework
- `tailwindcss-animate` - Animation utilities
- `class-variance-authority` - Component variants
- `clsx` + `tailwind-merge` - Conditional classes
- `lucide-react` - Icon library

## TypeScript Configuration
- Strict mode enabled with additional linting rules
- React JSX transform configured
- ES2020 target with bundler module resolution
- Path aliases: `@/*` maps to `./src/*`
- Always refer the DATABASE_ARCHITECTURE.md file for the database archtecture info

## Cascade Delete and Update Operations Implementation

### Complete Implementation Status ✅

All cascade delete and update operations have been fully implemented in `convex/entryManagement.ts` as per INSTRUCTIONS.md requirements:

**✅ Delete Operations with Complete Cascade:**
- `deleteProcurementEntry` - Deletes entry, cleans up session, updates inventory, manages item types, validates constraints
- `deleteSalesEntry` - Deletes entry + line items, cleans up session, updates inventory, recalculates all outstanding balances
- `deleteSupplierPayment` & `deleteSellerPayment` - Deletes payments with outstanding balance recalculation
- `deleteSellerOpeningBalance` & `deleteSupplierOpeningBalance` - Deletes with complete transaction recalculation

**✅ Update Operations with Cascade:**
- `updateProcurementEntry` - Updates with inventory/session/outstanding recalculation
- `updateSalesEntry` - Updates with outstanding balance recalculation
- `updateSellerOpeningBalance` & `updateSupplierOpeningBalance` - Updates with ALL subsequent transaction recalculation

**✅ System Integrity & Validation:**
- `runSystemIntegrityCheck` - Comprehensive system validation and repair functionality
- Enhanced constraint checking with negative inventory prevention
- Impact analysis with `analyzeEntryDeletionImpact`
- Force delete capabilities for override scenarios

**✅ Key Features:**
- Complete referential integrity maintenance
- Business logic formula compliance: `Final Outstanding = Opening + Purchases - Payments - Discounts`
- Inventory stock flow management with weighted averages
- Session cleanup (deletes empty procurement/sales sessions)
- Type management (marks item types inactive when no stock remains)
- Comprehensive error handling and validation

**✅ Helper Functions:**
- `recalculateSellerOutstanding` & `recalculateSupplierOutstanding` - Outstanding balance calculation
- `recalculateAllSellerTransactionsFromDate` - Complete transaction recalculation from date
- `calculateCorrectSellerOutstanding` & `calculateCorrectSupplierOutstanding` - Integrity validation

All operations properly handle the critical cascade requirement: **when opening balances change, ALL subsequent entries are recalculated**.

## Date Format Standard

### Indian Date Format Implementation ✅

**UI Display Standard**: All dates in the user interface MUST be displayed in **Indian format (dd/mm/yyyy)** to match local user expectations.

**Database Storage Standard**: All dates in the database remain in **ISO format (yyyy-mm-dd)** for consistency and backend operations.

**Implementation**:
- Use `formatDateForIndia()` utility from `@/lib/utils` for ALL date displays in UI components
- Function handles Date objects, strings, and Unix timestamps (Convex _creationTime)
- Never use `.toLocaleDateString()` without locale specification
- Database operations continue using ISO format strings

**Usage Examples**:
```typescript
// ✅ Correct - Use Indian formatting for UI display
{formatDateForIndia(entry.session_date)}
{formatDateForIndia(item._creationTime)}

// ❌ Incorrect - Default US format
{new Date(entry.session_date).toLocaleDateString()}

// ✅ Exception - Dashboard uses built-in Indian locale
{new Date().toLocaleDateString("en-IN", options)}
```

**Applied to**: UpdateEntriesPage, DeleteEntriesPage, ItemsPage, SuppliersPage, SellersPage, and all future UI components that display dates.

## Dual Inventory System Implementation

### Complete Implementation Status ✅

A **sophisticated dual inventory architecture** has been implemented that solves critical business logic issues with date-aware stock lookup and real-time accuracy.

**✅ Core Problem Solved:**
Fixed major bug where stock was incorrectly showing on dates before procurement actually occurred. The system now enforces: **"Inventory should only be available on or after the date it was actually procured"**.

**✅ Dual Table Architecture:**
- `current_inventory` - Real-time stock tracking with instant lookups for today's operations
- `daily_inventory` - Historical snapshots for audit trail and date-specific queries

**✅ Date-Aware Query Logic:**
The `getAvailableStock` function in `convex/sales.ts` implements intelligent date routing:
- **Today's Date**: Uses current_inventory for real-time accuracy
- **Past Dates**: Uses daily_inventory for historical accuracy with carry-forward logic
- **Future Dates**: Returns empty (no stock available)
- **Before Procurement**: Correctly shows no stock

**✅ Key Features:**
- Instant stock lookups without backward searching
- Historical accuracy for past dates
- Temporal consistency preventing anachronistic stock
- Both tables maintained in sync during procurement and sales

**Implementation Files:**
- `convex/schema.ts` - Added current_inventory table definition
- `convex/procurement.ts` - Updated to maintain both current and daily inventory
- `convex/sales.ts` - Completely rewrote getAvailableStock with date-aware logic
- `DATABASE_ARCHITECTURE.md` - Comprehensive dual system documentation

## Field Terminology Standardization

### Complete Implementation Status ✅

**✅ Comprehensive Rename Completed:**
All `quantity_returned` references changed to `crates_returned` throughout entire codebase for semantic accuracy.

**✅ Reasoning:**
- **Crates Returned**: Specifically refers to empty crates being returned (physical containers)
- **Quantity**: Refers to amount of produce (fruits/vegetables) being sold/purchased

**✅ Files Updated:**
- Database Schema: `convex/schema.ts` - All table definitions use `crates_returned`
- Backend Functions: All mutations and queries use correct terminology
- Frontend UI: All labels display "Crates Returned" instead of "Quantity Returned"
- Documentation: DATABASE_ARCHITECTURE.md updated with correct terminology

**✅ Verification Complete:**
- Database schema uses `crates_returned` in sales_entries, supplier_payments, seller_payments
- API functions use consistent `crates_returned` parameter
- UI labels display correct terminology
- Business logic calculations use proper field names

## Multi-Person Sales Entry UI

### Complete Implementation Status ✅

**✅ UI Redesign Completed:**
Transformed single-person workflow into efficient multi-person sales entry system with collapsible person sections.

**✅ Key Features Implemented:**
- **Collapsible Person Sections**: Each seller has expandable/collapsible section for clean UI
- **Session-Level Item Selection**: Item selection moved to session level for better workflow
- **Real-Time Stock Tracking**: Visual warnings and validation during entry
- **Toast Notification System**: Top-center positioning with auto-dismiss after 3 seconds
- **Real-Time Validation**: Prevents overselling with instant stock checking and visual indicators

**Technical Implementation:**
```typescript
interface PersonEntry {
  id: string;
  seller_id: string;
  lineItems: SalesLineItem[];
  cratesReturned: number;
  amountPaid: number;
  lessDiscount: number;
  isCollapsed: boolean;
}
```

**Real-Time Features:**
- Calculates remaining stock after all pending entries
- Updates in real-time as user types quantities
- Prevents submission if stock would go negative

## Convex Backend Management

### Production Deployment ✅

**✅ Deployment Process Established:**
Robust deployment pipeline for Convex backend functions with proper environment management.

**Deployment Commands:**
```bash
# Production deployment with environment key
CONVEX_DEPLOY_KEY="prod:lovely-hippopotamus-569|..." npx convex deploy

# Function testing on production
CONVEX_DEPLOY_KEY="..." npx convex run sales:getAvailableStock '{"item_id": "...", "date": "2024-01-01"}'
```

**Environment Configuration:**
- Production URL: `https://lovely-hippopotamus-569.convex.cloud`
- Local Config: `.env.local` contains deployment settings
- TypeScript checking disabled for faster deployments (`--typecheck disable`)

**✅ Best Practices:**
- Direct production deployment for immediate updates
- Function verification using command line testing
- Environment separation between dev and production

## Ledger Report Implementation

### Complete Implementation Status ✅

**✅ Seller Ledger Report System:**
Comprehensive transaction history report for specific seller-item combinations with date filtering and expandable type details.

**✅ Backend Implementation:**
- **Function**: `getSalesLedger` in `convex/reports.ts`
- **Query Logic**: Joins sales_entries + sales_line_items + sales_sessions + items/sellers
- **Date Filtering**: Inclusive start/end date range with proper validation
- **Conditional Logic**: Automatically determines crate column visibility based on item.quantity_type

**✅ Frontend Implementation:**
- **File**: `src/pages/LedgerReportPage.tsx`
- **Route**: `/reports/ledger` (updated in `src/App.tsx`)
- **UI Pattern**: Follows existing page structure with shadcn/ui components

**✅ Key Features:**
- **Search Filters**: Seller dropdown, Item dropdown, Start/End date pickers
- **Expandable Table**: Click rows to show individual type breakdown
- **Responsive Design**: Horizontal scrolling with minimum column widths
- **Conditional Columns**: Crate-related columns only shown for relevant items
- **Indian Date Format**: Uses `formatDateForIndia()` utility consistently
- **Running Balances**: Displays cumulative outstanding amounts from database

**✅ Table Structure:**
```
| Date | Type Details | Total Amount | Crates Returned* | Amount Paid | Less | Total Crates Due* | Total Amount Due |
```
*Crate columns conditionally shown

**✅ Technical Challenges Resolved:**
- **Table Layout Issues**: Removed `Collapsible` wrapper that was grouping all content under first column
- **Column Squishing**: Added `overflow-x-auto` and minimum widths for proper display
- **Expandable Functionality**: Used `React.Fragment` and conditional rendering instead of shadcn Collapsible
- **Type Validation**: Fixed Convex type errors with proper Id casting and imports

**✅ Data Flow:**
- Users select seller/item/date range → Backend queries filtered sales data → Frontend displays with expandable type details
- Real-time search with validation (start date ≤ end date)
- Empty state handling for no results

## Daily Dues Report Implementation

### Complete Implementation Status ✅

**✅ Daily Dues Report System:**
Complementary report showing all seller transactions for a specific item on a specific date, organized by seller name.

**✅ Backend Implementation:**
- **Function**: `getDailyDuesByItem` in `convex/reports.ts`
- **Query Logic**: Filters by item_id and single date, joins same tables as ledger report
- **Data Organization**: Groups by seller instead of date for daily analysis
- **Naming**: Renamed to avoid conflict with existing `getDailyDuesReport` function

**✅ Frontend Implementation:**
- **File**: `src/pages/DailyDuesReportPage.tsx`
- **Route**: `/reports/daily-dues` (updated in `src/App.tsx`)
- **Search Interface**: Item dropdown + Single date picker (simpler than ledger)

**✅ Table Structure Differences:**
```
| Seller Name | Type Details | Total Amount | Crates Returned* | Amount Paid | Less | Total Crates Due* | Total Amount Due |
```
- **First Column**: Seller names instead of dates
- **Search Criteria**: Item + single date (instead of seller + date range)
- **Use Case**: View daily activity across all sellers for specific item

**✅ Reused Patterns:**
- Same expandable table implementation (React.Fragment approach)
- Same responsive design with horizontal scrolling
- Same conditional column logic for crates
- Same Indian date formatting and validation
- Same shadcn/ui component structure

**✅ Complementary Functionality:**
- **Ledger Report**: One seller's history over time (seller-centric view)
- **Daily Dues Report**: All sellers' activity for one item/date (item-centric daily view)
- Both reports provide comprehensive transaction analysis from different perspectives

## End of Day Implementation

### Complete Implementation Status ✅

**✅ End of Day System:**
Comprehensive end-of-day reconciliation page for cash management, supplier settlements, and daily closure operations.

**✅ Backend Implementation:**
- **Function**: `getEndOfDayData` in `convex/reports.ts`
- **Query Logic**: Aggregates seller totals and supplier dues for specific item and date
- **Data Calculation**: Real-time summation of sales amounts, payments, and crate transactions

**✅ Frontend Implementation:**
- **File**: `src/pages/EndOfDayPage.tsx`
- **Route**: `/end-of-day` (updated in `src/App.tsx`)
- **UI Structure**: Item/date selectors, sales summary, multi-supplier settlement cards

**✅ Key Features:**
- **Sales Summary Dashboard**: Shows total amount sold, amount received, crates sold, crates received
- **Multi-Supplier Settlement**: Individual settlement cards per supplier with outstanding dues
- **Real-Time Calculations**: Aggregates all seller transactions for the selected item and date
- **Supplier Payment Integration**: Uses existing `addSupplierPayment` function with auto-balance updates

**✅ Sales Summary Metrics:**
```
- Total Amount Sold: Sum of all seller purchases for the item/date
- Total Amount Received: Sum of all payments from sellers for the item/date
- Total Crates Sold: Sum of all quantities sold to sellers
- Total Crates Received: Sum of all crates returned by sellers
```

**✅ Supplier Settlement Process:**
- Displays individual cards for each supplier with outstanding dues
- Shows amount owed and crates owed per supplier
- Input validation prevents overpayment and over-returning
- Automatic outstanding balance updates after settlement
- Toast notifications for success/error feedback

**✅ Input Field Standardization:**
- Applied zero-forcing logic from SalesEntryPage: `value === "" ? 0 : parseFloat(value) || 0`
- Added `step="0.01"` for decimal support
- Default display shows "0" instead of empty strings
- Consistent behavior across all numeric inputs

## Procurement System Enhancement

### Supplier Outstanding Balance Integration ✅

**✅ Critical Fix Implemented:**
The procurement system was missing supplier outstanding balance updates, causing End of Day page to show no supplier dues despite active procurement.

**✅ Problem Identified:**
- Procurement entries only updated inventory tables
- No creation/update of `supplier_outstanding` records
- Suppliers weren't being tracked for amounts owed

**✅ Solution Implemented:**
- Added `updateSupplierOutstanding` function to `convex/procurement.ts`
- Integrated function call in `addProcurementEntry` mutation
- Proper accumulation of payment_due and quantity_due per supplier per item

**✅ Updated Business Logic:**
```typescript
// During procurement entry
await updateSupplierOutstanding(ctx, supplier_id, item_id, total_amount, quantity);

// Creates/updates supplier_outstanding record:
payment_due += procurement_amount
quantity_due += procurement_quantity
```

**✅ Impact:**
- End of Day page now correctly shows supplier dues after procurement
- Supplier settlements work with real outstanding balances
- Complete procurement-to-settlement workflow established

## Input Field Pattern Standardization

### Zero-Forcing Logic Implementation ✅

**✅ Consistent Input Behavior:**
Standardized numeric input handling across SalesEntryPage and EndOfDayPage to prevent empty/invalid values.

**✅ Pattern Applied:**
```typescript
// Standard input onChange handler
onChange={(e) => updateFunction(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}

// Input attributes
<Input
  type="number"
  step="0.01"
  value={stateValue || "0"}
  onChange={handleChange}
/>
```

**✅ Benefits:**
- Always defaults to 0 for empty inputs
- Handles invalid input gracefully
- Prevents undefined/null state issues
- Consistent user experience across forms
- Decimal support with step="0.01"

**✅ Applied to:**
- SalesEntryPage: quantity, sale_rate, crates_returned, amount_paid, less_discount
- EndOfDayPage: amount to pay, crates to return in supplier settlement forms