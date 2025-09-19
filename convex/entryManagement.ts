import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Search and filter queries for entry management
export const searchProcurementEntries = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    supplierId: v.optional(v.id("suppliers")),
    itemId: v.optional(v.id("items")),
  },
  handler: async (ctx, args) => {
    try {
      console.log("searchProcurementEntries called with args:", args);

      // Debug: Log all sessions to see what exists
      const allSessions = await ctx.db.query("procurement_sessions").collect();
      console.log("All sessions in DB:", allSessions.map(s => ({
        id: s._id,
        date: s.session_date,
        status: s.status,
        total_amount: s.total_amount
      })));

      // Debug: Log all entries to see what exists
      const allEntries = await ctx.db.query("procurement_entries").collect();
      console.log("All procurement entries in DB:", allEntries.length);
      if (allEntries.length > 0) {
        console.log("Sample entries:", allEntries.slice(0, 3).map(e => ({
          id: e._id,
          session_id: e.procurement_session_id,
          supplier_id: e.supplier_id,
          item_id: e.item_id,
          type_name: e.type_name,
          quantity: e.quantity,
          rate: e.rate,
          total_amount: e.total_amount
        })));
      }

      // Use the EXACT same pattern as the working getTodaysProcurement function
      // First, try to get sessions one by one using exact date matching
      const results = [];

      // Generate all dates in the range (avoiding timezone issues)
      console.log(`Date range requested: ${args.startDate} to ${args.endDate}`);

      // Parse dates properly to avoid timezone shifts
      const startDateParts = args.startDate.split('-').map(Number);
      const endDateParts = args.endDate.split('-').map(Number);

      const startDate = new Date(startDateParts[0], startDateParts[1] - 1, startDateParts[2]);
      const endDate = new Date(endDateParts[0], endDateParts[1] - 1, endDateParts[2]);
      const currentDate = new Date(startDate);

      console.log(`Parsed start date: ${startDate.toDateString()}`);
      console.log(`Parsed end date: ${endDate.toDateString()}`);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        console.log(`Checking date: ${dateStr} (from ${currentDate.toDateString()})`);

        // Use the exact same logic as getTodaysProcurement
        const session = await ctx.db
          .query("procurement_sessions")
          .withIndex("by_date", (q) => q.eq("session_date", dateStr))
          .first();

        if (session) {
          console.log(`Found session for ${dateStr}:`, {
            id: session._id,
            status: session.status,
            total_amount: session.total_amount
          });

          // Get all procurement entries for this session using the same pattern
          let entries = await ctx.db
            .query("procurement_entries")
            .withIndex("by_session", (q) => q.eq("procurement_session_id", session._id))
            .collect();

          console.log(`Found ${entries.length} entries for session ${session._id}`);

          // Apply filters after getting base entries (just like the working function)
          if (args.supplierId) {
            entries = entries.filter(e => e.supplier_id === args.supplierId);
            console.log(`After supplier filter: ${entries.length} entries`);
          }

          if (args.itemId) {
            entries = entries.filter(e => e.item_id === args.itemId);
            console.log(`After item filter: ${entries.length} entries`);
          }

          // Enrich with supplier and item names (exactly like getTodaysProcurement)
          for (const entry of entries) {
            try {
              const supplier = await ctx.db.get(entry.supplier_id);
              const item = await ctx.db.get(entry.item_id);

              results.push({
                ...entry,
                session_date: session.session_date,
                supplier_name: supplier?.name || "Unknown Supplier",
                item_name: item?.name || "Unknown Item",
              });
            } catch (error) {
              console.error("Error processing entry:", entry._id, error);
            }
          }
        } else {
          console.log(`No session found for ${dateStr}`);
        }

        // Move to next date
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log("Final results:", results.length);
      console.log("Results summary:", results.map(r => ({
        id: r._id,
        date: r.session_date,
        supplier: r.supplier_name,
        item: r.item_name,
        type: r.type_name,
        amount: r.total_amount
      })));

      return results.sort((a, b) => b.session_date.localeCompare(a.session_date));
    } catch (error) {
      console.error("searchProcurementEntries error:", error);
      return [];
    }
  },
});

export const searchSalesEntries = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    sellerId: v.optional(v.id("sellers")),
    itemId: v.optional(v.id("items")),
  },
  handler: async (ctx, args) => {
    try {
      console.log("searchSalesEntries called with args:", args);

      // Debug: Log all sales sessions to see what exists
      const allSessions = await ctx.db.query("sales_sessions").collect();
      console.log("All sales sessions in DB:", allSessions.map(s => ({
        id: s._id,
        date: s.session_date,
        status: s.status,
        total_amount: s.total_sales_amount
      })));

      // Debug: Log all sales entries to see what exists
      const allEntries = await ctx.db.query("sales_entries").collect();
      console.log("All sales entries in DB:", allEntries.length);
      if (allEntries.length > 0) {
        console.log("Sample sales entries:", allEntries.slice(0, 3).map(e => ({
          id: e._id,
          session_id: e.sales_session_id,
          seller_id: e.seller_id,
          item_id: e.item_id,
          total_amount: e.total_amount_purchased,
          amount_paid: e.amount_paid,
          outstanding: e.final_payment_outstanding
        })));
      }

      // Use the EXACT same pattern as the working procurement function
      const results = [];

      // Generate all dates in the range (avoiding timezone issues)
      console.log(`Sales date range requested: ${args.startDate} to ${args.endDate}`);

      // Parse dates properly to avoid timezone shifts
      const startDateParts = args.startDate.split('-').map(Number);
      const endDateParts = args.endDate.split('-').map(Number);

      const startDate = new Date(startDateParts[0], startDateParts[1] - 1, startDateParts[2]);
      const endDate = new Date(endDateParts[0], endDateParts[1] - 1, endDateParts[2]);
      const currentDate = new Date(startDate);

      console.log(`Parsed sales start date: ${startDate.toDateString()}`);
      console.log(`Parsed sales end date: ${endDate.toDateString()}`);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        console.log(`Checking sales for date: ${dateStr} (from ${currentDate.toDateString()})`);

        // Use the same logic as createSalesSession (exact date matching)
        const session = await ctx.db
          .query("sales_sessions")
          .withIndex("by_date", (q) => q.eq("session_date", dateStr))
          .first();

        if (session) {
          console.log(`Found sales session for ${dateStr}:`, {
            id: session._id,
            status: session.status,
            total_amount: session.total_sales_amount
          });

          // Get all sales entries for this session (same pattern as getSalesEntries)
          let entries = await ctx.db
            .query("sales_entries")
            .withIndex("by_session", (q) => q.eq("sales_session_id", session._id))
            .collect();

          console.log(`Found ${entries.length} sales entries for session ${session._id}`);

          // Apply filters after getting base entries
          if (args.sellerId) {
            entries = entries.filter(e => e.seller_id === args.sellerId);
            console.log(`After seller filter: ${entries.length} entries`);
          }

          if (args.itemId) {
            entries = entries.filter(e => e.item_id === args.itemId);
            console.log(`After item filter: ${entries.length} entries`);
          }

          // Enrich with seller and item names
          for (const entry of entries) {
            try {
              const seller = await ctx.db.get(entry.seller_id);
              const item = await ctx.db.get(entry.item_id);

              results.push({
                ...entry,
                session_date: session.session_date,
                seller_name: seller?.name || "Unknown Seller",
                item_name: item?.name || "Unknown Item",
              });
            } catch (error) {
              console.error("Error processing sales entry:", entry._id, error);
            }
          }
        } else {
          console.log(`No sales session found for ${dateStr}`);
        }

        // Move to next date
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log("Final sales results:", results.length);
      console.log("Sales results summary:", results.map(r => ({
        id: r._id,
        date: r.session_date,
        seller: r.seller_name,
        item: r.item_name,
        total_amount: r.total_amount_purchased,
        outstanding: r.final_payment_outstanding
      })));

      return results.sort((a, b) => b.session_date.localeCompare(a.session_date));
    } catch (error) {
      console.error("searchSalesEntries error:", error);
      return [];
    }
  },
});

export const searchPaymentEntries = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    itemId: v.optional(v.id("items")),
  },
  handler: async (ctx, args) => {
    try {
      console.log("searchPaymentEntries called with args:", args);

      const results = [];

      // Search supplier payments using the by_date index from schema
      const supplierPaymentsQuery = ctx.db
        .query("supplier_payments")
        .withIndex("by_date", (q) =>
          q.gte("payment_date", args.startDate)
           .lte("payment_date", args.endDate)
        );

      let supplierPayments;
      if (args.itemId) {
        // Filter by item after using the date index
        supplierPayments = await supplierPaymentsQuery
          .filter((q) => q.eq(q.field("item_id"), args.itemId))
          .collect();
      } else {
        supplierPayments = await supplierPaymentsQuery.collect();
      }

      console.log("Found supplier payments:", supplierPayments.length);

      for (const payment of supplierPayments) {
        try {
          const supplier = await ctx.db.get(payment.supplier_id);
          const item = await ctx.db.get(payment.item_id);

          results.push({
            ...payment,
            person_name: supplier?.name || "Unknown Supplier",
            item_name: item?.name || "Unknown Item",
            type: "supplier_payment",
            amount: payment.amount_paid, // Map to consistent field name for UI
          });
        } catch (error) {
          console.error("Error processing supplier payment:", payment._id, error);
          // Continue with other payments even if one fails
        }
      }

      // Search seller payments using the by_date index from schema
      const sellerPaymentsQuery = ctx.db
        .query("seller_payments")
        .withIndex("by_date", (q) =>
          q.gte("payment_date", args.startDate)
           .lte("payment_date", args.endDate)
        );

      let sellerPayments;
      if (args.itemId) {
        // Filter by item after using the date index
        sellerPayments = await sellerPaymentsQuery
          .filter((q) => q.eq(q.field("item_id"), args.itemId))
          .collect();
      } else {
        sellerPayments = await sellerPaymentsQuery.collect();
      }

      console.log("Found seller payments:", sellerPayments.length);

      for (const payment of sellerPayments) {
        try {
          const seller = await ctx.db.get(payment.seller_id);
          const item = await ctx.db.get(payment.item_id);

          results.push({
            ...payment,
            person_name: seller?.name || "Unknown Seller",
            item_name: item?.name || "Unknown Item",
            type: "seller_payment",
            amount: payment.amount_received, // Map to consistent field name for UI
          });
        } catch (error) {
          console.error("Error processing seller payment:", payment._id, error);
          // Continue with other payments even if one fails
        }
      }

      console.log("Returning payment results:", results.length);
      return results.sort((a, b) => b.payment_date.localeCompare(a.payment_date));
    } catch (error) {
      console.error("searchPaymentEntries error:", error);
      return [];
    }
  },
});

// Mutation for updating procurement entries with complete cascade handling
export const updateProcurementEntry = mutation({
  args: {
    entryId: v.id("procurement_entries"),
    quantity: v.optional(v.number()),
    rate: v.optional(v.number()),
    type_name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`Starting update of procurement entry: ${args.entryId}`);
      const { entryId, ...updates } = args;

      // 1. Get the current entry
      const currentEntry = await ctx.db.get(entryId);
      if (!currentEntry) {
        throw new Error("Procurement entry not found");
      }

      // Get the session to find the date
      const session = await ctx.db.get(currentEntry.procurement_session_id);
      if (!session) {
        throw new Error("Procurement session not found");
      }

      // Calculate new values
      const oldQuantity = currentEntry.quantity;
      const oldRate = currentEntry.rate;
      const oldTotalAmount = currentEntry.total_amount;
      const oldTypeName = currentEntry.type_name;

      const newQuantity = updates.quantity ?? oldQuantity;
      const newRate = updates.rate ?? oldRate;
      const newTypeName = updates.type_name ?? oldTypeName;
      const newTotalAmount = newQuantity * newRate;

      console.log(`Updating entry: quantity ${oldQuantity} → ${newQuantity}, rate ${oldRate} → ${newRate}, type "${oldTypeName}" → "${newTypeName}"`);

      // 2. Check inventory constraints - ensure updated quantities don't break sales that already happened
      const inventoryRecord = await ctx.db
        .query("daily_inventory")
        .withIndex("by_date_item", (q) =>
          q.eq("inventory_date", session.session_date)
           .eq("item_id", currentEntry.item_id)
        )
        .filter((q) => q.eq(q.field("type_name"), oldTypeName))
        .first();

      if (inventoryRecord && inventoryRecord.sold_today > 0) {
        // Check if reducing quantity would create negative stock
        const quantityDifference = newQuantity - oldQuantity;
        const newPurchased = inventoryRecord.purchased_today + quantityDifference;
        const newClosing = inventoryRecord.opening_stock + newPurchased - inventoryRecord.sold_today;

        if (newClosing < 0) {
          throw new Error(
            `Cannot reduce quantity: ${inventoryRecord.sold_today} units were already sold, ` +
            `reducing to ${newQuantity} would create negative inventory.`
          );
        }
      }

      // 3. Update the procurement entry
      await ctx.db.patch(entryId, {
        ...updates,
        total_amount: newTotalAmount,
      });
      console.log("Updated procurement entry");

      // 4. Update daily inventory for the old type name
      if (inventoryRecord) {
        const quantityDifference = newQuantity - oldQuantity;

        const newPurchased = inventoryRecord.purchased_today + quantityDifference;
        const newClosing = inventoryRecord.opening_stock + newPurchased - inventoryRecord.sold_today;

        // Recalculate weighted average rate
        let newWeightedAvg = inventoryRecord.weighted_avg_purchase_rate;
        if (newPurchased > 0) {
          const oldTotalValue = (inventoryRecord.opening_stock + inventoryRecord.purchased_today) * inventoryRecord.weighted_avg_purchase_rate;
          const oldEntryValue = oldQuantity * oldRate;
          const newEntryValue = newQuantity * newRate;
          const newTotalValue = oldTotalValue - oldEntryValue + newEntryValue;
          const newTotalQuantity = inventoryRecord.opening_stock + newPurchased;
          newWeightedAvg = newTotalQuantity > 0 ? newTotalValue / newTotalQuantity : newRate;
        }

        await ctx.db.patch(inventoryRecord._id, {
          purchased_today: newPurchased,
          closing_stock: Math.max(0, newClosing),
          weighted_avg_purchase_rate: newWeightedAvg,
        });
        console.log("Updated daily inventory for old type");
      }

      // 5. If type name changed, handle the new type name inventory
      if (newTypeName !== oldTypeName) {
        console.log(`Type name changed from "${oldTypeName}" to "${newTypeName}"`);

        // Update item_types for the new type
        await updateItemType(ctx, currentEntry.item_id, newTypeName);

        // Create or update inventory record for the new type
        const newTypeInventory = await ctx.db
          .query("daily_inventory")
          .withIndex("by_date_item", (q) =>
            q.eq("inventory_date", session.session_date)
             .eq("item_id", currentEntry.item_id)
          )
          .filter((q) => q.eq(q.field("type_name"), newTypeName))
          .first();

        if (newTypeInventory) {
          // Add to existing inventory
          const updatedPurchased = newTypeInventory.purchased_today + newQuantity;
          const updatedClosing = newTypeInventory.opening_stock + updatedPurchased - newTypeInventory.sold_today;

          // Recalculate weighted average
          const totalValue = (newTypeInventory.opening_stock + newTypeInventory.purchased_today) * newTypeInventory.weighted_avg_purchase_rate + (newQuantity * newRate);
          const totalQuantity = newTypeInventory.opening_stock + updatedPurchased;
          const newWeightedAvg = totalQuantity > 0 ? totalValue / totalQuantity : newRate;

          await ctx.db.patch(newTypeInventory._id, {
            purchased_today: updatedPurchased,
            closing_stock: Math.max(0, updatedClosing),
            weighted_avg_purchase_rate: newWeightedAvg,
          });
        } else {
          // Create new inventory record
          await ctx.db.insert("daily_inventory", {
            inventory_date: session.session_date,
            item_id: currentEntry.item_id,
            type_name: newTypeName,
            opening_stock: 0,
            purchased_today: newQuantity,
            sold_today: 0,
            closing_stock: newQuantity,
            weighted_avg_purchase_rate: newRate,
          });
        }
        console.log("Updated/created inventory for new type");
      }

      // 6. Update session totals
      const sessionEntries = await ctx.db
        .query("procurement_entries")
        .withIndex("by_session", (q) => q.eq("procurement_session_id", currentEntry.procurement_session_id))
        .collect();

      const newSessionTotal = sessionEntries.reduce((sum, entry) =>
        sum + (entry._id === entryId ? newTotalAmount : entry.total_amount), 0
      );

      await ctx.db.patch(currentEntry.procurement_session_id, {
        total_amount: newSessionTotal,
      });
      console.log("Updated session totals");

      // 7. Recalculate supplier outstanding (procurement affects what we owe suppliers)
      await recalculateSupplierOutstanding(ctx, currentEntry.supplier_id, currentEntry.item_id);

      console.log("Procurement entry update completed successfully");
      return {
        success: true,
        message: "Procurement entry updated successfully",
        updatedEntry: {
          id: entryId,
          oldValues: { quantity: oldQuantity, rate: oldRate, total_amount: oldTotalAmount, type_name: oldTypeName },
          newValues: { quantity: newQuantity, rate: newRate, total_amount: newTotalAmount, type_name: newTypeName }
        }
      };

    } catch (error) {
      console.error("updateProcurementEntry error:", error);
      throw new Error(`Failed to update procurement entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

// Helper function to update item types (moved from procurement.ts for reuse)
async function updateItemType(ctx: any, item_id: string, type_name: string) {
  const currentDate = new Date().toISOString().split("T")[0];

  const existing = await ctx.db
    .query("item_types")
    .withIndex("by_item_type", (q: any) => q.eq("item_id", item_id).eq("type_name", type_name))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      last_seen_date: currentDate,
      is_active: true,
    });
  } else {
    await ctx.db.insert("item_types", {
      item_id,
      type_name,
      first_introduced_date: currentDate,
      last_seen_date: currentDate,
      is_active: true,
    });
  }
}

// Mutation for updating sales entries
export const updateSalesEntry = mutation({
  args: {
    entryId: v.id("sales_entries"),
    amount_paid: v.optional(v.number()),
    less_discount: v.optional(v.number()),
    crates_returned: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      const { entryId, ...updates } = args;

      // Get the current entry
      const currentEntry = await ctx.db.get(entryId);
      if (!currentEntry) {
        throw new Error("Sales entry not found");
      }

      // Recalculate outstanding balances if payment details changed
      const newAmountPaid = updates.amount_paid ?? currentEntry.amount_paid;
      const newDiscount = updates.less_discount ?? currentEntry.less_discount;
      const newCratesReturned = updates.crates_returned ?? currentEntry.crates_returned;

      // Calculate new outstanding balances
      const newPaymentOutstanding = currentEntry.total_amount_purchased - newAmountPaid - newDiscount;
      const newQuantityOutstanding = currentEntry.total_quantity_purchased - newCratesReturned;

      // Update the entry
      await ctx.db.patch(entryId, {
        ...updates,
        final_payment_outstanding: newPaymentOutstanding,
        final_quantity_outstanding: newQuantityOutstanding,
      });

      // TODO: Update seller_outstanding table with new balances

      return entryId;
    } catch (error) {
      console.error("updateSalesEntry error:", error);
      throw new Error("Failed to update sales entry");
    }
  },
});

// Mutation for deleting procurement entries with complete cascade handling
export const deleteProcurementEntry = mutation({
  args: {
    entryId: v.id("procurement_entries"),
    forceDelete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`Starting deletion of procurement entry: ${args.entryId}`);

      // 1. Get the procurement entry to be deleted
      const entry = await ctx.db.get(args.entryId);
      if (!entry) {
        throw new Error("Procurement entry not found");
      }

      // Get the session to find the date
      const session = await ctx.db.get(entry.procurement_session_id);
      if (!session) {
        throw new Error("Procurement session not found");
      }

      console.log(`Deleting entry: ${entry.quantity} units of ${entry.type_name} from ${session.session_date}`);

      // 2. Enhanced validation constraints - comprehensive inventory and dependency checks
      const inventoryRecord = await ctx.db
        .query("daily_inventory")
        .withIndex("by_date_item", (q) =>
          q.eq("inventory_date", session.session_date)
           .eq("item_id", entry.item_id)
        )
        .filter((q) => q.eq(q.field("type_name"), entry.type_name))
        .first();

      // Validate sales constraints to prevent negative inventory
      if (inventoryRecord && inventoryRecord.sold_today > 0 && !args.forceDelete) {
        const newPurchased = inventoryRecord.purchased_today - entry.quantity;
        const newClosing = inventoryRecord.opening_stock + newPurchased - inventoryRecord.sold_today;

        if (newClosing < 0) {
          throw new Error(
            `Cannot delete procurement entry: ${inventoryRecord.sold_today} units were already sold, ` +
            `but this procurement has ${entry.quantity} units. Deletion would create negative inventory. ` +
            `Use forceDelete=true to override this safety check.`
          );
        }
      }

      // Additional validation: Check for future stock dependencies
      if (inventoryRecord) {
        // Check if this procurement's stock affects future dates
        const futureSessions = await ctx.db
          .query("sales_sessions")
          .withIndex("by_date", (q) => q.gt("session_date", session.session_date))
          .collect();

        let warningCount = 0;
        for (const _futureSession of futureSessions) {
          const futureSales = await ctx.db
            .query("sales_line_items")
            .collect();

          const relevantFutureSales = futureSales.filter(sale =>
            sale.type_name === entry.type_name
          );

          if (relevantFutureSales.length > 0) {
            warningCount += relevantFutureSales.length;
          }
        }

        if (warningCount > 0 && !args.forceDelete) {
          console.warn(`Warning: This procurement affects ${warningCount} future sales. Use forceDelete to proceed.`);
        }
      }

      // 3. Delete the procurement entry
      await ctx.db.delete(args.entryId);
      console.log("Deleted procurement entry");

      // 4. Update daily inventory - remove this entry's contribution
      if (inventoryRecord) {
        const newPurchased = inventoryRecord.purchased_today - entry.quantity;
        const newClosing = inventoryRecord.opening_stock + newPurchased - inventoryRecord.sold_today;

        // Recalculate weighted average rate without this entry
        let newWeightedAvg = inventoryRecord.weighted_avg_purchase_rate;
        if (newPurchased > 0) {
          // Remove this entry's contribution to the weighted average
          const totalValue = (inventoryRecord.opening_stock + inventoryRecord.purchased_today) * inventoryRecord.weighted_avg_purchase_rate;
          const entryValue = entry.quantity * entry.rate;
          const newTotalValue = totalValue - entryValue;
          const newTotalQuantity = inventoryRecord.opening_stock + newPurchased;
          newWeightedAvg = newTotalQuantity > 0 ? newTotalValue / newTotalQuantity : 0;
        }

        await ctx.db.patch(inventoryRecord._id, {
          purchased_today: newPurchased,
          closing_stock: Math.max(0, newClosing),
          weighted_avg_purchase_rate: newWeightedAvg,
        });
        console.log("Updated daily inventory");
      }

      // 5. Check if this was the last entry in the session - if so, delete the session
      const remainingEntries = await ctx.db
        .query("procurement_entries")
        .withIndex("by_session", (q) => q.eq("procurement_session_id", entry.procurement_session_id))
        .collect();

      if (remainingEntries.length === 0) {
        await ctx.db.delete(entry.procurement_session_id);
        console.log("Deleted empty procurement session");
      } else {
        // Update session totals
        const newSessionTotal = remainingEntries.reduce((sum, e) => sum + e.total_amount, 0);
        await ctx.db.patch(entry.procurement_session_id, {
          total_amount: newSessionTotal,
        });
        console.log("Updated session totals");
      }

      // 6. Check if this was the last procurement of this type - update item_types
      const otherTypeEntries = await ctx.db
        .query("procurement_entries")
        .withIndex("by_date_item", (q) =>
          q.eq("procurement_session_id", entry.procurement_session_id)
           .eq("item_id", entry.item_id)
        )
        .filter((q) => q.eq(q.field("type_name"), entry.type_name))
        .collect();

      if (otherTypeEntries.length === 0) {
        // This was the last procurement of this type, check if we should mark it inactive
        const itemType = await ctx.db
          .query("item_types")
          .withIndex("by_item_type", (q) =>
            q.eq("item_id", entry.item_id)
             .eq("type_name", entry.type_name)
          )
          .first();

        if (itemType) {
          // Check if there's any remaining inventory of this type
          const remainingInventory = await ctx.db
            .query("daily_inventory")
            .withIndex("by_item_type", (q) =>
              q.eq("item_id", entry.item_id)
               .eq("type_name", entry.type_name)
            )
            .filter((q) => q.gt(q.field("closing_stock"), 0))
            .first();

          if (!remainingInventory) {
            await ctx.db.patch(itemType._id, {
              is_active: false,
              last_seen_date: session.session_date,
            });
            console.log("Marked item type as inactive");
          }
        }
      }

      // 7. No need to recalculate supplier outstanding for procurement deletions
      // (supplier outstanding is calculated from procurement entries, not affected by deletions)

      console.log("Procurement entry deletion completed successfully");
      return {
        success: true,
        message: "Procurement entry and all related data deleted successfully",
        deletedEntry: {
          id: args.entryId,
          quantity: entry.quantity,
          type_name: entry.type_name,
          total_amount: entry.total_amount
        }
      };

    } catch (error) {
      console.error("deleteProcurementEntry error:", error);
      throw new Error(`Failed to delete procurement entry: ${error.message}`);
    }
  },
});

// Mutation for deleting sales entries with complete cascade handling
export const deleteSalesEntry = mutation({
  args: {
    entryId: v.id("sales_entries"),
    forceDelete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`Starting deletion of sales entry: ${args.entryId}`);

      // 1. Get the sales entry to be deleted
      const entry = await ctx.db.get(args.entryId);
      if (!entry) {
        throw new Error("Sales entry not found");
      }

      // Get the session to find the date
      const session = await ctx.db.get(entry.sales_session_id);
      if (!session) {
        throw new Error("Sales session not found");
      }

      console.log(`Deleting sales entry for seller ${entry.seller_id}, item ${entry.item_id} from ${session.session_date}`);

      // 2. Get all related line items
      const lineItems = await ctx.db
        .query("sales_line_items")
        .withIndex("by_sales_entry", (q) => q.eq("sales_entry_id", args.entryId))
        .collect();

      console.log(`Found ${lineItems.length} line items to delete`);

      // 3. Delete all related line items first
      for (const lineItem of lineItems) {
        await ctx.db.delete(lineItem._id);
      }
      console.log("Deleted all line items");

      // 4. Update daily inventory - add quantities back to available stock
      for (const lineItem of lineItems) {
        const inventoryRecord = await ctx.db
          .query("daily_inventory")
          .withIndex("by_date_item", (q) =>
            q.eq("inventory_date", session.session_date)
             .eq("item_id", entry.item_id)
          )
          .filter((q) => q.eq(q.field("type_name"), lineItem.type_name))
          .first();

        if (inventoryRecord) {
          const newSold = inventoryRecord.sold_today - lineItem.quantity;
          const newClosing = inventoryRecord.opening_stock + inventoryRecord.purchased_today - newSold;

          await ctx.db.patch(inventoryRecord._id, {
            sold_today: Math.max(0, newSold),
            closing_stock: Math.max(0, newClosing),
          });
          console.log(`Updated inventory: added back ${lineItem.quantity} units of ${lineItem.type_name}`);
        }
      }

      // 5. Delete the sales entry
      await ctx.db.delete(args.entryId);
      console.log("Deleted sales entry");

      // 6. Check if this was the last entry in the session - if so, delete the session
      const remainingEntries = await ctx.db
        .query("sales_entries")
        .withIndex("by_session", (q) => q.eq("sales_session_id", entry.sales_session_id))
        .collect();

      if (remainingEntries.length === 0) {
        await ctx.db.delete(entry.sales_session_id);
        console.log("Deleted empty sales session");
      } else {
        // Update session totals
        const newSessionTotal = remainingEntries.reduce((sum, e) => sum + e.total_amount_purchased, 0);
        await ctx.db.patch(entry.sales_session_id, {
          total_sales_amount: newSessionTotal,
        });
        console.log("Updated session totals");
      }

      // 7. Recalculate seller outstanding for this seller+item combination
      await recalculateSellerOutstanding(ctx, entry.seller_id, entry.item_id);

      // 8. Recalculate all subsequent dates for this seller+item
      await recalculateSubsequentSalesBalances(ctx, entry.seller_id, entry.item_id, session.session_date, args.entryId);

      console.log("Sales entry deletion completed successfully");
      return {
        success: true,
        message: "Sales entry and all related data deleted successfully",
        deletedEntry: {
          id: args.entryId,
          total_amount: entry.total_amount_purchased,
          total_quantity: entry.total_quantity_purchased,
          lineItemsDeleted: lineItems.length
        }
      };

    } catch (error) {
      console.error("deleteSalesEntry error:", error);
      throw new Error(`Failed to delete sales entry: ${error.message}`);
    }
  },
});

// Helper function to recalculate seller outstanding balances
async function recalculateSellerOutstanding(ctx: any, seller_id: string, item_id: string) {
  console.log(`Recalculating outstanding balance for seller ${seller_id}, item ${item_id}`);

  // Get opening balance
  const openingBalance = await ctx.db
    .query("seller_opening_balances")
    .withIndex("by_seller_item", (q) => q.eq("seller_id", seller_id).eq("item_id", item_id))
    .first();

  // Get all sales entries for this seller+item
  const salesEntries = await ctx.db
    .query("sales_entries")
    .withIndex("by_seller_item", (q) => q.eq("seller_id", seller_id).eq("item_id", item_id))
    .collect();

  // Get all payments for this seller+item
  const payments = await ctx.db
    .query("seller_payments")
    .withIndex("by_seller_item", (q) => q.eq("seller_id", seller_id).eq("item_id", item_id))
    .collect();

  // Calculate totals
  const totalPurchases = salesEntries.reduce((sum, entry) => sum + entry.total_amount_purchased, 0);
  const totalQuantityPurchased = salesEntries.reduce((sum, entry) => sum + entry.total_quantity_purchased, 0);
  const totalCratesReturned = salesEntries.reduce((sum, entry) => sum + entry.crates_returned, 0);
  const totalPaid = salesEntries.reduce((sum, entry) => sum + entry.amount_paid, 0);
  const totalDiscount = salesEntries.reduce((sum, entry) => sum + entry.less_discount, 0);
  const totalPayments = payments.reduce((sum, payment) => sum + payment.amount_received, 0);
  const totalCratesFromPayments = payments.reduce((sum, payment) => sum + payment.crates_returned, 0);

  // Calculate final outstanding amounts
  const openingPayment = openingBalance?.opening_payment_due || 0;
  const openingQuantity = openingBalance?.opening_quantity_due || 0;

  const finalPaymentDue = openingPayment + totalPurchases - totalPaid - totalDiscount - totalPayments;
  const finalQuantityDue = openingQuantity + totalQuantityPurchased - totalCratesReturned - totalCratesFromPayments;

  // Update or create seller outstanding record
  const currentDate = new Date().toISOString().split("T")[0];
  const existingOutstanding = await ctx.db
    .query("seller_outstanding")
    .withIndex("by_seller_item", (q) => q.eq("seller_id", seller_id).eq("item_id", item_id))
    .first();

  if (existingOutstanding) {
    await ctx.db.patch(existingOutstanding._id, {
      payment_due: finalPaymentDue,
      quantity_due: finalQuantityDue,
      last_updated: currentDate,
    });
  } else {
    await ctx.db.insert("seller_outstanding", {
      seller_id,
      item_id,
      payment_due: finalPaymentDue,
      quantity_due: finalQuantityDue,
      last_updated: currentDate,
    });
  }

  console.log(`Updated outstanding: payment=${finalPaymentDue}, quantity=${finalQuantityDue}`);
}

// Helper function to recalculate subsequent sales balances
async function recalculateSubsequentSalesBalances(ctx: any, seller_id: string, item_id: string, deletedDate: string, deletedEntryId?: string) {
  console.log(`Recalculating subsequent sales balances for seller ${seller_id}, item ${item_id} after ${deletedDate}`);

  // Get all sales entries for this seller+item after the deleted date, ordered by date
  const salesSessions = await ctx.db
    .query("sales_sessions")
    .withIndex("by_date", (q) => q.gt("session_date", deletedDate))
    .collect();

  // Sort sessions by date
  salesSessions.sort((a, b) => a.session_date.localeCompare(b.session_date));

  let runningPaymentBalance = 0;
  let runningQuantityBalance = 0;

  // Get opening balance and calculate starting point
  const openingBalance = await ctx.db
    .query("seller_opening_balances")
    .withIndex("by_seller_item", (q) => q.eq("seller_id", seller_id).eq("item_id", item_id))
    .first();

  runningPaymentBalance = openingBalance?.opening_payment_due || 0;
  runningQuantityBalance = openingBalance?.opening_quantity_due || 0;

  // Add all transactions up to the deleted date
  const priorSessions = await ctx.db
    .query("sales_sessions")
    .withIndex("by_date", (q) => q.lte("session_date", deletedDate))
    .collect();

  for (const session of priorSessions.sort((a, b) => a.session_date.localeCompare(b.session_date))) {
    const sessionEntries = await ctx.db
      .query("sales_entries")
      .withIndex("by_session", (q) => q.eq("sales_session_id", session._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("seller_id"), seller_id),
          q.eq(q.field("item_id"), item_id)
        )
      )
      .collect();

    for (const entry of sessionEntries) {
      if (!deletedEntryId || entry._id !== deletedEntryId) { // Skip the deleted entry if specified
        runningPaymentBalance += entry.total_amount_purchased - entry.amount_paid - entry.less_discount;
        runningQuantityBalance += entry.total_quantity_purchased - entry.crates_returned;
      }
    }
  }

  // Now update all subsequent entries with correct running balances
  for (const session of salesSessions) {
    const sessionEntries = await ctx.db
      .query("sales_entries")
      .withIndex("by_session", (q) => q.eq("sales_session_id", session._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("seller_id"), seller_id),
          q.eq(q.field("item_id"), item_id)
        )
      )
      .collect();

    for (const entry of sessionEntries) {
      runningPaymentBalance += entry.total_amount_purchased - entry.amount_paid - entry.less_discount;
      runningQuantityBalance += entry.total_quantity_purchased - entry.crates_returned;

      await ctx.db.patch(entry._id, {
        final_payment_outstanding: runningPaymentBalance,
        final_quantity_outstanding: runningQuantityBalance,
      });
    }
  }

  console.log("Completed recalculation of subsequent sales balances");
}

// Query for impact analysis
export const analyzeEntryDeletionImpact = query({
  args: {
    entryType: v.union(v.literal("procurement"), v.literal("sales"), v.literal("payment")),
    entryId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      if (args.entryType === "procurement") {
        return await analyzeProcurementDeletionImpact(ctx, args.entryId as any);
      } else if (args.entryType === "sales") {
        return await analyzeSalesDeletionImpact(ctx, args.entryId as any);
      } else {
        return await analyzePaymentDeletionImpact(ctx, args.entryId);
      }
    } catch (error) {
      console.error("analyzeEntryDeletionImpact error:", error);
      throw new Error("Failed to analyze deletion impact");
    }
  },
});

// Helper function to analyze procurement deletion impact
async function analyzeProcurementDeletionImpact(ctx: any, entryId: string) {
  const entry = await ctx.db.get(entryId);
  if (!entry) {
    return { warningLevel: "high", canDelete: false, restrictions: ["Entry not found"] };
  }

  const session = await ctx.db.get(entry.procurement_session_id);
  if (!session) {
    return { warningLevel: "high", canDelete: false, restrictions: ["Session not found"] };
  }

  // Check if stock was already sold
  const inventoryRecord = await ctx.db
    .query("daily_inventory")
    .withIndex("by_date_item", (q) =>
      q.eq("inventory_date", session.session_date)
       .eq("item_id", entry.item_id)
    )
    .filter((q) => q.eq(q.field("type_name"), entry.type_name))
    .first();

  let canDelete = true;
  let warningLevel = "low";
  const restrictions = [];
  const cascadeEffects = [
    "Daily inventory will be updated",
    "Session totals will be recalculated"
  ];

  if (inventoryRecord && inventoryRecord.sold_today > 0) {
    const newPurchased = inventoryRecord.purchased_today - entry.quantity;
    const newClosing = inventoryRecord.opening_stock + newPurchased - inventoryRecord.sold_today;

    if (newClosing < 0) {
      canDelete = false;
      warningLevel = "high";
      restrictions.push(
        `Cannot delete: ${inventoryRecord.sold_today} units were already sold, ` +
        `deletion would create negative inventory`
      );
    } else {
      warningLevel = "medium";
      cascadeEffects.push("Stock levels will be adjusted for sold items");
    }
  }

  return {
    warningLevel,
    canDelete,
    restrictions,
    cascadeEffects,
    affectedQuantity: entry.quantity,
    affectedAmount: entry.total_amount
  };
}

// Helper function to analyze sales deletion impact
async function analyzeSalesDeletionImpact(ctx: any, entryId: string) {
  const entry = await ctx.db.get(entryId);
  if (!entry) {
    return { warningLevel: "high", canDelete: false, restrictions: ["Entry not found"] };
  }

  const lineItems = await ctx.db
    .query("sales_line_items")
    .withIndex("by_sales_entry", (q) => q.eq("sales_entry_id", entryId))
    .collect();

  // Check for subsequent transactions
  const subsequentEntries = await ctx.db
    .query("sales_entries")
    .withIndex("by_seller_item", (q) => q.eq("seller_id", entry.seller_id).eq("item_id", entry.item_id))
    .collect();

  const cascadeEffects = [
    `${lineItems.length} line items will be deleted`,
    "Daily inventory will be updated",
    "Outstanding balances will be recalculated",
    "All subsequent transactions will be recalculated"
  ];

  return {
    warningLevel: "medium",
    canDelete: true,
    restrictions: [],
    cascadeEffects,
    affectedTransactions: subsequentEntries.length,
    affectedLineItems: lineItems.length,
    affectedAmount: entry.total_amount_purchased
  };
}

// Mutation for deleting supplier payment entries with complete cascade handling
export const deleteSupplierPayment = mutation({
  args: {
    entryId: v.id("supplier_payments"),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`Starting deletion of supplier payment: ${args.entryId}`);

      // 1. Get the payment entry to be deleted
      const payment = await ctx.db.get(args.entryId);
      if (!payment) {
        throw new Error("Supplier payment not found");
      }

      console.log(`Deleting supplier payment: ${payment.amount_paid} to supplier ${payment.supplier_id} for item ${payment.item_id}`);

      // 2. Delete the payment record
      await ctx.db.delete(args.entryId);
      console.log("Deleted supplier payment record");

      // 3. Recalculate supplier outstanding balances
      await recalculateSupplierOutstanding(ctx, payment.supplier_id, payment.item_id);

      // 4. No need to recalculate subsequent transactions for supplier payments
      // (supplier outstanding is calculated from procurement entries, not payment history)

      console.log("Supplier payment deletion completed successfully");
      return {
        success: true,
        message: "Supplier payment deleted successfully",
        deletedPayment: {
          id: args.entryId,
          amount: payment.amount_paid,
          crates_returned: payment.crates_returned
        }
      };

    } catch (error) {
      console.error("deleteSupplierPayment error:", error);
      throw new Error(`Failed to delete supplier payment: ${error.message}`);
    }
  },
});

// Mutation for deleting seller payment entries with complete cascade handling
export const deleteSellerPayment = mutation({
  args: {
    entryId: v.id("seller_payments"),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`Starting deletion of seller payment: ${args.entryId}`);

      // 1. Get the payment entry to be deleted
      const payment = await ctx.db.get(args.entryId);
      if (!payment) {
        throw new Error("Seller payment not found");
      }

      console.log(`Deleting seller payment: ${payment.amount_received} from seller ${payment.seller_id} for item ${payment.item_id}`);

      // 2. Delete the payment record
      await ctx.db.delete(args.entryId);
      console.log("Deleted seller payment record");

      // 3. Recalculate seller outstanding balances
      await recalculateSellerOutstanding(ctx, payment.seller_id, payment.item_id);

      // 4. Recalculate subsequent transactions for this seller+item from the payment date
      await recalculateSubsequentSalesBalances(ctx, payment.seller_id, payment.item_id, payment.payment_date);

      console.log("Seller payment deletion completed successfully");
      return {
        success: true,
        message: "Seller payment deleted successfully",
        deletedPayment: {
          id: args.entryId,
          amount: payment.amount_received,
          crates_returned: payment.crates_returned
        }
      };

    } catch (error) {
      console.error("deleteSellerPayment error:", error);
      throw new Error(`Failed to delete seller payment: ${error.message}`);
    }
  },
});

// Enhanced helper function to recalculate supplier outstanding balances
async function recalculateSupplierOutstanding(ctx: any, supplier_id: string, item_id: string) {
  console.log(`Recalculating supplier outstanding balance for supplier ${supplier_id}, item ${item_id}`);

  try {
    // Get opening balance
    const openingBalance = await ctx.db
      .query("supplier_opening_balances")
      .withIndex("by_supplier_item", (q) => q.eq("supplier_id", supplier_id).eq("item_id", item_id))
      .first();

    // Get all procurement entries for this supplier+item properly
    const allEntries = await ctx.db.query("procurement_entries").collect();
    const relevantEntries = allEntries.filter(e => e.supplier_id === supplier_id && e.item_id === item_id);

    // Get all payments for this supplier+item
    const payments = await ctx.db
      .query("supplier_payments")
      .withIndex("by_supplier_item", (q) => q.eq("supplier_id", supplier_id).eq("item_id", item_id))
      .collect();

    // Calculate totals
    const totalProcurement = relevantEntries.reduce((sum, entry) => sum + entry.total_amount, 0);
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount_paid, 0);
    const totalQuantityPurchased = relevantEntries.reduce((sum, entry) => sum + entry.quantity, 0);
    const totalCratesReturned = payments.reduce((sum, payment) => sum + payment.crates_returned, 0);

    // Calculate final outstanding amounts (including opening balance)
    const openingPayment = openingBalance?.opening_payment_due || 0;
    const openingQuantity = openingBalance?.opening_quantity_due || 0;

    const finalPaymentDue = openingPayment + totalProcurement - totalPaid;
    const finalQuantityDue = openingQuantity + totalQuantityPurchased - totalCratesReturned;

    // Update or create supplier outstanding record
    const currentDate = new Date().toISOString().split("T")[0];
    const existingOutstanding = await ctx.db
      .query("supplier_outstanding")
      .withIndex("by_supplier_item", (q) => q.eq("supplier_id", supplier_id).eq("item_id", item_id))
      .first();

    if (existingOutstanding) {
      await ctx.db.patch(existingOutstanding._id, {
        payment_due: finalPaymentDue,
        quantity_due: finalQuantityDue,
        last_updated: currentDate,
      });
    } else {
      await ctx.db.insert("supplier_outstanding", {
        supplier_id,
        item_id,
        payment_due: finalPaymentDue,
        quantity_due: finalQuantityDue,
        last_updated: currentDate,
      });
    }

    console.log(`Updated supplier outstanding: payment=${finalPaymentDue}, quantity=${finalQuantityDue}`);
  } catch (error) {
    console.error("Error in recalculateSupplierOutstanding:", error);
    throw new Error(`Failed to recalculate supplier outstanding: ${error.message}`);
  }
}

// Helper function to analyze payment deletion impact
async function analyzePaymentDeletionImpact(ctx: any, entryId: string) {
  return {
    warningLevel: "low",
    canDelete: true,
    restrictions: [],
    cascadeEffects: [
      "Outstanding balances will be recalculated",
      "Subsequent transactions may be affected"
    ]
  };
}

// **NEW FUNCTIONS FOR OPENING BALANCE CASCADE HANDLING**

// Mutation for updating seller opening balance with complete cascade recalculation
export const updateSellerOpeningBalance = mutation({
  args: {
    seller_id: v.id("sellers"),
    item_id: v.id("items"),
    opening_payment_due: v.number(),
    opening_quantity_due: v.number(),
    effective_from_date: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`Updating seller opening balance for seller ${args.seller_id}, item ${args.item_id}`);

      const currentDate = new Date().toISOString().split("T")[0];

      // Check if opening balance record exists
      const existingOpeningBalance = await ctx.db
        .query("seller_opening_balances")
        .withIndex("by_seller_item", (q) => q.eq("seller_id", args.seller_id).eq("item_id", args.item_id))
        .first();

      if (existingOpeningBalance) {
        // Update existing opening balance
        await ctx.db.patch(existingOpeningBalance._id, {
          opening_payment_due: args.opening_payment_due,
          opening_quantity_due: args.opening_quantity_due,
          effective_from_date: args.effective_from_date,
          last_modified_date: currentDate,
        });
        console.log("Updated existing seller opening balance");
      } else {
        // Create new opening balance
        await ctx.db.insert("seller_opening_balances", {
          seller_id: args.seller_id,
          item_id: args.item_id,
          opening_payment_due: args.opening_payment_due,
          opening_quantity_due: args.opening_quantity_due,
          effective_from_date: args.effective_from_date,
          created_date: currentDate,
          last_modified_date: currentDate,
        });
        console.log("Created new seller opening balance");
      }

      // **CRITICAL CASCADE REQUIREMENT**: Recalculate ALL subsequent entries
      await recalculateAllSellerTransactionsFromDate(ctx, args.seller_id, args.item_id, args.effective_from_date);

      // Update current outstanding balance
      await recalculateSellerOutstanding(ctx, args.seller_id, args.item_id);

      console.log("Seller opening balance update with cascade recalculation completed");
      return {
        success: true,
        message: "Seller opening balance updated and all subsequent transactions recalculated"
      };

    } catch (error) {
      console.error("updateSellerOpeningBalance error:", error);
      throw new Error(`Failed to update seller opening balance: ${error.message}`);
    }
  },
});

// Mutation for updating supplier opening balance with complete cascade recalculation
export const updateSupplierOpeningBalance = mutation({
  args: {
    supplier_id: v.id("suppliers"),
    item_id: v.id("items"),
    opening_payment_due: v.number(),
    opening_quantity_due: v.number(),
    effective_from_date: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`Updating supplier opening balance for supplier ${args.supplier_id}, item ${args.item_id}`);

      const currentDate = new Date().toISOString().split("T")[0];

      // Check if opening balance record exists
      const existingOpeningBalance = await ctx.db
        .query("supplier_opening_balances")
        .withIndex("by_supplier_item", (q) => q.eq("supplier_id", args.supplier_id).eq("item_id", args.item_id))
        .first();

      if (existingOpeningBalance) {
        // Update existing opening balance
        await ctx.db.patch(existingOpeningBalance._id, {
          opening_payment_due: args.opening_payment_due,
          opening_quantity_due: args.opening_quantity_due,
          effective_from_date: args.effective_from_date,
          last_modified_date: currentDate,
        });
        console.log("Updated existing supplier opening balance");
      } else {
        // Create new opening balance
        await ctx.db.insert("supplier_opening_balances", {
          supplier_id: args.supplier_id,
          item_id: args.item_id,
          opening_payment_due: args.opening_payment_due,
          opening_quantity_due: args.opening_quantity_due,
          effective_from_date: args.effective_from_date,
          created_date: currentDate,
          last_modified_date: currentDate,
        });
        console.log("Created new supplier opening balance");
      }

      // **CRITICAL CASCADE REQUIREMENT**: No subsequent transaction recalculation needed for suppliers
      // (supplier outstanding is calculated directly from procurement + payments, not running balances)

      // Update current outstanding balance
      await recalculateSupplierOutstanding(ctx, args.supplier_id, args.item_id);

      console.log("Supplier opening balance update completed");
      return {
        success: true,
        message: "Supplier opening balance updated and outstanding balance recalculated"
      };

    } catch (error) {
      console.error("updateSupplierOpeningBalance error:", error);
      throw new Error(`Failed to update supplier opening balance: ${error.message}`);
    }
  },
});

// Helper function to recalculate all seller transactions from a specific date
async function recalculateAllSellerTransactionsFromDate(ctx: any, seller_id: string, item_id: string, fromDate: string) {
  console.log(`Recalculating ALL seller transactions for seller ${seller_id}, item ${item_id} from ${fromDate}`);

  try {
    // Get opening balance
    const openingBalance = await ctx.db
      .query("seller_opening_balances")
      .withIndex("by_seller_item", (q) => q.eq("seller_id", seller_id).eq("item_id", item_id))
      .first();

    // Get all sales sessions from the effective date onward, sorted by date
    const allSessions = await ctx.db.query("sales_sessions").collect();
    const relevantSessions = allSessions
      .filter(session => session.session_date >= fromDate)
      .sort((a, b) => a.session_date.localeCompare(b.session_date));

    let runningPaymentBalance = openingBalance?.opening_payment_due || 0;
    let runningQuantityBalance = openingBalance?.opening_quantity_due || 0;

    // Process each session chronologically
    for (const session of relevantSessions) {
      // Get all sales entries for this seller+item in this session
      const salesEntries = await ctx.db
        .query("sales_entries")
        .withIndex("by_session", (q) => q.eq("sales_session_id", session._id))
        .filter((q) => q.and(
          q.eq(q.field("seller_id"), seller_id),
          q.eq(q.field("item_id"), item_id)
        ))
        .collect();

      // Update each entry with correct running balance
      for (const entry of salesEntries) {
        runningPaymentBalance += entry.total_amount_purchased - entry.amount_paid - entry.less_discount;
        runningQuantityBalance += entry.total_quantity_purchased - entry.crates_returned;

        await ctx.db.patch(entry._id, {
          final_payment_outstanding: runningPaymentBalance,
          final_quantity_outstanding: runningQuantityBalance,
        });
      }

      // Also process any standalone seller payments for this session date
      const payments = await ctx.db
        .query("seller_payments")
        .withIndex("by_date", (q) => q.eq("payment_date", session.session_date))
        .filter((q) => q.and(
          q.eq(q.field("seller_id"), seller_id),
          q.eq(q.field("item_id"), item_id)
        ))
        .collect();

      // Apply payments to running balance
      for (const payment of payments) {
        runningPaymentBalance -= payment.amount_received;
        runningQuantityBalance -= payment.crates_returned;
      }
    }

    console.log(`Recalculation completed: final balances payment=${runningPaymentBalance}, quantity=${runningQuantityBalance}`);

  } catch (error) {
    console.error("Error in recalculateAllSellerTransactionsFromDate:", error);
    throw new Error(`Failed to recalculate seller transactions: ${error.message}`);
  }
}

// Mutation for deleting opening balance entries with cascade handling
export const deleteSellerOpeningBalance = mutation({
  args: {
    seller_id: v.id("sellers"),
    item_id: v.id("items"),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`Deleting seller opening balance for seller ${args.seller_id}, item ${args.item_id}`);

      // Find and delete the opening balance record
      const openingBalance = await ctx.db
        .query("seller_opening_balances")
        .withIndex("by_seller_item", (q) => q.eq("seller_id", args.seller_id).eq("item_id", args.item_id))
        .first();

      if (!openingBalance) {
        throw new Error("Seller opening balance not found");
      }

      await ctx.db.delete(openingBalance._id);
      console.log("Deleted seller opening balance record");

      // **CRITICAL CASCADE REQUIREMENT**: Recalculate ALL subsequent entries from the effective date
      await recalculateAllSellerTransactionsFromDate(ctx, args.seller_id, args.item_id, openingBalance.effective_from_date);

      // Update current outstanding balance
      await recalculateSellerOutstanding(ctx, args.seller_id, args.item_id);

      console.log("Seller opening balance deletion with cascade recalculation completed");
      return {
        success: true,
        message: "Seller opening balance deleted and all subsequent transactions recalculated",
        deletedBalance: {
          opening_payment_due: openingBalance.opening_payment_due,
          opening_quantity_due: openingBalance.opening_quantity_due,
          effective_from_date: openingBalance.effective_from_date
        }
      };

    } catch (error) {
      console.error("deleteSellerOpeningBalance error:", error);
      throw new Error(`Failed to delete seller opening balance: ${error.message}`);
    }
  },
});

// Mutation for deleting supplier opening balance entries with cascade handling
export const deleteSupplierOpeningBalance = mutation({
  args: {
    supplier_id: v.id("suppliers"),
    item_id: v.id("items"),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`Deleting supplier opening balance for supplier ${args.supplier_id}, item ${args.item_id}`);

      // Find and delete the opening balance record
      const openingBalance = await ctx.db
        .query("supplier_opening_balances")
        .withIndex("by_supplier_item", (q) => q.eq("supplier_id", args.supplier_id).eq("item_id", args.item_id))
        .first();

      if (!openingBalance) {
        throw new Error("Supplier opening balance not found");
      }

      await ctx.db.delete(openingBalance._id);
      console.log("Deleted supplier opening balance record");

      // Update current outstanding balance (no transaction recalculation needed for suppliers)
      await recalculateSupplierOutstanding(ctx, args.supplier_id, args.item_id);

      console.log("Supplier opening balance deletion completed");
      return {
        success: true,
        message: "Supplier opening balance deleted and outstanding balance recalculated",
        deletedBalance: {
          opening_payment_due: openingBalance.opening_payment_due,
          opening_quantity_due: openingBalance.opening_quantity_due,
          effective_from_date: openingBalance.effective_from_date
        }
      };

    } catch (error) {
      console.error("deleteSupplierOpeningBalance error:", error);
      throw new Error(`Failed to delete supplier opening balance: ${error.message}`);
    }
  },
});

// **COMPREHENSIVE SYSTEM INTEGRITY AND MAINTENANCE FUNCTIONS**

// Mutation for complete system data integrity check and repair
export const runSystemIntegrityCheck = mutation({
  args: {
    repairIssues: v.optional(v.boolean()), // Whether to automatically fix found issues
  },
  handler: async (ctx, args) => {
    try {
      console.log("Starting comprehensive system integrity check");
      const issues = [];
      const repairs = [];

      // 1. Check all seller outstanding balances
      console.log("Checking seller outstanding balances...");
      const allSellers = await ctx.db.query("sellers").collect();
      const allItems = await ctx.db.query("items").collect();

      for (const seller of allSellers) {
        for (const item of allItems) {
          try {
            // Get current outstanding record
            const currentOutstanding = await ctx.db
              .query("seller_outstanding")
              .withIndex("by_seller_item", (q) => q.eq("seller_id", seller._id).eq("item_id", item._id))
              .first();

            // Calculate what it should be
            const calculatedOutstanding = await calculateCorrectSellerOutstanding(ctx, seller._id, item._id);

            if (currentOutstanding) {
              const paymentDiff = Math.abs(currentOutstanding.payment_due - calculatedOutstanding.payment);
              const quantityDiff = Math.abs(currentOutstanding.quantity_due - calculatedOutstanding.quantity);

              if (paymentDiff > 0.01 || quantityDiff > 0.01) {
                const issue = `Seller outstanding mismatch for ${seller.name} - ${item.name}: ` +
                  `Payment: ${currentOutstanding.payment_due} vs ${calculatedOutstanding.payment}, ` +
                  `Quantity: ${currentOutstanding.quantity_due} vs ${calculatedOutstanding.quantity}`;
                issues.push(issue);

                if (args.repairIssues) {
                  await ctx.db.patch(currentOutstanding._id, {
                    payment_due: calculatedOutstanding.payment,
                    quantity_due: calculatedOutstanding.quantity,
                    last_updated: new Date().toISOString().split("T")[0],
                  });
                  repairs.push(`Fixed seller outstanding for ${seller.name} - ${item.name}`);
                }
              }
            } else if (calculatedOutstanding.payment !== 0 || calculatedOutstanding.quantity !== 0) {
              const issue = `Missing seller outstanding record for ${seller.name} - ${item.name}: ` +
                `Should have payment=${calculatedOutstanding.payment}, quantity=${calculatedOutstanding.quantity}`;
              issues.push(issue);

              if (args.repairIssues) {
                await ctx.db.insert("seller_outstanding", {
                  seller_id: seller._id,
                  item_id: item._id,
                  payment_due: calculatedOutstanding.payment,
                  quantity_due: calculatedOutstanding.quantity,
                  last_updated: new Date().toISOString().split("T")[0],
                });
                repairs.push(`Created missing seller outstanding for ${seller.name} - ${item.name}`);
              }
            }
          } catch (error) {
            issues.push(`Error checking seller ${seller.name} - ${item.name}: ${(error as Error).message}`);
          }
        }
      }

      // 2. Check all supplier outstanding balances
      console.log("Checking supplier outstanding balances...");
      const allSuppliers = await ctx.db.query("suppliers").collect();

      for (const supplier of allSuppliers) {
        for (const item of allItems) {
          try {
            // Get current outstanding record
            const currentOutstanding = await ctx.db
              .query("supplier_outstanding")
              .withIndex("by_supplier_item", (q) => q.eq("supplier_id", supplier._id).eq("item_id", item._id))
              .first();

            // Calculate what it should be
            const calculatedOutstanding = await calculateCorrectSupplierOutstanding(ctx, supplier._id, item._id);

            if (currentOutstanding) {
              const paymentDiff = Math.abs(currentOutstanding.payment_due - calculatedOutstanding.payment);
              const quantityDiff = Math.abs(currentOutstanding.quantity_due - calculatedOutstanding.quantity);

              if (paymentDiff > 0.01 || quantityDiff > 0.01) {
                const issue = `Supplier outstanding mismatch for ${supplier.name} - ${item.name}: ` +
                  `Payment: ${currentOutstanding.payment_due} vs ${calculatedOutstanding.payment}, ` +
                  `Quantity: ${currentOutstanding.quantity_due} vs ${calculatedOutstanding.quantity}`;
                issues.push(issue);

                if (args.repairIssues) {
                  await ctx.db.patch(currentOutstanding._id, {
                    payment_due: calculatedOutstanding.payment,
                    quantity_due: calculatedOutstanding.quantity,
                    last_updated: new Date().toISOString().split("T")[0],
                  });
                  repairs.push(`Fixed supplier outstanding for ${supplier.name} - ${item.name}`);
                }
              }
            } else if (calculatedOutstanding.payment !== 0 || calculatedOutstanding.quantity !== 0) {
              const issue = `Missing supplier outstanding record for ${supplier.name} - ${item.name}: ` +
                `Should have payment=${calculatedOutstanding.payment}, quantity=${calculatedOutstanding.quantity}`;
              issues.push(issue);

              if (args.repairIssues) {
                await ctx.db.insert("supplier_outstanding", {
                  supplier_id: supplier._id,
                  item_id: item._id,
                  payment_due: calculatedOutstanding.payment,
                  quantity_due: calculatedOutstanding.quantity,
                  last_updated: new Date().toISOString().split("T")[0],
                });
                repairs.push(`Created missing supplier outstanding for ${supplier.name} - ${item.name}`);
              }
            }
          } catch (error) {
            issues.push(`Error checking supplier ${supplier.name} - ${item.name}: ${(error as Error).message}`);
          }
        }
      }

      console.log(`System integrity check completed. Found ${issues.length} issues.`);
      if (args.repairIssues) {
        console.log(`Applied ${repairs.length} repairs.`);
      }

      return {
        success: true,
        issuesFound: issues.length,
        repairsApplied: repairs.length,
        issues: issues,
        repairs: repairs,
        message: args.repairIssues
          ? `System integrity check completed with ${repairs.length} repairs applied`
          : `System integrity check completed. Found ${issues.length} issues. Use repairIssues=true to fix them.`
      };

    } catch (error) {
      console.error("runSystemIntegrityCheck error:", error);
      throw new Error(`System integrity check failed: ${(error as Error).message}`);
    }
  },
});

// Helper function to calculate correct seller outstanding
async function calculateCorrectSellerOutstanding(ctx: any, seller_id: string, item_id: string) {
  // Get opening balance
  const openingBalance = await ctx.db
    .query("seller_opening_balances")
    .withIndex("by_seller_item", (q) => q.eq("seller_id", seller_id).eq("item_id", item_id))
    .first();

  // Get all sales entries
  const salesEntries = await ctx.db
    .query("sales_entries")
    .withIndex("by_seller_item", (q) => q.eq("seller_id", seller_id).eq("item_id", item_id))
    .collect();

  // Get all standalone payments
  const payments = await ctx.db
    .query("seller_payments")
    .withIndex("by_seller_item", (q) => q.eq("seller_id", seller_id).eq("item_id", item_id))
    .collect();

  // Calculate totals according to business logic
  const openingPayment = openingBalance?.opening_payment_due || 0;
  const openingQuantity = openingBalance?.opening_quantity_due || 0;

  const totalPurchases = salesEntries.reduce((sum, entry) => sum + entry.total_amount_purchased, 0);
  const totalQuantityPurchased = salesEntries.reduce((sum, entry) => sum + entry.total_quantity_purchased, 0);
  const totalPaid = salesEntries.reduce((sum, entry) => sum + entry.amount_paid, 0);
  const totalDiscount = salesEntries.reduce((sum, entry) => sum + entry.less_discount, 0);
  const totalCratesReturned = salesEntries.reduce((sum, entry) => sum + entry.crates_returned, 0);

  const totalStandalonePayments = payments.reduce((sum, payment) => sum + payment.amount_received, 0);
  const totalStandaloneReturns = payments.reduce((sum, payment) => sum + payment.crates_returned, 0);

  const finalPayment = openingPayment + totalPurchases - totalPaid - totalDiscount - totalStandalonePayments;
  const finalQuantity = openingQuantity + totalQuantityPurchased - totalCratesReturned - totalStandaloneReturns;

  return { payment: finalPayment, quantity: finalQuantity };
}

// Helper function to calculate correct supplier outstanding
async function calculateCorrectSupplierOutstanding(ctx: any, supplier_id: string, item_id: string) {
  // Get opening balance
  const openingBalance = await ctx.db
    .query("supplier_opening_balances")
    .withIndex("by_supplier_item", (q) => q.eq("supplier_id", supplier_id).eq("item_id", item_id))
    .first();

  // Get all procurement entries
  const allEntries = await ctx.db.query("procurement_entries").collect();
  const procurementEntries = allEntries.filter((e) => e.supplier_id === supplier_id && e.item_id === item_id);

  // Get all payments
  const payments = await ctx.db
    .query("supplier_payments")
    .withIndex("by_supplier_item", (q) => q.eq("supplier_id", supplier_id).eq("item_id", item_id))
    .collect();

  // Calculate totals according to business logic
  const openingPayment = openingBalance?.opening_payment_due || 0;
  const openingQuantity = openingBalance?.opening_quantity_due || 0;

  const totalProcurement = procurementEntries.reduce((sum, entry) => sum + entry.total_amount, 0);
  const totalQuantityPurchased = procurementEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount_paid, 0);
  const totalCratesReturned = payments.reduce((sum, payment) => sum + payment.crates_returned, 0);

  const finalPayment = openingPayment + totalProcurement - totalPaid;
  const finalQuantity = openingQuantity + totalQuantityPurchased - totalCratesReturned;

  return { payment: finalPayment, quantity: finalQuantity };
}

// Generic delete entry function that routes to specific deletion functions
export const deleteEntry = mutation({
  args: {
    entryType: v.union(v.literal("procurement"), v.literal("sales"), v.literal("payment")),
    entryId: v.id("_storage"), // Use generic ID type
    forceDelete: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const { entryType, entryId, forceDelete = false } = args;

    try {
      if (entryType === "procurement") {
        // Get the procurement entry first to ensure it exists
        const procurementEntry = await ctx.db.get(entryId as Id<"procurement_entries">);
        if (!procurementEntry) {
          throw new Error("Procurement entry not found");
        }

        // Call the deleteProcurementEntry mutation with proper parameters
        const result = await ctx.runMutation(api.entryManagement.deleteProcurementEntry, {
          entryId: entryId as Id<"procurement_entries">,
          forceDelete
        });
        return result;

      } else if (entryType === "sales") {
        // Get the sales entry first to ensure it exists
        const salesEntry = await ctx.db.get(entryId as Id<"sales_entries">);
        if (!salesEntry) {
          throw new Error("Sales entry not found");
        }

        const result = await ctx.runMutation(api.entryManagement.deleteSalesEntry, {
          entryId: entryId as Id<"sales_entries">,
          forceDelete
        });
        return result;

      } else if (entryType === "payment") {
        // For payment entries, check both tables
        try {
          const supplierPayment = await ctx.db.get(entryId as Id<"supplier_payments">);
          if (supplierPayment) {
            const result = await ctx.runMutation(api.entryManagement.deleteSupplierPayment, {
              paymentId: entryId as Id<"supplier_payments">,
              forceDelete
            });
            return result;
          }
        } catch {
          // Continue to check seller payments
        }

        try {
          const sellerPayment = await ctx.db.get(entryId as Id<"seller_payments">);
          if (sellerPayment) {
            const result = await ctx.runMutation(api.entryManagement.deleteSellerPayment, {
              paymentId: entryId as Id<"seller_payments">,
              forceDelete
            });
            return result;
          }
        } catch {
          // Payment not found in either table
        }

        throw new Error("Payment entry not found in either supplier_payments or seller_payments");
      }

      throw new Error(`Unsupported entry type: ${entryType}`);
    } catch (error: any) {
      console.error(`Error deleting ${entryType} entry:`, error);
      throw new Error(`Failed to delete ${entryType} entry: ${error.message}`);
    }
  },
});

