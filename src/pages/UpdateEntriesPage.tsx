import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { Search, Edit, AlertTriangle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/DatePicker";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/hooks/use-toast";
import { formatDateForIndia } from "@/lib/utils";
import { api } from "../../convex/_generated/api";

type EntryType = "procurement" | "seller" | "supplier_settlement";

interface SearchFilters {
  entryType: EntryType;
  startDate: Date | undefined;
  endDate: Date | undefined;
  supplierId: string;
  sellerId: string;
  itemId: string;
}

export function UpdateEntriesPage() {
  const [filters, setFilters] = useState<SearchFilters>({
    entryType: "procurement",
    startDate: undefined,
    endDate: undefined,
    supplierId: "all",
    sellerId: "all",
    itemId: "all",
  });

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isSearching] = useState(false);
  const { toast } = useToast();

  // Debug query for line items - temporarily disabled
  // const debugResult = null;

  // Convex queries for real data with error handling
  const suppliersQuery = useQuery(api.masterData.getSuppliers, { active_only: true });
  const sellersQuery = useQuery(api.masterData.getSellers, { active_only: true });
  const itemsQuery = useQuery(api.masterData.getItems, { active_only: true });

  const suppliers = Array.isArray(suppliersQuery) ? suppliersQuery : [];
  const sellers = Array.isArray(sellersQuery) ? sellersQuery : [];
  const items = Array.isArray(itemsQuery) ? itemsQuery : [];

  // Search query parameters for reactive queries
  const [searchParams, setSearchParams] = useState<any>(null);

  // Reactive queries that update automatically when searchParams change
  const procurementResults = useQuery(
    api.entryManagement.searchProcurementEntries,
    searchParams && filters.entryType === "procurement" && searchParams.startDate && searchParams.endDate ? {
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      ...(searchParams.supplierId && { supplierId: searchParams.supplierId }),
      ...(searchParams.itemId && { itemId: searchParams.itemId }),
    } : "skip"
  );

  const salesResults = useQuery(
    api.entryManagement.searchSalesEntries,
    searchParams && filters.entryType === "seller" && searchParams.startDate && searchParams.endDate ? {
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      ...(searchParams.sellerId && { sellerId: searchParams.sellerId }),
      ...(searchParams.itemId && { itemId: searchParams.itemId }),
    } : "skip"
  );

  const paymentResults = useQuery(
    api.entryManagement.searchSupplierSettlementEntries,
    searchParams && filters.entryType === "supplier_settlement" && searchParams.startDate && searchParams.endDate ? {
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      ...(searchParams.itemId && { itemId: searchParams.itemId }),
    } : "skip"
  );

  // Mutations for updating entries
  const updateProcurementEntry = useMutation(api.entryManagement.updateProcurementEntry);
  const updateSalesEntry = useMutation(api.entryManagement.updateSalesEntry);
  const updateSupplierPayment = useMutation(api.entryManagement.updateSupplierPayment);

  // Get available stock for the entry being edited (same as SalesEntryPage)
  const availableStock = useQuery(
    api.sales.getAvailableStock,
    editFormData && filters.entryType === "seller" && editFormData.item_id && editFormData.session_date
      ? {
          item_id: editFormData.item_id,
          date: editFormData.session_date,
        }
      : "skip"
  );

  // Calculate remaining stock for editing - use direct stock values
  const calculateRemainingStock = () => {
    if (!availableStock) return {};

    const stockMap: { [typeName: string]: number } = {};

    // Just use the stock values directly
    availableStock.forEach((stock: any) => {
      stockMap[stock.type_name] = stock.closing_stock;
    });

    return stockMap;
  };

  // Get available types for dropdown (copied from SalesEntryPage)
  const getAvailableTypes = () => {
    if (!availableStock) return [];
    const remainingStock = calculateRemainingStock();

    return availableStock.map((stock: any) => ({
      ...stock,
      remaining_stock: remainingStock[stock.type_name] || 0
    }));
  };

  // Show warning when stock runs out
  const showStockWarning = (typeName: string) => {
    toast({
      title: "⚠️ Stock Warning",
      description: `No stock remaining for ${typeName}`,
      variant: "destructive",
      duration: 3000,
    });
  };

  // Update search results when query results change
  useEffect(() => {
    console.log('UpdateEntriesPage: Query results changed', {
      entryType: filters.entryType,
      searchParams,
      procurementResults: procurementResults ? procurementResults.length : procurementResults,
      salesResults: salesResults ? salesResults.length : salesResults,
      paymentResults: paymentResults ? paymentResults.length : paymentResults
    });

    try {
      setQueryError(null);

      let results;
      if (filters.entryType === "procurement") {
        results = procurementResults;
      } else if (filters.entryType === "seller") {
        results = salesResults;
      } else {
        results = paymentResults;
      }

      if (Array.isArray(results)) {
        console.log('UpdateEntriesPage: Setting results', results.length, 'entries');
        setSearchResults(results);
      } else if (results === undefined) {
        console.log('UpdateEntriesPage: Results undefined (loading)');
        setSearchResults([]);
      } else if (results === null) {
        console.log('UpdateEntriesPage: Results null (no data)');
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error in search results useEffect:", error);
      setQueryError(error instanceof Error ? error.message : "Unknown error occurred");
      setSearchResults([]);
    }
  }, [procurementResults, salesResults, paymentResults, filters.entryType]);

  const handleSearch = useCallback(async () => {
    try {
      console.log('UpdateEntriesPage: handleSearch called', filters);

      if (!filters.startDate || !filters.endDate) {
        alert("Please select both start and end dates");
        return;
      }

      const startDateStr = format(filters.startDate, "yyyy-MM-dd");
      const endDateStr = format(filters.endDate, "yyyy-MM-dd");

    // Set search parameters to trigger the reactive queries
    if (filters.entryType === "procurement") {
      const params = {
        startDate: startDateStr,
        endDate: endDateStr,
        supplierId: filters.supplierId !== "all" ? filters.supplierId : null,
        itemId: filters.itemId !== "all" ? filters.itemId : null,
      };
      console.log('UpdateEntriesPage: Setting procurement search params', params);
      setSearchParams(params);
    } else if (filters.entryType === "seller") {
      const params = {
        startDate: startDateStr,
        endDate: endDateStr,
        sellerId: filters.sellerId !== "all" ? filters.sellerId : null,
        itemId: filters.itemId !== "all" ? filters.itemId : null,
      };
      console.log('UpdateEntriesPage: Setting seller search params', params);
      setSearchParams(params);
    } else if (filters.entryType === "supplier_settlement") {
      const params = {
        startDate: startDateStr,
        endDate: endDateStr,
        itemId: filters.itemId !== "all" ? filters.itemId : null,
      };
      console.log('UpdateEntriesPage: Setting payment search params', params);
      setSearchParams(params);
    }
    } catch (error) {
      console.error("Error in handleSearch:", error);
      alert("Error performing search. Please try again.");
    }
  }, [filters.startDate, filters.endDate, filters.entryType, filters.supplierId, filters.sellerId, filters.itemId]);

  // Auto-search functionality (like DeleteEntriesPage)
  useEffect(() => {
    // Only auto-search if we've already performed a search and have valid dates
    if (searchParams && filters.startDate && filters.endDate) {
      console.log('Auto-search triggered by filter change');

      // Use a small delay to avoid rapid successive calls
      const timeoutId = setTimeout(() => {
        handleSearch();
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [filters.startDate, filters.endDate, filters.supplierId, filters.sellerId, filters.itemId, filters.entryType, handleSearch]);

  const handleEdit = (entry: any) => {
    try {
      console.log("Editing entry:", entry);
      if (entry.line_items) {
        console.log("Line items found:", entry.line_items.length);
      }

      // Always set fresh data from database
      setEditingEntry(entry);
      setEditFormData(JSON.parse(JSON.stringify(entry))); // Deep copy to avoid references
      setIsEditModalOpen(true);
    } catch (error) {
      console.error("Error in handleEdit:", error);
      alert("Error opening edit modal. Please try again.");
    }
  };


  const handleSaveChanges = async () => {
    console.log("🚀 handleSaveChanges called");
    console.log("EditingEntry:", editingEntry);
    console.log("EditFormData:", editFormData);

    if (!editingEntry) {
      console.log("❌ No editing entry found");
      return;
    }

    try {
      if (filters.entryType === "procurement") {
        console.log("📦 Updating procurement entry...");
        const result = await updateProcurementEntry({
          entryId: editingEntry._id,
          quantity: editFormData.quantity,
          rate: editFormData.rate,
          type_name: editFormData.type_name,
        });
        console.log("✅ Procurement update result:", result);
      } else if (filters.entryType === "seller") {
        console.log("🛒 Updating sales entry...");
        console.log("Raw line items:", editFormData.line_items);

        // Clean line items - only send required fields
        const cleanLineItems = editFormData.line_items?.map((item: any) => ({
          type_name: item.type_name,
          quantity: item.quantity,
          sale_rate: item.sale_rate,
          amount: item.amount,
        }));

        console.log("Clean line items being sent:", cleanLineItems);

        const result = await updateSalesEntry({
          entryId: editingEntry._id,
          amount_paid: editFormData.amount_paid,
          less_discount: editFormData.less_discount,
          crates_returned: editFormData.crates_returned,
          line_items: cleanLineItems,
        });
        console.log("✅ Sales update result:", result);
      } else if (filters.entryType === "supplier_settlement") {
        console.log("💰 Updating supplier payment...");
        const result = await updateSupplierPayment({
          entryId: editingEntry._id,
          amount_paid: editFormData.amount_paid,
          crates_returned: editFormData.crates_returned,
        });
        console.log("✅ Supplier payment update result:", result);
      }

      console.log("🎉 Update completed successfully");
      
      // Show success toast
      toast({
        title: "✅ Success",
        description: "Entry updated successfully",
        variant: "default",
        duration: 2000,
      });

      // Close modal and reset editing state
      setIsEditModalOpen(false);
      setEditingEntry(null);
      setEditFormData({});
      
      // Trigger automatic re-search to refresh the list with updated data
      handleSearch();
    } catch (error) {
      console.error("❌ Error updating entry:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      alert(`Error updating entry: ${errorMessage}. Please try again.`);
    }
  };

  const renderSearchFilters = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Filter className="w-5 h-5 mr-2" />
          Search & Filter Entries
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Entry Type Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Entry Type</Label>
            <Select
              value={filters.entryType}
              onValueChange={(value: EntryType) => {
                setFilters(prev => ({ ...prev, entryType: value }));
                setSearchResults([]); // Clear search results when entry type changes
                // Don't clear searchParams - let auto-search handle the new search
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select entry type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="procurement">Procurement Entries</SelectItem>
                <SelectItem value="seller">Seller Entries</SelectItem>
                <SelectItem value="supplier_settlement">Supplier Settlement Entries</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label>Start Date</Label>
            <DatePicker
              date={filters.startDate}
              setDate={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
              placeholder="Select start date"
            />
          </div>

          <div className="space-y-2">
            <Label>End Date</Label>
            <DatePicker
              date={filters.endDate}
              setDate={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
              placeholder="Select end date"
            />
          </div>
        </div>

        {/* Additional Filters based on Entry Type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filters.entryType === "procurement" && (
            <>
              <div className="space-y-2">
                <Label>Supplier (Optional)</Label>
                <Select value={filters.supplierId} onValueChange={(value) => setFilters(prev => ({ ...prev, supplierId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {suppliers?.map((supplier) => (
                      <SelectItem key={supplier._id} value={supplier._id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {filters.entryType === "seller" && (
            <div className="space-y-2">
              <Label>Seller (Optional)</Label>
              <Select value={filters.sellerId} onValueChange={(value) => setFilters(prev => ({ ...prev, sellerId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All sellers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sellers</SelectItem>
                  {sellers?.map((seller) => (
                    <SelectItem key={seller._id} value={seller._id}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Item (Optional)</Label>
            <Select value={filters.itemId} onValueChange={(value) => setFilters(prev => ({ ...prev, itemId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All items" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                {items?.map((item) => (
                  <SelectItem key={item._id} value={item._id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={handleSearch} className="w-full" disabled={isSearching}>
              <Search className="w-4 h-4 mr-2" />
              {isSearching ? "Searching..." : "Search Entries"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderResultsTable = () => {
    if (queryError) {
      return (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-8">
            <div className="text-center text-red-700">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
              <p className="font-medium mb-2">Error Loading Data</p>
              <p className="text-sm mb-4">{queryError}</p>
              <Button
                variant="outline"
                onClick={() => {
                  setQueryError(null);
                  setSearchParams(null);
                }}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (searchResults.length === 0) {
      return (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No entries found. Try adjusting your search criteria.</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Search Results ({searchResults.length} entries)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                {filters.entryType === "procurement" && (
                  <>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Amount</TableHead>
                  </>
                )}
                {filters.entryType === "seller" && (
                  <>
                    <TableHead>Seller</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead>Outstanding</TableHead>
                  </>
                )}
                {filters.entryType === "supplier_settlement" && (
                  <>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead>Crates Returned</TableHead>
                  </>
                )}
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchResults.map((entry) => (
                <TableRow key={entry._id}>
                  <TableCell>
                    {formatDateForIndia(
                      entry.session_date || entry.payment_date || entry.date
                    ) || "N/A"}
                  </TableCell>
                  {filters.entryType === "procurement" && (
                    <>
                      <TableCell>{entry.supplier_name}</TableCell>
                      <TableCell>{entry.item_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.type_name}</Badge>
                      </TableCell>
                      <TableCell>{entry.quantity}</TableCell>
                      <TableCell>₹{entry.rate}</TableCell>
                      <TableCell>₹{entry.total_amount.toLocaleString()}</TableCell>
                    </>
                  )}
                  {filters.entryType === "seller" && (
                    <>
                      <TableCell>{entry.seller_name}</TableCell>
                      <TableCell>{entry.item_name}</TableCell>
                      <TableCell>₹{entry.total_amount_purchased.toLocaleString()}</TableCell>
                      <TableCell>₹{entry.amount_paid.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={entry.final_payment_outstanding > 0 ? "destructive" : "default"}>
                          ₹{entry.final_payment_outstanding.toLocaleString()}
                        </Badge>
                      </TableCell>
                    </>
                  )}
                  {filters.entryType === "supplier_settlement" && (
                    <>
                      <TableCell>{entry.supplier_name}</TableCell>
                      <TableCell>{entry.item_name}</TableCell>
                      <TableCell>₹{entry.amount.toLocaleString()}</TableCell>
                      <TableCell>{entry.crates_returned || 0}</TableCell>
                    </>
                  )}
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => handleEdit(entry)}>
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  const renderEditModal = () => (
    <Dialog open={isEditModalOpen} onOpenChange={(open) => {
      if (!open) {
        // Reset form data when closing
        setEditFormData({});
        setEditingEntry(null);
      }
      setIsEditModalOpen(open);
    }}>
      <DialogContent className="!max-w-[95vw] !w-[95vw] max-h-[90vh] overflow-y-auto sm:!max-w-7xl sm:!w-auto">
        <DialogHeader>
          <DialogTitle>Edit {filters.entryType.charAt(0).toUpperCase() + filters.entryType.slice(1)} Entry</DialogTitle>
        </DialogHeader>

        <div className="w-full">
          {/* Edit Form */}
          <div className="space-y-4">
            <h3 className="font-semibold">Entry Details</h3>

            {filters.entryType === "procurement" && editFormData && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={editFormData.quantity || ""}
                    onChange={(e) => setEditFormData((prev: any) => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate (₹)</Label>
                  <Input
                    type="number"
                    value={editFormData.rate || ""}
                    onChange={(e) => setEditFormData((prev: any) => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total Amount</Label>
                  <Input
                    type="number"
                    value={(editFormData.quantity || 0) * (editFormData.rate || 0)}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
            )}

            {filters.entryType === "seller" && editFormData && (
              <>
                {/* Seller and Item Info */}
                <div className="space-y-2 p-3 bg-gray-50 rounded">
                  <div className="text-sm"><strong>Seller:</strong> {editFormData?.seller_name || "N/A"}</div>
                  <div className="text-sm"><strong>Item:</strong> {editFormData?.item_name || "N/A"}</div>
                  <div className="text-sm"><strong>Date:</strong> {formatDateForIndia(editFormData?.session_date) || "N/A"}</div>
                </div>


                {/* Purchase Breakdown - Line Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium text-lg">Purchase Details</Label>
                    <div className="text-xs text-gray-600">
                      {editFormData?.line_items ? `${editFormData.line_items.length} item(s)` : 'No items'}
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-sm text-center w-2/5">Type</TableHead>
                          <TableHead className="text-sm text-center w-1/6">Qty</TableHead>
                          <TableHead className="text-sm text-center w-1/6">Rate (₹)</TableHead>
                          <TableHead className="text-sm text-center w-1/5">Amount (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editFormData?.line_items && editFormData.line_items.length > 0 ? (
                          editFormData.line_items.map((item: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium w-2/5">
                                <Select
                                  value={item.type_name}
                                  onValueChange={(value) => {
                                    const newLineItems = [...editFormData.line_items];
                                    newLineItems[index].type_name = value;

                                    // Update stock info and procurement rate from available stock
                                    if (availableStock) {
                                      const stockInfo = availableStock.find((stock: any) => stock.type_name === value);
                                      if (stockInfo) {
                                        newLineItems[index].available_stock = stockInfo.closing_stock;
                                        newLineItems[index].procurement_rate = stockInfo.weighted_avg_purchase_rate;
                                      }
                                    }

                                    setEditFormData((prev: any) => ({ ...prev, line_items: newLineItems }));
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getAvailableTypes().map((stock: any) => (
                                      <SelectItem key={stock.type_name} value={stock.type_name}>
                                        {stock.type_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="w-1/6">
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const newQuantity = parseFloat(e.target.value) || 0;

                                    // Simple validation: if new quantity > closing stock, show warning
                                    if (item.type_name && availableStock) {
                                      const stockInfo = availableStock.find((stock: any) => stock.type_name === item.type_name);
                                      if (stockInfo && newQuantity > stockInfo.closing_stock) {
                                        showStockWarning(item.type_name);
                                        return;
                                      }
                                    }

                                    const newLineItems = [...editFormData.line_items];
                                    newLineItems[index].quantity = newQuantity;
                                    newLineItems[index].amount = newQuantity * newLineItems[index].sale_rate;
                                    setEditFormData((prev: any) => ({ ...prev, line_items: newLineItems }));
                                  }}
                                  className="w-full"
                                />
                              </TableCell>
                              <TableCell className="w-1/6">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.sale_rate}
                                  onChange={(e) => {
                                    const newRate = parseFloat(e.target.value) || 0;
                                    const newLineItems = [...editFormData.line_items];
                                    newLineItems[index].sale_rate = newRate;
                                    newLineItems[index].amount = newLineItems[index].quantity * newRate;
                                    setEditFormData((prev: any) => ({ ...prev, line_items: newLineItems }));
                                  }}
                                  className="w-full"
                                />
                              </TableCell>
                              <TableCell className="font-medium w-1/5 text-right">
                                ₹{(item.quantity * item.sale_rate).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-gray-500">
                              Loading line items... Please try refreshing the search
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Current Totals */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total Amount</Label>
                    <Input
                      type="number"
                      value={editFormData?.line_items ?
                        editFormData.line_items.reduce((sum: number, item: any) => sum + (item.quantity * item.sale_rate), 0) :
                        editFormData?.total_amount_purchased || "0"
                      }
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Quantity</Label>
                    <Input
                      type="number"
                      value={editFormData?.line_items ?
                        editFormData.line_items.reduce((sum: number, item: any) => sum + item.quantity, 0) :
                        editFormData?.total_quantity_purchased || "0"
                      }
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                </div>

                {/* Editable Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Amount Paid (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editFormData?.amount_paid || "0"}
                      onChange={(e) => setEditFormData((prev: any) => ({ ...prev, amount_paid: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Less Discount (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editFormData?.less_discount || "0"}
                      onChange={(e) => setEditFormData((prev: any) => ({ ...prev, less_discount: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Crates Returned</Label>
                    <Input
                      type="number"
                      value={editFormData?.crates_returned || "0"}
                      onChange={(e) => setEditFormData((prev: any) => ({ ...prev, crates_returned: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                {/* Outstanding Balance */}
                <div className="space-y-2">
                  <Label>Outstanding Balance</Label>
                  <Input
                    type="number"
                    value={editFormData?.final_payment_outstanding || "0"}
                    disabled
                    className="bg-red-50 font-medium"
                  />
                </div>
              </>
            )}

            {filters.entryType === "supplier_settlement" && editFormData && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Amount Paid (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editFormData.amount_paid || ""}
                    onChange={(e) => setEditFormData((prev: any) => ({ ...prev, amount_paid: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Crates Returned</Label>
                  <Input
                    type="number"
                    value={editFormData.crates_returned || ""}
                    onChange={(e) => setEditFormData((prev: any) => ({ ...prev, crates_returned: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input
                    type="text"
                    value={editFormData.payment_date || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => {
                  console.log("🔥 Save Changes button clicked!");
                  alert("Button clicked - check console!");
                  handleSaveChanges();
                }}
                className="flex-1"
              >
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Update Entries</h1>
          <p className="text-muted-foreground mt-1">
            Modify procurement, sales, and payment entries with impact analysis
          </p>
        </div>

        {/* Search & Filter Section */}
        {renderSearchFilters()}

        {/* Results Table */}
        {renderResultsTable()}

        {/* Edit Modal */}
        {renderEditModal()}
      </div>
    </ErrorBoundary>
  );
}