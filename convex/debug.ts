import { query } from "./_generated/server";

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