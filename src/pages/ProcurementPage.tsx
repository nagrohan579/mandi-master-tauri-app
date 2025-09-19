import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { Plus, Trash2, Save, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/DatePicker";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface ProcurementType {
  id: string;
  type_name: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface YesterdayStock {
  type_name: string;
  closing_stock: number;
  weighted_avg_purchase_rate: number;
}

export function ProcurementPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [procurementTypes, setProcurementTypes] = useState<ProcurementType[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Convex queries
  const suppliers = useQuery(api.masterData.getSuppliers, { active_only: true });
  const items = useQuery(api.masterData.getItems, { active_only: true });

  const yesterdayStock = useQuery(
    api.procurement.getYesterdayStock,
    selectedItem && selectedDate
      ? {
          item_id: selectedItem as Id<"items">,
          date: format(new Date(selectedDate.getTime() - 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
        }
      : "skip"
  );

  const todaysProcurement = useQuery(
    api.procurement.getTodaysProcurement,
    selectedDate
      ? { date: format(selectedDate, "yyyy-MM-dd") }
      : "skip"
  );

  // Convex mutations
  const createProcurementSession = useMutation(api.procurement.createProcurementSession);
  const addProcurementEntry = useMutation(api.procurement.addProcurementEntry);

  const addProcurementType = () => {
    const newType: ProcurementType = {
      id: Date.now().toString(),
      type_name: "",
      quantity: 0,
      rate: 0,
      amount: 0,
    };
    setProcurementTypes([...procurementTypes, newType]);
  };

  const removeProcurementType = (id: string) => {
    setProcurementTypes(procurementTypes.filter(type => type.id !== id));
  };

  const updateProcurementType = (id: string, field: keyof ProcurementType, value: string | number) => {
    setProcurementTypes(procurementTypes.map(type => {
      if (type.id === id) {
        const updated = { ...type, [field]: value };
        if (field === 'quantity' || field === 'rate') {
          updated.amount = updated.quantity * updated.rate;
        }
        return updated;
      }
      return type;
    }));
  };

  const calculateTotalAmount = () => {
    return procurementTypes.reduce((sum, type) => sum + type.amount, 0);
  };

  const calculateTotalQuantity = () => {
    return procurementTypes.reduce((sum, type) => sum + type.quantity, 0);
  };

  const handleSaveProcurement = async () => {
    if (!selectedSupplier || !selectedItem || procurementTypes.length === 0) {
      alert("Please select supplier, item and add at least one procurement type");
      return;
    }

    if (procurementTypes.some(type => !type.type_name || type.quantity <= 0 || type.rate <= 0)) {
      alert("Please fill all procurement type details");
      return;
    }

    setIsLoading(true);

    try {
      const sessionDate = format(selectedDate, "yyyy-MM-dd");

      // Create or get procurement session
      const sessionId = await createProcurementSession({ session_date: sessionDate });

      // Add each procurement entry
      for (const type of procurementTypes) {
        await addProcurementEntry({
          procurement_session_id: sessionId,
          supplier_id: selectedSupplier as Id<"suppliers">,
          item_id: selectedItem as Id<"items">,
          type_name: type.type_name,
          quantity: type.quantity,
          rate: type.rate,
        });
      }

      // Clear the form
      setProcurementTypes([]);
      setSelectedSupplier("");
      setSelectedItem("");

      alert("Procurement saved successfully!");
    } catch (error) {
      console.error("Error saving procurement:", error);
      alert("Error saving procurement. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setProcurementTypes([]);
    setSelectedSupplier("");
    setSelectedItem("");
  };

  // Calculate total available stock (yesterday + today)
  const calculateTotalAvailable = () => {
    const yesterdayTotal = yesterdayStock?.reduce((sum: number, stock: YesterdayStock) => sum + stock.closing_stock, 0) || 0;
    const todayTotal = calculateTotalQuantity();
    return yesterdayTotal + todayTotal;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Procurement Entry - {format(selectedDate, "EEEE, MMMM d, yyyy")}
        </h1>
        <p className="text-muted-foreground mt-1">
          Record morning procurement from suppliers with dynamic type management
        </p>
      </div>

      {/* Date & Basic Selection Section */}
      <Card>
        <CardHeader>
          <CardTitle>Procurement Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Picker */}
            <div className="space-y-2">
              <Label htmlFor="date">Procurement Date</Label>
              <DatePicker
                date={selectedDate}
                setDate={(date) => date && setSelectedDate(date)}
                placeholder="Select procurement date"
              />
            </div>

            {/* Supplier Selection */}
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Select value={selectedSupplier} onValueChange={(value) => setSelectedSupplier(value)}>
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
              <Label htmlFor="item">Item</Label>
              <Select value={selectedItem} onValueChange={(value) => setSelectedItem(value)}>
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
          </div>
        </CardContent>
      </Card>

      {/* Yesterday's Stock Display */}
      {selectedItem && yesterdayStock && yesterdayStock.length > 0 && (
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Yesterday's Remaining Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {yesterdayStock.map((stock: YesterdayStock, index: number) => (
                <div key={index} className="bg-background rounded-lg p-3 border">
                  <span className="font-medium">{stock.type_name}:</span>{" "}
                  <span className="text-primary font-semibold">{stock.closing_stock} units</span>{" "}
                  <span className="text-muted-foreground">@ avg ₹{stock.weighted_avg_purchase_rate.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-primary/10 rounded-lg">
              <span className="text-sm font-medium">
                Total Yesterday's Stock: {yesterdayStock.reduce((sum: number, stock: YesterdayStock) => sum + stock.closing_stock, 0)} units
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dynamic Procurement Entry Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Today's Procurement Entry</CardTitle>
            <Button onClick={addProcurementType} className="flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              Add Type
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {procurementTypes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No procurement types added yet. Click "Add Type" to start.</p>
            </div>
          ) : (
            <>
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-4 font-medium text-sm text-muted-foreground border-b pb-2">
                <div className="col-span-3">Type Name</div>
                <div className="col-span-2">Quantity</div>
                <div className="col-span-2">Rate (₹)</div>
                <div className="col-span-2">Amount (₹)</div>
                <div className="col-span-2">Actions</div>
              </div>

              {/* Procurement Type Rows */}
              {procurementTypes.map((type) => (
                <div key={type.id} className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-3">
                    <Input
                      placeholder="e.g., Type X, Grade A"
                      value={type.type_name}
                      onChange={(e) => updateProcurementType(type.id, 'type_name', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="0"
                      value={type.quantity || ""}
                      onChange={(e) => updateProcurementType(type.id, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      value={type.rate || ""}
                      onChange={(e) => updateProcurementType(type.id, 'rate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="px-3 py-2 bg-muted rounded-md text-sm font-medium">
                      ₹{type.amount.toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeProcurementType(type.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Total Row */}
              <div className="grid grid-cols-12 gap-4 border-t pt-4 font-semibold">
                <div className="col-span-3">TOTAL</div>
                <div className="col-span-2">{calculateTotalQuantity()} units</div>
                <div className="col-span-2">-</div>
                <div className="col-span-2">₹{calculateTotalAmount().toFixed(2)}</div>
                <div className="col-span-2"></div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Total Available Stock Summary */}
      {selectedItem && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-primary">Total Available Stock After Procurement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="bg-background rounded-lg p-4">
                <div className="text-2xl font-bold text-muted-foreground">
                  {yesterdayStock?.reduce((sum: number, stock: YesterdayStock) => sum + stock.closing_stock, 0) || 0}
                </div>
                <div className="text-sm text-muted-foreground">Yesterday's Stock</div>
              </div>
              <div className="bg-background rounded-lg p-4">
                <div className="text-2xl font-bold text-primary">{calculateTotalQuantity()}</div>
                <div className="text-sm text-muted-foreground">Today's Procurement</div>
              </div>
              <div className="bg-primary text-primary-foreground rounded-lg p-4">
                <div className="text-2xl font-bold">{calculateTotalAvailable()}</div>
                <div className="text-sm opacity-90">Total Available</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          onClick={handleSaveProcurement}
          disabled={isLoading || procurementTypes.length === 0}
          className="flex items-center"
        >
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? "Saving..." : "Save Procurement"}
        </Button>
        <Button
          variant="outline"
          onClick={resetForm}
          disabled={isLoading}
        >
          Reset Form
        </Button>
      </div>

      {/* Today's Procurement Summary */}
      {todaysProcurement && todaysProcurement.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Today's Procurement Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todaysProcurement.map((entry: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <div>
                    <span className="font-medium">{entry.supplier_name}</span> -
                    <span className="ml-1">{entry.item_name}</span> -
                    <span className="ml-1 text-primary">{entry.type_name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{entry.quantity} units @ ₹{entry.rate}</div>
                    <div className="text-sm text-muted-foreground">₹{entry.total_amount.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}