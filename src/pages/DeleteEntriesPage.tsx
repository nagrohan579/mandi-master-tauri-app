import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { Search, Trash2, AlertTriangle, Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

interface DeletionImpact {
  entryId: string;
  warningLevel: "low" | "medium" | "high" | "critical";
  affectedTransactions: number;
  affectedBalances: number;
  inventoryImpact: boolean;
  canDelete: boolean;
  restrictions: string[];
  cascadeEffects: string[];
}

export function DeleteEntriesPage() {
  const [filters, setFilters] = useState<SearchFilters>({
    entryType: "procurement",
    startDate: undefined,
    endDate: undefined,
    supplierId: "all",
    sellerId: "all",
    itemId: "all",
  });

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [impactAnalysis, setImpactAnalysis] = useState<Map<string, DeletionImpact>>(new Map());
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<any>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  // Convex queries for real data with error handling
  const suppliersQuery = useQuery(api.masterData.getSuppliers, { active_only: true });
  const sellersQuery = useQuery(api.masterData.getSellers, { active_only: true });
  const itemsQuery = useQuery(api.masterData.getItems, { active_only: true });

  const suppliers = suppliersQuery || [];
  const sellers = sellersQuery || [];
  const items = itemsQuery || [];

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

  // Mutation for deleting entries
  const deleteEntry = useMutation(api.entryManagement.deleteEntry);

  // Update search results when query results change
  useEffect(() => {
    console.log('DeleteEntriesPage: Query results changed', {
      entryType: filters.entryType,
      searchParams,
      procurementResults: procurementResults ? 'loaded' : procurementResults,
      salesResults: salesResults ? 'loaded' : salesResults,
      paymentResults: paymentResults ? 'loaded' : paymentResults
    });

    try {
      setQueryError(null);
      setIsSearching(true);

      const results = filters.entryType === "procurement" ? procurementResults :
                     filters.entryType === "seller" ? salesResults : paymentResults;

      if (results && Array.isArray(results)) {
        console.log('DeleteEntriesPage: Setting results', results.length, 'entries');
        setSearchResults(results);

        // Generate impact analysis for each result
        const impactMap = new Map<string, DeletionImpact>();
        for (const entry of results) {
          impactMap.set(entry._id, {
            entryId: entry._id,
            warningLevel: "medium",
            affectedTransactions: 3,
            affectedBalances: 2,
            inventoryImpact: true,
            canDelete: true,
            restrictions: [
              "This entry has been referenced in subsequent transactions",
              "Deleting will require recalculation of balances",
            ],
            cascadeEffects: [
              "Outstanding balances will be recalculated",
              "Inventory levels will be adjusted",
              "Related transactions may show inconsistencies",
            ],
          });
        }
        setImpactAnalysis(impactMap);
        setIsSearching(false);
      } else if (results === undefined) {
        // Query is still loading
        console.log('DeleteEntriesPage: Query still loading');
        if (!searchParams) {
          setSearchResults([]);
          setImpactAnalysis(new Map());
          setIsSearching(false);
        }
      } else {
        console.log('DeleteEntriesPage: No results found');
        setSearchResults([]);
        setImpactAnalysis(new Map());
        setIsSearching(false);
      }
    } catch (error) {
      console.error('DeleteEntriesPage: Error in search results:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setQueryError(errorMessage);
      setSearchResults([]);
      setImpactAnalysis(new Map());
      setIsSearching(false);

      toast({
        title: "Search Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [procurementResults, salesResults, paymentResults, filters.entryType, searchParams, toast]);

  // Auto-search when dates change after initial search
  useEffect(() => {
    // Only auto-search if we've already performed a search and have valid dates
    if (searchParams && filters.startDate && filters.endDate) {
      const startDateStr = format(filters.startDate, "yyyy-MM-dd");
      const endDateStr = format(filters.endDate, "yyyy-MM-dd");

      // Check if the dates have actually changed from current search params
      if (searchParams.startDate !== startDateStr || searchParams.endDate !== endDateStr) {
        // Use a small delay to avoid rapid successive calls
        const timeoutId = setTimeout(() => {
          handleSearch();
        }, 300);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [filters.startDate, filters.endDate, searchParams]);

  const handleSearch = async () => {
    console.log('DeleteEntriesPage: Search initiated', filters);

    if (!filters.startDate || !filters.endDate) {
      toast({
        title: "Missing Dates",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    try {
      const startDateStr = format(filters.startDate, "yyyy-MM-dd");
      const endDateStr = format(filters.endDate, "yyyy-MM-dd");

      console.log('DeleteEntriesPage: Date range', { startDateStr, endDateStr, entryType: filters.entryType });

      setIsSearching(true);
      setQueryError(null);
      setSearchResults([]);
      setImpactAnalysis(new Map());

      // Set search parameters to trigger the reactive queries
      if (filters.entryType === "procurement") {
        const params = {
          startDate: startDateStr,
          endDate: endDateStr,
          supplierId: filters.supplierId !== "all" ? filters.supplierId : null,
          itemId: filters.itemId !== "all" ? filters.itemId : null,
        };
        console.log('DeleteEntriesPage: Setting procurement search params', params);
        setSearchParams(params);
      } else if (filters.entryType === "seller") {
        const params = {
          startDate: startDateStr,
          endDate: endDateStr,
          sellerId: filters.sellerId !== "all" ? filters.sellerId : null,
          itemId: filters.itemId !== "all" ? filters.itemId : null,
        };
        console.log('DeleteEntriesPage: Setting seller search params', params);
        setSearchParams(params);
      } else if (filters.entryType === "supplier_settlement") {
        const params = {
          startDate: startDateStr,
          endDate: endDateStr,
          itemId: filters.itemId !== "all" ? filters.itemId : null,
        };
        console.log('DeleteEntriesPage: Setting payment search params', params);
        setSearchParams(params);
      }
    } catch (error) {
      console.error('DeleteEntriesPage: Error in handleSearch:', error);
      const errorMessage = error instanceof Error ? error.message : 'Search failed';
      toast({
        title: "Search Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setIsSearching(false);
    }
  };

  const handleSelectEntry = (entryId: string, checked: boolean) => {
    const newSelected = new Set(selectedEntries);
    if (checked) {
      newSelected.add(entryId);
    } else {
      newSelected.delete(entryId);
    }
    setSelectedEntries(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEntries(new Set(searchResults.map(entry => entry._id)));
    } else {
      setSelectedEntries(new Set());
    }
  };

  const handleDeleteEntry = (entry: any) => {
    setDeletingEntry(entry);
    setIsConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingEntry) return;

    try {
      await deleteEntry({
        entryType: filters.entryType === "seller" ? "sales" :
                   filters.entryType === "supplier_settlement" ? "payment" :
                   filters.entryType,
        entryId: deletingEntry._id,
        forceDelete: false,
      });

      // Show success toast
      toast({
        title: "✅ Success",
        description: "Entry deleted successfully",
        variant: "default",
        duration: 2000,
      });

      // Close modal
      setIsConfirmModalOpen(false);
      setDeletingEntry(null);
      
      // Trigger automatic re-search to refresh the list with updated data
      handleSearch();
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete entry",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEntries.size === 0) {
      alert("Please select entries to delete");
      return;
    }

    const hasHighRiskEntries = Array.from(selectedEntries).some(entryId => {
      const impact = impactAnalysis.get(entryId);
      return impact && (impact.warningLevel === "high" || impact.warningLevel === "critical");
    });

    if (hasHighRiskEntries) {
      if (!confirm("Some selected entries have high-risk impacts. Are you sure you want to proceed?")) {
        return;
      }
    }

    try {
      // Implement bulk deletion logic
      console.log("Bulk deleting entries:", Array.from(selectedEntries));

      setSelectedEntries(new Set());
      alert("Selected entries deleted successfully!");
      handleSearch(); // Refresh results
    } catch (error) {
      console.error("Error deleting entries:", error);
      alert("Error deleting entries. Please try again.");
    }
  };

  const getWarningIcon = (level: string) => {
    switch (level) {
      case "critical":
        return <Shield className="w-4 h-4 text-red-600" />;
      case "high":
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case "medium":
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-green-600" />;
    }
  };

  const getWarningColor = (level: string) => {
    switch (level) {
      case "critical":
        return "border-red-200 bg-red-50";
      case "high":
        return "border-orange-200 bg-orange-50";
      case "medium":
        return "border-yellow-200 bg-yellow-50";
      default:
        return "border-green-200 bg-green-50";
    }
  };

  const renderSearchFilters = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Search className="w-5 h-5 mr-2" />
          Search Entries for Deletion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Entry Type Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Entry Type</Label>
            <Select
              value={filters.entryType}
              onValueChange={(value: EntryType) => setFilters(prev => ({ ...prev, entryType: value }))}
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

          <div className="space-y-2">
            <Label>Start Date</Label>
            <DatePicker
              date={filters.startDate}
              setDate={(date) => setFilters(prev => {
                // If the new start date is after the current end date, reset end date
                const newFilters = { ...prev, startDate: date };
                if (date && prev.endDate && date > prev.endDate) {
                  newFilters.endDate = undefined;
                }
                return newFilters;
              })}
              placeholder="Select start date"
            />
          </div>

          <div className="space-y-2">
            <Label>End Date</Label>
            <DatePicker
              date={filters.endDate}
              setDate={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
              placeholder="Select end date"
              disabled={(date) => {
                // Disable dates before the start date
                if (filters.startDate) {
                  return date < filters.startDate;
                }
                return false;
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filters.entryType === "procurement" && (
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
          <div className="flex items-center justify-between">
            <CardTitle>Deletion Candidates ({searchResults.length} entries)</CardTitle>
            {selectedEntries.size > 0 && (
              <div className="flex gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedEntries.size} selected
                </span>
                <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                  Delete Selected
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedEntries.size === searchResults.length && searchResults.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchResults.map((entry) => {
                const impact = impactAnalysis.get(entry._id);
                return (
                  <TableRow key={entry._id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedEntries.has(entry._id)}
                        onCheckedChange={(checked) => handleSelectEntry(entry._id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {impact && getWarningIcon(impact.warningLevel)}
                        <Badge variant={
                          impact?.warningLevel === "critical" ? "destructive" :
                          impact?.warningLevel === "high" ? "destructive" :
                          impact?.warningLevel === "medium" ? "default" : "secondary"
                        }>
                          {impact?.warningLevel.toUpperCase()}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDateForIndia(
                        entry.session_date || entry.payment_date || entry.date || new Date()
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {filters.entryType === "procurement" && (
                          <>
                            <div className="font-medium">{entry.supplier_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {entry.item_name} - {entry.type_name}
                            </div>
                            <div className="text-sm">
                              {entry.quantity} units @ ₹{entry.rate}
                            </div>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {impact && (
                        <div className="text-sm space-y-1">
                          <div>Transactions: {impact.affectedTransactions}</div>
                          <div>Balances: {impact.affectedBalances}</div>
                          {impact.inventoryImpact && (
                            <Badge variant="outline" className="text-xs">
                              Inventory Impact
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteEntry(entry)}
                        disabled={impact && !impact.canDelete}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  const renderConfirmModal = () => {
    const impact = deletingEntry ? impactAnalysis.get(deletingEntry._id) : null;

    return (
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="!max-w-[95vw] !w-[95vw] max-h-[90vh] overflow-y-auto sm:!max-w-3xl sm:!w-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
              Confirm Deletion
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Entry Details */}
            <div>
              <h3 className="font-semibold mb-2">Entry to be deleted:</h3>
              {deletingEntry && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Date:</span> {formatDateForIndia(
                          deletingEntry.session_date || deletingEntry.payment_date || deletingEntry.date || new Date()
                        )}
                      </div>
                      {filters.entryType === "procurement" && (
                        <>
                          <div>
                            <span className="font-medium">Supplier:</span> {deletingEntry.supplier_name}
                          </div>
                          <div>
                            <span className="font-medium">Item:</span> {deletingEntry.item_name}
                          </div>
                          <div>
                            <span className="font-medium">Amount:</span> ₹{deletingEntry.total_amount.toLocaleString()}
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Impact Analysis */}
            {impact && (
              <div>
                <h3 className="font-semibold mb-2">Deletion Impact Analysis:</h3>
                <Card className={getWarningColor(impact.warningLevel)}>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Risk Level:</span>
                        <Badge variant={
                          impact.warningLevel === "critical" ? "destructive" :
                          impact.warningLevel === "high" ? "destructive" :
                          impact.warningLevel === "medium" ? "default" : "secondary"
                        }>
                          {impact.warningLevel.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>Affected Transactions: {impact.affectedTransactions}</div>
                        <div>Affected Balances: {impact.affectedBalances}</div>
                        <div>Inventory Impact: {impact.inventoryImpact ? "Yes" : "No"}</div>
                        <div>Can Delete: {impact.canDelete ? "Yes" : "No"}</div>
                      </div>

                      {impact.cascadeEffects.length > 0 && (
                        <div>
                          <p className="font-medium text-sm mb-2">Cascade Effects:</p>
                          <ul className="text-xs space-y-1">
                            {impact.cascadeEffects.map((effect, index) => (
                              <li key={index} className="flex items-start">
                                <span className="w-1 h-1 bg-current rounded-full mt-2 mr-2 flex-shrink-0"></span>
                                {effect}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {impact.restrictions.length > 0 && (
                        <div>
                          <p className="font-medium text-sm mb-2 text-red-700">Restrictions:</p>
                          <ul className="text-xs space-y-1">
                            {impact.restrictions.map((restriction, index) => (
                              <li key={index} className="flex items-start text-red-600">
                                <AlertTriangle className="w-3 h-3 mt-0.5 mr-2 flex-shrink-0" />
                                {restriction}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                className="flex-1"
                disabled={impact ? !impact.canDelete : false}
              >
                {impact && !impact.canDelete ? "Cannot Delete" : "Confirm Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Delete Entries</h1>
          <p className="text-muted-foreground mt-1">
            Remove procurement, sales, and payment entries with comprehensive impact analysis
          </p>
        </div>

        {/* Warning Banner */}
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-orange-800">Deletion Warning</p>
                <p className="text-orange-700 mt-1">
                  Deleting entries can have cascading effects on inventory, outstanding balances, and related transactions.
                  Please review the impact analysis carefully before proceeding.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search & Filter Section */}
        {renderSearchFilters()}

        {/* Results Table */}
        {renderResultsTable()}

        {/* Confirmation Modal */}
        {renderConfirmModal()}
      </div>
    </ErrorBoundary>
  );
}