import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { CalendarDays, Package, Search, IndianRupee, TrendingUp, Users, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/DatePicker";
import { formatDateForIndia } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface SellerTotals {
  amount_sold: number;
  amount_received: number;
  total_crates_sold: number;
  total_crates_received: number;
}

interface SupplierDue {
  supplier_id: string;
  supplier_name: string;
  payment_due: number;
  quantity_due: number;
}

interface EndOfDayData {
  seller_totals: SellerTotals;
  supplier_dues: SupplierDue[];
  item_info: {
    name: string;
    unit: string;
    show_crates: boolean;
  };
}

export function EndOfDayPage() {
  // State management
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [hasSearched, setHasSearched] = useState(false);
  const [settlementForms, setSettlementForms] = useState<{[key: string]: {amount: string; crates: string}}>({});

  const { toast } = useToast();

  // Convex queries
  const items = useQuery(api.masterData.getItems, { active_only: true });

  // Get end of day data when search is performed
  const endOfDayData = useQuery(
    api.reports.getEndOfDayData,
    hasSearched && selectedItem && selectedDate
      ? {
          item_id: selectedItem as Id<"items">,
          date: format(selectedDate, "yyyy-MM-dd"),
        }
      : "skip"
  ) as EndOfDayData | undefined;

  // Supplier payment mutation
  const addSupplierPayment = useMutation(api.payments.addSupplierPayment);

  // Handle search
  const handleSearch = () => {
    if (!selectedItem || !selectedDate) {
      toast({
        title: "Missing Information",
        description: "Please select both item and date",
        variant: "destructive",
      });
      return;
    }

    setHasSearched(true);
    setSettlementForms({}); // Reset settlement forms
  };

  // Handle reset
  const handleReset = () => {
    setSelectedItem("");
    setSelectedDate(new Date());
    setHasSearched(false);
    setSettlementForms({});
  };

  // Handle settlement form changes
  const updateSettlementForm = (supplierId: string, field: "amount" | "crates", value: string) => {
    const numericValue = value === "" ? 0 : parseFloat(value) || 0;
    setSettlementForms(prev => ({
      ...prev,
      [supplierId]: {
        ...prev[supplierId],
        [field]: numericValue.toString(),
      }
    }));
  };

  // Handle supplier settlement
  const handleSupplierSettlement = async (supplierDue: SupplierDue) => {
    const form = settlementForms[supplierDue.supplier_id];
    const amountToPay = parseFloat(form?.amount || "0");
    const cratesToReturn = parseFloat(form?.crates || "0");

    if (amountToPay <= 0 && cratesToReturn <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter an amount to pay or crates to return",
        variant: "destructive",
      });
      return;
    }

    if (amountToPay > supplierDue.payment_due) {
      toast({
        title: "Amount Too High",
        description: `Cannot pay more than ₹${supplierDue.payment_due.toLocaleString()} owed`,
        variant: "destructive",
      });
      return;
    }

    if (cratesToReturn > supplierDue.quantity_due) {
      toast({
        title: "Crates Too Many",
        description: `Cannot return more than ${supplierDue.quantity_due} crates owed`,
        variant: "destructive",
      });
      return;
    }

    try {
      await addSupplierPayment({
        payment_date: format(selectedDate!, "yyyy-MM-dd"),
        supplier_id: supplierDue.supplier_id as Id<"suppliers">,
        item_id: selectedItem as Id<"items">,
        amount_paid: amountToPay,
        crates_returned: cratesToReturn,
        notes: `End of day settlement for ${endOfDayData?.item_info.name}`,
      });

      toast({
        title: "Settlement Successful",
        description: `Paid ₹${amountToPay.toLocaleString()} and returned ${cratesToReturn} crates to ${supplierDue.supplier_name}`,
      });

      // Reset this supplier's form
      setSettlementForms(prev => ({
        ...prev,
        [supplierDue.supplier_id]: { amount: "0", crates: "0" }
      }));

    } catch (error) {
      toast({
        title: "Settlement Failed",
        description: "Failed to process supplier payment",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="w-8 h-8" />
            End of Day
          </h1>
          <p className="text-muted-foreground mt-1">
            Reconcile cash, settle supplier payments, and close the day's session
          </p>
        </div>
      </div>

      {/* Search Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Select Item & Date
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
                  Load Data
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* End of Day Results */}
      {hasSearched && endOfDayData && (
        <>
          {/* Sales Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Sales Summary - {endOfDayData.item_info.name} ({endOfDayData.item_info.unit}) on {formatDateForIndia(format(selectedDate!, "yyyy-MM-dd"))}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    ₹{endOfDayData.seller_totals.amount_sold.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Amount Sold</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    ₹{endOfDayData.seller_totals.amount_received.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Amount Received</div>
                </div>
                {endOfDayData.item_info.show_crates && (
                  <>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {endOfDayData.seller_totals.total_crates_sold.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Crates Sold</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {endOfDayData.seller_totals.total_crates_received.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Crates Received</div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Supplier Settlements */}
          {endOfDayData.supplier_dues.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                <h2 className="text-xl font-semibold">Supplier Settlements</h2>
              </div>

              {endOfDayData.supplier_dues.map((supplier) => (
                <Card key={supplier.supplier_id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{supplier.supplier_name}</span>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-red-600">
                          Amount Due: ₹{supplier.payment_due.toLocaleString()}
                        </span>
                        {endOfDayData.item_info.show_crates && (
                          <span className="text-red-600">
                            Crates Due: {supplier.quantity_due}
                          </span>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div className="space-y-2">
                        <Label>Amount to Pay (₹)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          value={settlementForms[supplier.supplier_id]?.amount || "0"}
                          onChange={(e) => updateSettlementForm(supplier.supplier_id, "amount", e.target.value)}
                          max={supplier.payment_due}
                        />
                      </div>

                      {endOfDayData.item_info.show_crates && (
                        <div className="space-y-2">
                          <Label>Crates to Return</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0"
                            value={settlementForms[supplier.supplier_id]?.crates || "0"}
                            onChange={(e) => updateSettlementForm(supplier.supplier_id, "crates", e.target.value)}
                            max={supplier.quantity_due}
                          />
                        </div>
                      )}

                      <Button
                        onClick={() => handleSupplierSettlement(supplier)}
                        className="flex items-center gap-2"
                      >
                        <IndianRupee className="w-4 h-4" />
                        Settle with {supplier.supplier_name}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No outstanding dues to suppliers for {endOfDayData.item_info.name}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Instructions */}
      {!hasSearched && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select an item and date to view end of day summary and settle with suppliers</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}