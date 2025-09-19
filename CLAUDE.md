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