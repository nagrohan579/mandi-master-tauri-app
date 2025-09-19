import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { Plus, Trash2, Save, ShoppingCart, Package, ChevronDown, ChevronUp, UserPlus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePicker } from "@/components/DatePicker";
import { useToast } from "@/hooks/use-toast";
import { formatDateForIndia } from "@/lib/utils";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface SalesLineItem {
  id: string;
  type_name: string;
  quantity: number;
  sale_rate: number;
  amount: number;
  available_stock?: number;
  procurement_rate?: number;
}

interface PersonEntry {
  id: string;
  seller_id: string;
  lineItems: SalesLineItem[];
  quantityReturned: number;
  amountPaid: number;
  lessDiscount: number;
  isCollapsed: boolean;
}

interface AvailableStock {
  type_name: string;
  closing_stock: number;
  weighted_avg_purchase_rate: number;
}

interface OutstandingBalance {
  payment_due: number;
  quantity_due: number;
  last_updated: string;
}

export function SalesEntryPage() {
  // State management
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [personEntries, setPersonEntries] = useState<PersonEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewSellerForm, setShowNewSellerForm] = useState<string | null>(null);
  const [newSellerName, setNewSellerName] = useState("");
  const [newSellerContact, setNewSellerContact] = useState("");

  const { toast } = useToast();

  // Convex queries
  const sellers = useQuery(api.masterData.getSellers, { active_only: true });
  const items = useQuery(api.masterData.getItems, { active_only: true });

  // Get available stock for selected item and date
  const availableStock = useQuery(
    api.sales.getAvailableStock,
    selectedItem && selectedDate
      ? {
          item_id: selectedItem as Id<"items">,
          date: format(selectedDate, "yyyy-MM-dd"),
        }
      : "skip"
  ) as AvailableStock[] | undefined;

  // Get today's sales for this date
  const todaysSales = useQuery(
    api.sales.getTodaysSales,
    selectedDate
      ? { date: format(selectedDate, "yyyy-MM-dd") }
      : "skip"
  );

  // Mutations
  const createSalesSession = useMutation(api.sales.createSalesSession);
  const addSalesEntry = useMutation(api.sales.addSalesEntry);
  const createSeller = useMutation(api.masterData.createSeller);

  // Add new person entry
  const addPersonEntry = () => {
    const newEntry: PersonEntry = {
      id: Date.now().toString(),
      seller_id: "",
      lineItems: [],
      quantityReturned: 0,
      amountPaid: 0,
      lessDiscount: 0,
      isCollapsed: false,
    };
    setPersonEntries([...personEntries, newEntry]);
  };

  // Remove person entry
  const removePersonEntry = (id: string) => {
    setPersonEntries(entries => entries.filter(entry => entry.id !== id));
  };

  // Update person entry
  const updatePersonEntry = (id: string, field: keyof PersonEntry, value: any) => {
    setPersonEntries(entries =>
      entries.map(entry =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    );
  };

  // Toggle person entry collapse
  const togglePersonCollapse = (id: string) => {
    setPersonEntries(entries =>
      entries.map(entry =>
        entry.id === id ? { ...entry, isCollapsed: !entry.isCollapsed } : entry
      )
    );
  };

  // Add line item to person entry
  const addLineItemToPerson = (personId: string) => {
    const newItem: SalesLineItem = {
      id: Date.now().toString(),
      type_name: "",
      quantity: 0,
      sale_rate: 0,
      amount: 0,
    };

    setPersonEntries(entries =>
      entries.map(entry =>
        entry.id === personId
          ? { ...entry, lineItems: [...entry.lineItems, newItem] }
          : entry
      )
    );
  };

  // Update line item
  const updateLineItem = (personId: string, itemId: string, field: keyof SalesLineItem, value: string | number) => {
    // Get current state before update for stock comparison
    const currentEntry = personEntries.find(e => e.id === personId);
    const currentItem = currentEntry?.lineItems.find(i => i.id === itemId);
    const previousQuantity = currentItem?.quantity || 0;

    setPersonEntries(entries =>
      entries.map(entry => {
        if (entry.id === personId) {
          const updatedLineItems = entry.lineItems.map(item => {
            if (item.id === itemId) {
              const updated = { ...item, [field]: value };

              // Recalculate amount if quantity or rate changed
              if (field === 'quantity' || field === 'sale_rate') {
                updated.amount = updated.quantity * updated.sale_rate;
              }

              // Add stock info if type changed
              if (field === 'type_name' && availableStock) {
                const stockInfo = availableStock.find(stock => stock.type_name === value);
                if (stockInfo) {
                  updated.available_stock = stockInfo.closing_stock;
                  updated.procurement_rate = stockInfo.weighted_avg_purchase_rate;
                }
              }

              // Check for stock warning immediately for quantity changes
              if (field === 'quantity' && updated.type_name && availableStock) {
                const stockInfo = availableStock.find(stock => stock.type_name === updated.type_name);
                if (stockInfo) {
                  // Calculate what remaining stock will be after this update
                  const currentRemainingStock = calculateRemainingStock();
                  const stockAfterUpdate = currentRemainingStock[updated.type_name] - (updated.quantity - previousQuantity);

                  // Show warning if stock will be depleted
                  if (stockAfterUpdate <= 0 && updated.quantity > previousQuantity) {
                    // Use setTimeout to ensure the toast appears after React has processed the state update
                    setTimeout(() => showStockWarning(updated.type_name), 0);
                  }
                }
              }

              return updated;
            }
            return item;
          });

          return { ...entry, lineItems: updatedLineItems };
        }
        return entry;
      })
    );
  };

  // Remove line item
  const removeLineItem = (personId: string, itemId: string) => {
    setPersonEntries(entries =>
      entries.map(entry =>
        entry.id === personId
          ? { ...entry, lineItems: entry.lineItems.filter(item => item.id !== itemId) }
          : entry
      )
    );
  };

  // Calculate real-time remaining stock for UI display
  const calculateRemainingStock = () => {
    if (!availableStock) return {};

    const stockMap: { [typeName: string]: number } = {};

    // Initialize with original stock
    availableStock.forEach(stock => {
      stockMap[stock.type_name] = stock.closing_stock;
    });

    // Subtract quantities from all person entries
    personEntries.forEach(entry => {
      entry.lineItems.forEach(item => {
        if (item.type_name && stockMap[item.type_name] !== undefined) {
          stockMap[item.type_name] = Math.max(0, stockMap[item.type_name] - item.quantity);
        }
      });
    });

    return stockMap;
  };

  // Get available type names for current item with real-time stock
  const getAvailableTypes = () => {
    if (!availableStock) return [];
    const remainingStock = calculateRemainingStock();

    return availableStock.map(stock => ({
      ...stock,
      remaining_stock: remainingStock[stock.type_name] || 0
    }));
  };

  // Validate line item stock using real-time calculations
  const validateStock = (lineItem: SalesLineItem): boolean => {
    if (!lineItem.type_name || !availableStock) return true;

    const remainingStock = calculateRemainingStock();
    const currentRemaining = remainingStock[lineItem.type_name];

    // Add back the current item's quantity to check if the new quantity is valid
    const availableForThisItem = currentRemaining + lineItem.quantity;
    return lineItem.quantity <= availableForThisItem;
  };

  // Check if a type is completely out of stock
  const isTypeOutOfStock = (typeName: string): boolean => {
    const remainingStock = calculateRemainingStock();
    return (remainingStock[typeName] || 0) <= 0;
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

  // Calculate totals for a person entry
  const calculatePersonTotals = (entry: PersonEntry) => {
    const totalAmount = entry.lineItems.reduce((sum, item) => sum + item.amount, 0);
    const totalQuantity = entry.lineItems.reduce((sum, item) => sum + item.quantity, 0);
    return { totalAmount, totalQuantity };
  };

  // Handle new seller creation
  const handleAddNewSeller = async (personId: string) => {
    if (!newSellerName.trim()) {
      toast({
        title: "Error",
        description: "Seller name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const sellerId = await createSeller({
        name: newSellerName,
        contact_info: newSellerContact || undefined,
        is_active: true,
      });

      updatePersonEntry(personId, "seller_id", sellerId);
      setNewSellerName("");
      setNewSellerContact("");
      setShowNewSellerForm(null);

      toast({
        title: "Success",
        description: "New seller added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add seller",
        variant: "destructive",
      });
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validation
    if (!selectedItem) {
      toast({
        title: "Error",
        description: "Please select an item",
        variant: "destructive",
      });
      return;
    }

    if (personEntries.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one person entry",
        variant: "destructive",
      });
      return;
    }

    // Validate all person entries
    for (const entry of personEntries) {
      if (!entry.seller_id) {
        toast({
          title: "Error",
          description: "Please select seller for all entries",
          variant: "destructive",
        });
        return;
      }

      if (entry.lineItems.length === 0) {
        toast({
          title: "Error",
          description: "Please add line items for all entries",
          variant: "destructive",
        });
        return;
      }

      // Validate all line items
      for (const item of entry.lineItems) {
        if (!item.type_name || item.quantity <= 0 || item.sale_rate <= 0) {
          toast({
            title: "Error",
            description: "Please fill all line item details",
            variant: "destructive",
          });
          return;
        }

        if (!validateStock(item)) {
          toast({
            title: "Error",
            description: `Insufficient stock for ${item.type_name}. Available: ${item.available_stock}`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    setIsLoading(true);

    try {
      const sessionDate = format(selectedDate, "yyyy-MM-dd");

      // Create or get sales session
      const sessionId = await createSalesSession({ session_date: sessionDate });

      // Process each person entry
      for (const entry of personEntries) {
        await addSalesEntry({
          sales_session_id: sessionId,
          seller_id: entry.seller_id as Id<"sellers">,
          item_id: selectedItem as Id<"items">,
          line_items: entry.lineItems.map(item => ({
            type_name: item.type_name,
            quantity: item.quantity,
            sale_rate: item.sale_rate,
          })),
          quantity_returned: entry.quantityReturned,
          amount_paid: entry.amountPaid,
          less_discount: entry.lessDiscount,
        });
      }

      // Reset form
      setSelectedItem("");
      setPersonEntries([]);

      toast({
        title: "Success",
        description: `${personEntries.length} sales entries saved successfully`,
      });

    } catch (error) {
      console.error("Sales entry error:", error);
      toast({
        title: "Error",
        description: "Failed to save sales entries",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form when date changes
  useEffect(() => {
    setPersonEntries([]);
  }, [selectedDate]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-8 h-8" />
            Sales Entry - {formatDateForIndia(selectedDate)}
          </h1>
          <p className="text-muted-foreground mt-1">
            Record sales to multiple people for the same item
          </p>
        </div>
      </div>

      {/* Session Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Session Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Transaction Date</Label>
              <DatePicker
                date={selectedDate}
                setDate={(date) => date && setSelectedDate(date)}
                placeholder="Select date"
              />
            </div>

            <div className="space-y-2">
              <Label>Item for this Session *</Label>
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

            <div className="space-y-2">
              <Label>Session Status</Label>
              <Badge variant="outline">
                {todaysSales && todaysSales.length > 0 ? "Continuing Session" : "New Session"}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label>Today's Sales</Label>
              <div className="text-sm text-muted-foreground">
                {todaysSales?.length || 0} transactions
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Stock Display */}
      {selectedItem && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Available Stock - {formatDateForIndia(selectedDate)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {availableStock && availableStock.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {getAvailableTypes().map((stock) => (
                  <div key={stock.type_name} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-sm">{stock.type_name}</h4>
                      <div className="flex flex-col items-end text-xs">
                        <Badge variant={stock.remaining_stock > 10 ? "default" : stock.remaining_stock > 0 ? "secondary" : "destructive"} className="text-xs mb-1">
                          {stock.remaining_stock} left
                        </Badge>
                        {stock.remaining_stock !== stock.closing_stock && (
                          <span className="text-muted-foreground">
                            (was {stock.closing_stock})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Rate: ₹{stock.weighted_avg_purchase_rate.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                {selectedItem ? "No stock available for this item on selected date" : "Select an item to view stock"}
              </div>
            )}

            {/* Out of Stock Warning */}
            {availableStock && availableStock.length > 0 && (
              (() => {
                const outOfStockTypes = getAvailableTypes().filter(stock => stock.remaining_stock <= 0);
                if (outOfStockTypes.length > 0) {
                  return (
                    <Alert className="mt-4 border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        <strong>Out of Stock:</strong> {outOfStockTypes.map(stock => stock.type_name).join(", ")}
                      </AlertDescription>
                    </Alert>
                  );
                }
                return null;
              })()
            )}
          </CardContent>
        </Card>
      )}

      {/* Multiple Person Entries */}
      {selectedItem && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Person Entries ({personEntries.length})
              </CardTitle>
              <Button onClick={addPersonEntry} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Person
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {personEntries.length > 0 ? (
              <div className="space-y-4">
                {personEntries.map((entry, index) => {
                  const totals = calculatePersonTotals(entry);
                  return (
                    <Collapsible key={entry.id} open={!entry.isCollapsed}>
                      <div className="border rounded-lg">
                        <CollapsibleTrigger
                          onClick={() => togglePersonCollapse(entry.id)}
                          className="w-full p-4 flex items-center justify-between hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-medium">Person {index + 1}</span>
                            {entry.seller_id && sellers && (
                              <span className="text-sm text-muted-foreground">
                                - {sellers.find(s => s._id === entry.seller_id)?.name}
                              </span>
                            )}
                            {totals.totalAmount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                ₹{totals.totalAmount.toLocaleString()}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                removePersonEntry(entry.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            {entry.isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="p-4 border-t space-y-4">
                            {/* Seller Selection */}
                            <div className="space-y-2">
                              <Label>Seller *</Label>
                              <div className="flex gap-2">
                                <Select
                                  value={entry.seller_id}
                                  onValueChange={(value) => updatePersonEntry(entry.id, "seller_id", value)}
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select seller" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {sellers?.map((seller) => (
                                      <SelectItem key={seller._id} value={seller._id}>
                                        {seller.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setShowNewSellerForm(entry.id)}
                                  title="Add new seller"
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>

                              {/* New Seller Form */}
                              {showNewSellerForm === entry.id && (
                                <div className="p-3 border rounded-lg space-y-3 bg-muted/50">
                                  <div className="space-y-2">
                                    <Label>New Seller Name *</Label>
                                    <Input
                                      value={newSellerName}
                                      onChange={(e) => setNewSellerName(e.target.value)}
                                      placeholder="Enter seller name"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Contact Info (Optional)</Label>
                                    <Input
                                      value={newSellerContact}
                                      onChange={(e) => setNewSellerContact(e.target.value)}
                                      placeholder="Phone, address, etc."
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => handleAddNewSeller(entry.id)}>
                                      Add Seller
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setShowNewSellerForm(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Line Items */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label>Purchase Details</Label>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addLineItemToPerson(entry.id)}
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Add Type
                                </Button>
                              </div>

                              {entry.lineItems.length > 0 && (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-32">Type</TableHead>
                                      <TableHead className="w-20">Available</TableHead>
                                      <TableHead className="w-24">Quantity</TableHead>
                                      <TableHead className="w-24">Rate</TableHead>
                                      <TableHead className="w-24">Amount</TableHead>
                                      <TableHead className="w-16">Action</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {entry.lineItems.map((item) => (
                                      <TableRow key={item.id}>
                                        <TableCell>
                                          <Select
                                            value={item.type_name}
                                            onValueChange={(value) => updateLineItem(entry.id, item.id, 'type_name', value)}
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {getAvailableTypes().map((stock) => (
                                                <SelectItem key={stock.type_name} value={stock.type_name}>
                                                  {stock.type_name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                        <TableCell>
                                          <div className="text-xs">
                                            {item.available_stock ? (
                                              <>
                                                <div className={`${isTypeOutOfStock(item.type_name) ? 'text-red-600 font-medium' : ''}`}>
                                                  {(() => {
                                                    const remainingStock = calculateRemainingStock();
                                                    const remaining = remainingStock[item.type_name] + item.quantity; // Add back current item quantity
                                                    return remaining;
                                                  })()} left
                                                </div>
                                                <div className="text-muted-foreground">
                                                  @₹{item.procurement_rate?.toFixed(2)}
                                                </div>
                                              </>
                                            ) : (
                                              "-"
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.quantity.toString()}
                                            onChange={(e) => updateLineItem(entry.id, item.id, 'quantity', e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                            className={!validateStock(item) ? "border-red-500" : ""}
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.sale_rate.toString()}
                                            onChange={(e) => updateLineItem(entry.id, item.id, 'sale_rate', e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <div className="font-medium text-sm">₹{item.amount.toFixed(2)}</div>
                                        </TableCell>
                                        <TableCell>
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => removeLineItem(entry.id, item.id)}
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>

                            {/* Payment & Returns */}
                            {entry.lineItems.length > 0 && (
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                  <Label>Total Amount</Label>
                                  <div className="p-2 bg-muted rounded text-sm font-medium">
                                    ₹{totals.totalAmount.toLocaleString()}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>Quantity Returned</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={entry.quantityReturned.toString()}
                                    onChange={(e) => updatePersonEntry(entry.id, "quantityReturned", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Amount Paid</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={entry.amountPaid.toString()}
                                    onChange={(e) => updatePersonEntry(entry.id, "amountPaid", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Less Discount</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={entry.lessDiscount.toString()}
                                    onChange={(e) => updatePersonEntry(entry.id, "lessDiscount", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Click "Add Person" to start adding sales entries
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end">
        <Button
          onClick={handleSubmit}
          disabled={isLoading || personEntries.length === 0 || !selectedItem}
          size="lg"
        >
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? "Saving..." : `Save ${personEntries.length} Entries`}
        </Button>
      </div>

      {/* Today's Sales Summary */}
      {todaysSales && todaysSales.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Today's Sales Summary - {formatDateForIndia(selectedDate)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Amount Paid</TableHead>
                  <TableHead>Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todaysSales.map((sale: any) => (
                  <TableRow key={sale._id}>
                    <TableCell>{sale.seller_name || "Unknown"}</TableCell>
                    <TableCell>{sale.item_name || "Unknown"}</TableCell>
                    <TableCell>₹{sale.total_amount_purchased?.toLocaleString()}</TableCell>
                    <TableCell>₹{sale.amount_paid?.toLocaleString()}</TableCell>
                    <TableCell>₹{sale.final_payment_outstanding?.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}