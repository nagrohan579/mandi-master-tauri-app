import React, { useState } from "react";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { FileText, Search, ChevronDown, ChevronUp, Truck, Package, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/DatePicker";
import { formatDateForIndia } from "@/lib/utils";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface LedgerEntry {
  _id: string;
  session_date: string;
  procurement_amount: number;
  procurement_quantity: number;
  amount_paid: number | null;
  crates_returned: number | null;
  type_details: Array<{
    type_name: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
}

interface SupplierLedgerData {
  supplier_name: string;
  item_name: string;
  item_unit: string;
  show_crates: boolean;
  date_range: {
    start_date: string;
    end_date: string;
  };
  entries: LedgerEntry[];
}

export function SupplierLedgerReportPage() {
  // State management
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  // Convex queries
  const suppliers = useQuery(api.masterData.getSuppliers, { active_only: true });
  const items = useQuery(api.masterData.getItems, { active_only: true });

  // Get ledger data when search is performed
  const ledgerData = useQuery(
    api.reports.getSupplierLedger,
    hasSearched && selectedSupplier && selectedItem && startDate && endDate
      ? {
          supplier_id: selectedSupplier as Id<"suppliers">,
          item_id: selectedItem as Id<"items">,
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
        }
      : "skip"
  ) as SupplierLedgerData | undefined;

  // Toggle row expansion
  const toggleRowExpansion = (entryId: string) => {
    const newExpanded = new Set(expandedRows);
    if (expandedRows.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedRows(newExpanded);
  };

  // Handle search
  const handleSearch = () => {
    if (!selectedSupplier || !selectedItem || !startDate || !endDate) {
      alert("Please fill all search criteria");
      return;
    }

    if (startDate > endDate) {
      alert("Start date must be before or equal to end date");
      return;
    }

    setHasSearched(true);
    setExpandedRows(new Set()); // Reset expanded rows
  };

  // Reset form
  const handleReset = () => {
    setSelectedSupplier("");
    setSelectedItem("");
    setStartDate(undefined);
    setEndDate(undefined);
    setHasSearched(false);
    setExpandedRows(new Set());
  };

  // Format type details for display
  const formatTypeDetails = (typeDetails: LedgerEntry["type_details"]) => {
    if (typeDetails.length === 0) return "No items";

    const typeCount = typeDetails.length;
    const totalQuantity = typeDetails.reduce((sum, item) => sum + item.quantity, 0);

    return `${typeCount} type${typeCount > 1 ? 's' : ''} (${totalQuantity} units)`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Truck className="w-8 h-8" />
            Supplier Ledger Report
          </h1>
          <p className="text-muted-foreground mt-1">
            View detailed procurement and settlement history for a specific supplier and item
          </p>
        </div>
      </div>

      {/* Search Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Criteria
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Supplier Selection */}
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((supplier) => (
                    <SelectItem key={supplier._id} value={supplier._id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Item Selection */}
            <div className="space-y-2">
              <Label>Item *</Label>
              <Select value={selectedItem} onValueChange={setSelectedItem}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items?.map((item) => (
                    <SelectItem key={item._id} value={item._id}>
                      {item.name} ({item.unit_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <DatePicker
                date={startDate}
                setDate={setStartDate}
                placeholder="Select start date"
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label>End Date *</Label>
              <DatePicker
                date={endDate}
                setDate={setEndDate}
                placeholder="Select end date"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button onClick={handleSearch} className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Search
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Results */}
      {hasSearched && ledgerData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Procurement History - {ledgerData.supplier_name} / {ledgerData.item_name} ({ledgerData.item_unit})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {formatDateForIndia(ledgerData.date_range.start_date)} to {formatDateForIndia(ledgerData.date_range.end_date)}
            </p>
          </CardHeader>
          <CardContent>
            {ledgerData.entries.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px]">Date</TableHead>
                      <TableHead className="min-w-[200px]">Type Details</TableHead>
                      <TableHead className="text-right min-w-[120px]">Total Amount</TableHead>
                      {ledgerData.show_crates && <TableHead className="text-right min-w-[120px]">Crates Purchased</TableHead>}
                      <TableHead className="text-right min-w-[120px]">Amount Paid</TableHead>
                      {ledgerData.show_crates && <TableHead className="text-right min-w-[120px]">Crates Returned</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerData.entries.map((entry) => (
                      <React.Fragment key={entry._id}>
                        {/* Main Row */}
                        <TableRow className="group cursor-pointer hover:bg-muted/50" onClick={() => toggleRowExpansion(entry._id)}>
                          <TableCell className="font-medium min-w-[100px]">
                            {formatDateForIndia(entry.session_date)}
                          </TableCell>
                          <TableCell className="min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span>{formatTypeDetails(entry.type_details)}</span>
                              {expandedRows.has(entry._id) ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium min-w-[120px]">
                            ₹{entry.procurement_amount.toLocaleString()}
                          </TableCell>
                          {ledgerData.show_crates && (
                            <TableCell className="text-right min-w-[120px]">
                              {entry.procurement_quantity.toLocaleString()}
                            </TableCell>
                          )}
                          <TableCell className="text-right min-w-[120px]">
                            {entry.amount_paid === null ? (
                              <span className="text-muted-foreground italic">No payment</span>
                            ) : (
                              <span>₹{entry.amount_paid.toLocaleString()}</span>
                            )}
                          </TableCell>
                          {ledgerData.show_crates && (
                            <TableCell className="text-right min-w-[120px]">
                              {entry.crates_returned === null ? (
                                <span className="text-muted-foreground italic">No return</span>
                              ) : (
                                <span>{entry.crates_returned.toLocaleString()}</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>

                        {/* Expanded Type Details */}
                        {expandedRows.has(entry._id) && entry.type_details.map((item, index) => (
                          <TableRow key={`${entry._id}-${index}`} className="bg-muted/20">
                            <TableCell className="min-w-[100px]"></TableCell>
                            <TableCell className="pl-8 min-w-[200px]">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">→</span>
                                <Badge variant="outline" className="text-xs">
                                  {item.type_name}
                                </Badge>
                                <span className="text-sm">
                                  {item.quantity} @ ₹{item.rate.toFixed(2)} = ₹{item.amount.toFixed(2)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[120px]"></TableCell>
                            {ledgerData.show_crates && <TableCell className="min-w-[120px]"></TableCell>}
                            <TableCell className="min-w-[120px]"></TableCell>
                            {ledgerData.show_crates && <TableCell className="min-w-[120px]"></TableCell>}
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No procurement found for the selected criteria</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {!hasSearched && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a supplier, item, and date range to view the procurement ledger</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}