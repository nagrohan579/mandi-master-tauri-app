import React, { useState } from "react";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { FileText, Search, ChevronDown, ChevronUp, Package, Calendar } from "lucide-react";
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

interface DuesEntry {
  _id: string;
  seller_id: string;
  seller_name: string;
  total_amount_purchased: number;
  total_quantity_purchased: number;
  crates_returned: number;
  amount_paid: number;
  less_discount: number;
  final_quantity_outstanding: number;
  final_payment_outstanding: number;
  line_items: Array<{
    type_name: string;
    quantity: number;
    sale_rate: number;
    amount: number;
  }>;
}

interface DailyDuesData {
  item_name: string;
  item_unit: string;
  show_crates: boolean;
  date: string;
  entries: DuesEntry[];
}

export function DailyDuesReportPage() {
  // State management
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  // Convex queries
  const items = useQuery(api.masterData.getItems, { active_only: true });

  // Get daily dues data when search is performed
  const duesData = useQuery(
    api.reports.getDailyDuesByItem,
    hasSearched && selectedItem && selectedDate
      ? {
          item_id: selectedItem as Id<"items">,
          date: format(selectedDate, "yyyy-MM-dd"),
        }
      : "skip"
  ) as DailyDuesData | undefined;

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
    if (!selectedItem || !selectedDate) {
      alert("Please select both item and date");
      return;
    }

    setHasSearched(true);
    setExpandedRows(new Set()); // Reset expanded rows
  };

  // Reset form
  const handleReset = () => {
    setSelectedItem("");
    setSelectedDate(undefined);
    setHasSearched(false);
    setExpandedRows(new Set());
  };

  // Format type details for display
  const formatTypeDetails = (lineItems: DuesEntry["line_items"]) => {
    if (lineItems.length === 0) return "No items";

    const typeCount = lineItems.length;
    const totalQuantity = lineItems.reduce((sum, item) => sum + item.quantity, 0);

    return `${typeCount} type${typeCount > 1 ? 's' : ''} (${totalQuantity} units)`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="w-8 h-8" />
            Daily Dues Report
          </h1>
          <p className="text-muted-foreground mt-1">
            View all seller transactions for a specific item on a specific date
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

            {/* Date Selection */}
            <div className="space-y-2">
              <Label>Date *</Label>
              <DatePicker
                date={selectedDate}
                setDate={setSelectedDate}
                placeholder="Select date"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Label className="invisible">Actions</Label>
              <div className="flex gap-2">
                <Button onClick={handleSearch} className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Search
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Dues Results */}
      {hasSearched && duesData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Daily Dues - {duesData.item_name} ({duesData.item_unit}) on {formatDateForIndia(duesData.date)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {duesData.entries.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Seller Name</TableHead>
                      <TableHead className="min-w-[200px]">Type Details</TableHead>
                      <TableHead className="text-right min-w-[120px]">Total Amount</TableHead>
                      {duesData.show_crates && <TableHead className="text-right min-w-[100px]">Crates Returned</TableHead>}
                      <TableHead className="text-right min-w-[120px]">Amount Paid</TableHead>
                      <TableHead className="text-right min-w-[100px]">Less</TableHead>
                      {duesData.show_crates && <TableHead className="text-right min-w-[120px]">Total Crates Due</TableHead>}
                      <TableHead className="text-right min-w-[140px]">Total Amount Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duesData.entries.map((entry) => (
                      <React.Fragment key={entry._id}>
                        {/* Main Row */}
                        <TableRow className="group cursor-pointer hover:bg-muted/50" onClick={() => toggleRowExpansion(entry._id)}>
                          <TableCell className="font-medium min-w-[150px]">
                            {entry.seller_name}
                          </TableCell>
                          <TableCell className="min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span>{formatTypeDetails(entry.line_items)}</span>
                              {expandedRows.has(entry._id) ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium min-w-[120px]">
                            ₹{entry.total_amount_purchased.toLocaleString()}
                          </TableCell>
                          {duesData.show_crates && (
                            <TableCell className="text-right min-w-[100px]">
                              {entry.crates_returned}
                            </TableCell>
                          )}
                          <TableCell className="text-right min-w-[120px]">
                            ₹{entry.amount_paid.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right min-w-[100px]">
                            ₹{entry.less_discount.toLocaleString()}
                          </TableCell>
                          {duesData.show_crates && (
                            <TableCell className="text-right font-medium min-w-[120px]">
                              {entry.final_quantity_outstanding}
                            </TableCell>
                          )}
                          <TableCell className="text-right font-medium min-w-[140px]">
                            ₹{entry.final_payment_outstanding.toLocaleString()}
                          </TableCell>
                        </TableRow>

                        {/* Expanded Type Details */}
                        {expandedRows.has(entry._id) && entry.line_items.map((item, index) => (
                          <TableRow key={`${entry._id}-${index}`} className="bg-muted/20">
                            <TableCell className="min-w-[150px]"></TableCell>
                            <TableCell className="pl-8 min-w-[200px]">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">→</span>
                                <Badge variant="outline" className="text-xs">
                                  {item.type_name}
                                </Badge>
                                <span className="text-sm">
                                  {item.quantity} @ ₹{item.sale_rate.toFixed(2)} = ₹{item.amount.toFixed(2)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[120px]"></TableCell>
                            {duesData.show_crates && <TableCell className="min-w-[100px]"></TableCell>}
                            <TableCell className="min-w-[120px]"></TableCell>
                            <TableCell className="min-w-[100px]"></TableCell>
                            {duesData.show_crates && <TableCell className="min-w-[120px]"></TableCell>}
                            <TableCell className="min-w-[140px]"></TableCell>
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
                <p>No transactions found for {duesData.item_name} on {formatDateForIndia(duesData.date)}</p>
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
              <p>Select an item and date to view the daily dues report</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}