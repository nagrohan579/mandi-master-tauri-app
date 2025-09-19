import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
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

type EntryType = "procurement" | "sales" | "payments";

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
  const [impactAnalysis, setImpactAnalysis] = useState<any>(null);
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
    searchParams && filters.entryType === "procurement" ? {
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      ...(searchParams.supplierId && { supplierId: searchParams.supplierId }),
      ...(searchParams.itemId && { itemId: searchParams.itemId }),
    } : "skip"
  );

  const salesResults = useQuery(
    api.entryManagement.searchSalesEntries,
    searchParams && filters.entryType === "sales" ? {
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      ...(searchParams.sellerId && { sellerId: searchParams.sellerId }),
      ...(searchParams.itemId && { itemId: searchParams.itemId }),
    } : "skip"
  );

  const paymentResults = useQuery(
    api.entryManagement.searchPaymentEntries,
    searchParams && filters.entryType === "payments" ? {
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      ...(searchParams.itemId && { itemId: searchParams.itemId }),
    } : "skip"
  );

  // Mutations for updating entries
  const updateProcurementEntry = useMutation(api.entryManagement.updateProcurementEntry);
  const updateSalesEntry = useMutation(api.entryManagement.updateSalesEntry);

  // Update search results when query results change
  useEffect(() => {
    try {
      setQueryError(null);
      const results = filters.entryType === "procurement" ? procurementResults :
                     filters.entryType === "sales" ? salesResults : paymentResults;

      if (results && Array.isArray(results)) {
        setSearchResults(results);
      } else if (results === undefined) {
        // Query is still loading
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error in search results:", error);
      setQueryError(error instanceof Error ? error.message : "Unknown error occurred");
      setSearchResults([]);
    }
  }, [procurementResults, salesResults, paymentResults, filters.entryType]);

  const handleSearch = async () => {
    if (!filters.startDate || !filters.endDate) {
      alert("Please select both start and end dates");
      return;
    }

    const startDateStr = filters.startDate.toISOString().split('T')[0];
    const endDateStr = filters.endDate.toISOString().split('T')[0];

    // Set search parameters to trigger the reactive queries
    if (filters.entryType === "procurement") {
      setSearchParams({
        startDate: startDateStr,
        endDate: endDateStr,
        supplierId: filters.supplierId !== "all" ? filters.supplierId : null,
        itemId: filters.itemId !== "all" ? filters.itemId : null,
      });
    } else if (filters.entryType === "sales") {
      setSearchParams({
        startDate: startDateStr,
        endDate: endDateStr,
        sellerId: filters.sellerId !== "all" ? filters.sellerId : null,
        itemId: filters.itemId !== "all" ? filters.itemId : null,
      });
    } else if (filters.entryType === "payments") {
      setSearchParams({
        startDate: startDateStr,
        endDate: endDateStr,
        itemId: filters.itemId !== "all" ? filters.itemId : null,
      });
    }
  };

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setEditFormData({ ...entry });

    // Calculate impact analysis
    const impact = calculateImpactAnalysis(entry);
    setImpactAnalysis(impact);

    setIsEditModalOpen(true);
  };

  const calculateImpactAnalysis = (_entry: any) => {
    // Mock impact analysis
    return {
      affectedTransactions: 3,
      affectedBalances: 2,
      inventoryChanges: true,
      warningLevel: "medium",
      details: [
        "This change will affect 3 related sales transactions",
        "Outstanding balances for 2 customers will be recalculated",
        "Daily inventory levels will be updated",
      ],
    };
  };

  const handleSaveChanges = async () => {
    if (!editingEntry) return;

    try {
      if (filters.entryType === "procurement") {
        await updateProcurementEntry({
          entryId: editingEntry._id,
          quantity: editFormData.quantity,
          rate: editFormData.rate,
          type_name: editFormData.type_name,
        });
      } else if (filters.entryType === "sales") {
        await updateSalesEntry({
          entryId: editingEntry._id,
          amount_paid: editFormData.amount_paid,
          less_discount: editFormData.less_discount,
          quantity_returned: editFormData.quantity_returned,
        });
      }

      setIsEditModalOpen(false);
      setEditingEntry(null);
      // Trigger a fresh search to get updated data
      setSearchParams(null);
      setTimeout(() => handleSearch(), 100);
      alert("Entry updated successfully!");
    } catch (error) {
      console.error("Error updating entry:", error);
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
              onValueChange={(value: EntryType) => setFilters(prev => ({ ...prev, entryType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select entry type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="procurement">Procurement Entries</SelectItem>
                <SelectItem value="sales">Sales Entries</SelectItem>
                <SelectItem value="payments">Payment Entries</SelectItem>
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

          {filters.entryType === "sales" && (
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
                {filters.entryType === "sales" && (
                  <>
                    <TableHead>Seller</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead>Outstanding</TableHead>
                  </>
                )}
                {filters.entryType === "payments" && (
                  <>
                    <TableHead>Person</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
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
                      entry.session_date || entry.payment_date || entry.date || new Date()
                    )}
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
                  {filters.entryType === "sales" && (
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
                  {filters.entryType === "payments" && (
                    <>
                      <TableCell>{entry.person_name}</TableCell>
                      <TableCell>{entry.item_name}</TableCell>
                      <TableCell>₹{entry.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={entry.type === "supplier_payment" ? "default" : "secondary"}>
                          {entry.type === "supplier_payment" ? "To Supplier" : "From Seller"}
                        </Badge>
                      </TableCell>
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
    <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit {filters.entryType.charAt(0).toUpperCase() + filters.entryType.slice(1)} Entry</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Edit Form */}
          <div className="space-y-4">
            <h3 className="font-semibold">Entry Details</h3>

            {filters.entryType === "procurement" && editFormData && (
              <>
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
              </>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSaveChanges} className="flex-1">
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>

          {/* Impact Analysis */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Impact Analysis
            </h3>

            {impactAnalysis && (
              <Card className={`border ${
                impactAnalysis.warningLevel === "high"
                  ? "border-red-200 bg-red-50"
                  : impactAnalysis.warningLevel === "medium"
                  ? "border-yellow-200 bg-yellow-50"
                  : "border-green-200 bg-green-50"
              }`}>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Warning Level:</span>
                      <Badge variant={
                        impactAnalysis.warningLevel === "high"
                          ? "destructive"
                          : impactAnalysis.warningLevel === "medium"
                          ? "default"
                          : "secondary"
                      }>
                        {impactAnalysis.warningLevel.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="text-sm space-y-1">
                      <p><strong>Affected Transactions:</strong> {impactAnalysis.affectedTransactions}</p>
                      <p><strong>Affected Balances:</strong> {impactAnalysis.affectedBalances}</p>
                      <p><strong>Inventory Changes:</strong> {impactAnalysis.inventoryChanges ? "Yes" : "No"}</p>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-medium">Details:</p>
                      <ul className="text-xs space-y-1 mt-1">
                        {impactAnalysis.details.map((detail: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="w-1 h-1 bg-current rounded-full mt-2 mr-2 flex-shrink-0"></span>
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
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