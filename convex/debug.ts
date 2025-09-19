import { query, mutation } from "./_generated/server";

// Simple debug queries to check if there's any data
export const debugCheckTables = query({
  args: {},
  handler: async (ctx) => {
    try {
      const items = await ctx.db.query("items").take(5);
      const suppliers = await ctx.db.query("suppliers").take(5);
      const sellers = await ctx.db.query("sellers").take(5);
      const procurementSessions = await ctx.db.query("procurement_sessions").take(5);
      const procurementEntries = await ctx.db.query("procurement_entries").take(5);
      const salesSessions = await ctx.db.query("sales_sessions").take(5);
      const salesEntries = await ctx.db.query("sales_entries").take(5);

      return {
        items: items.length,
        suppliers: suppliers.length,
        sellers: sellers.length,
        procurement_sessions: procurementSessions.length,
        procurement_entries: procurementEntries.length,
        sales_sessions: salesSessions.length,
        sales_entries: salesEntries.length,
        sample_data: {
          items: items.slice(0, 2),
          suppliers: suppliers.slice(0, 2),
          sellers: sellers.slice(0, 2),
          procurement_sessions: procurementSessions.slice(0, 2),
        }
      };
    } catch (error) {
      console.error("Debug query error:", error);
      return { error: error.message };
    }
  },
});

// DANGER: This will delete ALL data from ALL tables
export const wipeAllData = mutation({
  args: {},
  handler: async (ctx) => {
    const tablesToWipe = [
      "items",
      "suppliers",
      "sellers",
      "seller_opening_balances",
      "supplier_opening_balances",
      "item_types",
      "current_inventory", // NEW: Current stock table
      "daily_inventory",
      "procurement_sessions",
      "procurement_entries",
      "sales_sessions",
      "sales_entries",
      "sales_line_items",
      "supplier_payments",
      "seller_payments",
      "seller_outstanding",
      "supplier_outstanding",
    ];

    let totalDeleted = 0;
    const deletionSummary: { [table: string]: number } = {};

    console.log("🔥 STARTING DATA WIPE - This will delete EVERYTHING!");

    for (const tableName of tablesToWipe) {
      try {
        console.log(`🗑️  Wiping table: ${tableName}`);

        // Get all documents in the table
        const documents = await ctx.db.query(tableName as any).collect();

        // Delete each document
        for (const doc of documents) {
          await ctx.db.delete(doc._id);
          totalDeleted++;
        }

        deletionSummary[tableName] = documents.length;
        console.log(`✅ Deleted ${documents.length} records from ${tableName}`);
      } catch (error) {
        console.error(`❌ Error wiping table ${tableName}:`, error);
        deletionSummary[tableName] = -1; // Mark as failed
      }
    }

    console.log(`🎯 WIPE COMPLETE! Total records deleted: ${totalDeleted}`);
    console.log("📊 Summary:", deletionSummary);

    return {
      success: true,
      totalDeleted,
      tablesWiped: tablesToWipe.length,
      deletionSummary,
      message: `Successfully wiped ${totalDeleted} records from ${tablesToWipe.length} tables`
    };
  },
});