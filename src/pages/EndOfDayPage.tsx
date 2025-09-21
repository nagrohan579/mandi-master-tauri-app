import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { CalendarDays, Package, Search, IndianRupee, TrendingUp, Users, Truck, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

interface DamageEntry {
  id: string;
  supplier_id: string;
  supplier_name: string;
  type_name: string;
  damaged_quantity: number;
  damaged_returned_quantity: number;
  supplier_discount_amount: number;
}

interface AvailableType {
  type_name: string;
  current_stock: number;
}

export function EndOfDayPage() {
  // State management
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [hasSearched, setHasSearched] = useState(false);
  const [settlementForms, setSettlementForms] = useState<{[key: string]: {amount: string; crates: string}}>({});
  const [damageEntries, setDamageEntries] = useState<DamageEntry[]>([]);
  const [showDamageAssessment, setShowDamageAssessment] = useState(false);

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

  // Get available types for damage assessment
  const availableTypes = useQuery(
    api.damageManagement.getAvailableTypesForDamage,
    selectedItem
      ? { item_id: selectedItem as Id<"items"> }
      : "skip"
  ) as AvailableType[] | undefined;

  // Get existing damage entries for this date/item
  const existingDamageEntries = useQuery(
    api.damageManagement.getDamageEntriesForDate,
    hasSearched && selectedItem && selectedDate
      ? {
          damage_date: format(selectedDate, "yyyy-MM-dd"),
          item_id: selectedItem as Id<"items">,
        }
      : "skip"
  );

  // Supplier payment mutation
  const addSupplierPayment = useMutation(api.payments.addSupplierPayment);

  // Damage entry mutation
  const recordDamageEntry = useMutation(api.damageManagement.recordDamageEntry);

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
    setDamageEntries([]);
    setShowDamageAssessment(false);
  };

  // Damage entry management functions
  const addDamageEntry = () => {
    if (!endOfDayData?.supplier_dues || endOfDayData.supplier_dues.length === 0) {
      toast({
        title: "No Suppliers",
        description: "No suppliers found for this item and date",
        variant: "destructive",
      });
      return;
    }

    const newEntry: DamageEntry = {
      id: Date.now().toString(),
      supplier_id: endOfDayData.supplier_dues[0].supplier_id,
      supplier_name: endOfDayData.supplier_dues[0].supplier_name,
      type_name: availableTypes?.[0]?.type_name || "",
      damaged_quantity: 0,
      damaged_returned_quantity: 0,
      supplier_discount_amount: 0,
    };
    setDamageEntries([...damageEntries, newEntry]);
  };

  const removeDamageEntry = (id: string) => {
    setDamageEntries(damageEntries.filter(entry => entry.id !== id));
  };

  const updateDamageEntry = (id: string, field: keyof DamageEntry, value: string | number) => {
    setDamageEntries(damageEntries.map(entry => {
      if (entry.id === id) {
        const updated = { ...entry, [field]: value };

        // Update supplier name when supplier_id changes
        if (field === 'supplier_id' && endOfDayData?.supplier_dues) {
          const supplier = endOfDayData.supplier_dues.find(s => s.supplier_id === value);
          updated.supplier_name = supplier?.supplier_name || "";
        }

        return updated;
      }
      return entry;
    }));
  };

  const validateDamageEntry = (entry: DamageEntry): string | null => {
    if (!entry.type_name) return "Please select a type";
    if (entry.damaged_quantity <= 0) return "Damaged quantity must be greater than 0";
    if (entry.damaged_returned_quantity < 0) return "Returned quantity cannot be negative";
    if (entry.supplier_discount_amount < 0) return "Discount amount cannot be negative";

    if (entry.damaged_returned_quantity > entry.damaged_quantity) {
      return `Returned quantity (${entry.damaged_returned_quantity}) cannot exceed damaged quantity (${entry.damaged_quantity})`;
    }

    return null;
  };

  const handleSaveDamageEntry = async (entry: DamageEntry) => {
    const validationError = validateDamageEntry(entry);
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    try {
      await recordDamageEntry({
        damage_date: format(selectedDate!, "yyyy-MM-dd"),
        supplier_id: entry.supplier_id as Id<"suppliers">,
        item_id: selectedItem as Id<"items">,
        type_name: entry.type_name,
        damaged_quantity: entry.damaged_quantity,
        damaged_returned_quantity: entry.damaged_returned_quantity,
        supplier_discount_amount: entry.supplier_discount_amount,
      });

      toast({
        title: "Damage Entry Saved",
        description: `Recorded damage for ${entry.type_name} from ${entry.supplier_name}`,
      });

      // Remove this entry from the form
      removeDamageEntry(entry.id);

    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save damage entry",
        variant: "destructive",
      });
    }
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
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Sales Summary - {endOfDayData.item_info.name} ({endOfDayData.item_info.unit}) on {formatDateForIndia(format(selectedDate!, "yyyy-MM-dd"))}
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="damage-assessment"
                    checked={showDamageAssessment}
                    onCheckedChange={(checked) => setShowDamageAssessment(checked as boolean)}
                  />
                  <Label htmlFor="damage-assessment" className="text-sm font-medium cursor-pointer">
                    Show Damage Assessment
                  </Label>
                </div>
              </div>
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

          {/* Damage Assessment Section */}
          {showDamageAssessment && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Damage Assessment
                </CardTitle>
                <Button onClick={addDamageEntry} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Damage Entry
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Record damaged items found during end of day review
              </p>
            </CardHeader>
            <CardContent>
              {/* Existing Damage Entries Display */}
              {existingDamageEntries && existingDamageEntries.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium mb-3">Previously Recorded Damage:</h4>
                  <div className="space-y-2">
                    {existingDamageEntries.map((entry: any) => (
                      <div key={entry._id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <span className="font-medium">{entry.supplier_name}</span> - {entry.type_name}
                        </div>
                        <div className="text-right text-sm">
                          <div>Damaged: {entry.damaged_quantity}, Returned: {entry.damaged_returned_quantity}</div>
                          <div className="text-red-600 font-medium">Discount: ₹{entry.supplier_discount_amount.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Damage Entry Forms */}
              {damageEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No damage entries added yet. Click "Add Damage Entry" to start.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Header Row */}
                  <div className="grid grid-cols-12 gap-4 font-medium text-sm text-muted-foreground border-b pb-2">
                    <div className="col-span-2">Supplier</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-2">Damaged Quantity</div>
                    <div className="col-span-2">Returned Quantity</div>
                    <div className="col-span-2">Discount (₹)</div>
                    <div className="col-span-2">Actions</div>
                  </div>

                  {/* Damage Entry Rows */}
                  {damageEntries.map((entry) => (
                    <div key={entry.id} className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-2">
                        <Select
                          value={entry.supplier_id}
                          onValueChange={(value) => updateDamageEntry(entry.id, 'supplier_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                          <SelectContent>
                            {endOfDayData?.supplier_dues?.map((supplier) => (
                              <SelectItem key={supplier.supplier_id} value={supplier.supplier_id}>
                                {supplier.supplier_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Select
                          value={entry.type_name}
                          onValueChange={(value) => updateDamageEntry(entry.id, 'type_name', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTypes?.map((type) => (
                              <SelectItem key={type.type_name} value={type.type_name}>
                                {type.type_name} ({type.current_stock} available)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="0"
                          value={entry.damaged_quantity || ""}
                          onChange={(e) => updateDamageEntry(entry.id, 'damaged_quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="0"
                          value={entry.damaged_returned_quantity || ""}
                          onChange={(e) => updateDamageEntry(entry.id, 'damaged_returned_quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={entry.supplier_discount_amount || ""}
                          onChange={(e) => updateDamageEntry(entry.id, 'supplier_discount_amount', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2 flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveDamageEntry(entry)}
                          className="flex items-center gap-1"
                        >
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeDamageEntry(entry.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}

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