import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { Plus, Trash2, Save, ShoppingCart, Calculator, DollarSign, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
  const [selectedSeller, setSelectedSeller] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [lineItems, setLineItems] = useState<SalesLineItem[]>([]);
  const [quantityReturned, setQuantityReturned] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [lessDiscount, setLessDiscount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewSellerForm, setShowNewSellerForm] = useState(false);
  const [newSellerName, setNewSellerName] = useState("");
  const [newSellerContact, setNewSellerContact] = useState("");

  const { toast } = useToast();

  // Convex queries
  const sellers = useQuery(api.masterData.getSellers, { active_only: true });
  const items = useQuery(api.masterData.getItems, { active_only: true });

  // Get available stock for selected item and date
  const availableStock = useQuery(
    api.sales.getAvailableStock, // Use the correct function for current day stock
    selectedItem && selectedDate
      ? {
          item_id: selectedItem as Id<"items">,
          date: format(selectedDate, "yyyy-MM-dd"),
        }
      : "skip"
  ) as AvailableStock[] | undefined;

  // Get current outstanding balance for selected seller+item
  const outstandingBalance = useQuery(
    api.reports.getSellerOutstanding, // Assuming this exists based on database architecture
    selectedSeller && selectedItem
      ? {
          seller_id: selectedSeller as Id<"sellers">,
          item_id: selectedItem as Id<"items">,
        }
      : "skip"
  ) as OutstandingBalance | undefined;

  // Get today's sales for this date
  const todaysSales = useQuery(
    api.sales.getTodaysSales, // Need to create this
    selectedDate
      ? { date: format(selectedDate, "yyyy-MM-dd") }
      : "skip"
  );

  // Mutations
  const createSalesSession = useMutation(api.sales.createSalesSession);
  const addSalesEntry = useMutation(api.sales.addSalesEntry);
  const createSeller = useMutation(api.masterData.createSeller);

  // Calculate totals
  const totalAmountPurchased = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const totalQuantityPurchased = lineItems.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate outstanding balances
  const currentOutstanding = {
    payment: outstandingBalance?.payment_due || 0,
    quantity: outstandingBalance?.quantity_due || 0
  };

  const newOutstanding = {
    payment: currentOutstanding.payment + totalAmountPurchased - amountPaid - lessDiscount,
    quantity: currentOutstanding.quantity + totalQuantityPurchased - quantityReturned
  };

  // Add new line item
  const addLineItem = () => {
    const newItem: SalesLineItem = {
      id: Date.now().toString(),
      type_name: "",
      quantity: 0,
      sale_rate: 0,
      amount: 0,
    };
    setLineItems([...lineItems, newItem]);
  };

  // Update line item
  const updateLineItem = (id: string, field: keyof SalesLineItem, value: string | number) => {
    setLineItems(items =>
      items.map(item => {
        if (item.id === id) {
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

          return updated;
        }
        return item;
      })
    );
  };

  // Remove line item
  const removeLineItem = (id: string) => {
    setLineItems(items => items.filter(item => item.id !== id));
  };

  // Get available type names for current item
  const getAvailableTypes = () => {
    if (!availableStock) return [];
    return availableStock.filter(stock => stock.closing_stock > 0);
  };

  // Validate line item stock
  const validateStock = (lineItem: SalesLineItem): boolean => {
    return !lineItem.available_stock || lineItem.quantity <= lineItem.available_stock;
  };

  // Handle new seller creation
  const handleAddNewSeller = async () => {
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

      setSelectedSeller(sellerId);
      setNewSellerName("");
      setNewSellerContact("");
      setShowNewSellerForm(false);

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
    if (!selectedSeller || !selectedItem) {
      toast({
        title: "Error",
        description: "Please select both seller and item",
        variant: "destructive",
      });
      return;
    }

    if (lineItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one line item",
        variant: "destructive",
      });
      return;
    }

    // Validate all line items
    for (const item of lineItems) {
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

    setIsLoading(true);

    try {
      const sessionDate = format(selectedDate, "yyyy-MM-dd");

      // Create or get sales session
      const sessionId = await createSalesSession({ session_date: sessionDate });

      // Add sales entry with all line items
      await addSalesEntry({
        sales_session_id: sessionId,
        seller_id: selectedSeller as Id<"sellers">,
        item_id: selectedItem as Id<"items">,
        line_items: lineItems.map(item => ({
          type_name: item.type_name,
          quantity: item.quantity,
          sale_rate: item.sale_rate,
        })),
        quantity_returned: quantityReturned,
        amount_paid: amountPaid,
        less_discount: lessDiscount,
      });

      // Reset form
      setSelectedSeller("");
      setSelectedItem("");
      setLineItems([]);
      setQuantityReturned(0);
      setAmountPaid(0);
      setLessDiscount(0);

      toast({
        title: "Success",
        description: "Sales entry saved successfully",
      });

    } catch (error) {
      console.error("Sales entry error:", error);
      toast({
        title: "Error",
        description: "Failed to save sales entry",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form when seller or item changes
  useEffect(() => {
    setLineItems([]);
    setQuantityReturned(0);
    setAmountPaid(0);
    setLessDiscount(0);
  }, [selectedSeller, selectedItem]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-8 h-8" />
            Sales Entry - {formatDateForIndia(selectedDate)}
          </h1>
          <p className="text-muted-foreground mt-2">
            Record daily sales transactions with real-time stock tracking
          </p>
        </div>
      </div>

      {/* Session Header Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Session Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Transaction Date</Label>
              <DatePicker
                date={selectedDate}
                setDate={(date) => date && setSelectedDate(date)}
                placeholder="Select date"
              />
            </div>

            <div className="space-y-2">
              <Label>Session Status</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {todaysSales && todaysSales.length > 0 ? "Continuing Session" : "New Session"}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quick Stats</Label>
              <div className="text-sm text-muted-foreground">
                Sales today: {todaysSales?.length || 0} transactions
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seller & Item Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Seller Selection */}
            <div className="space-y-2">
              <Label>Seller *</Label>
              <div className="flex gap-2">
                <Select value={selectedSeller} onValueChange={setSelectedSeller}>
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
                  onClick={() => setShowNewSellerForm(!showNewSellerForm)}
                  title="Add new seller"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {showNewSellerForm && (
                <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
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
                    <Button size="sm" onClick={handleAddNewSeller}>
                      Add Seller
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowNewSellerForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
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
          </div>

          {/* Previous Outstanding Display */}
          {selectedSeller && selectedItem && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                <div>
                  <strong>Current Outstanding:</strong> Payment ₹{currentOutstanding.payment.toLocaleString()} |
                  Quantity {currentOutstanding.quantity} units
                  {outstandingBalance?.last_updated && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (Updated: {formatDateForIndia(outstandingBalance.last_updated)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getAvailableTypes().map((stock) => (
                  <div key={stock.type_name} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{stock.type_name}</h4>
                      <Badge variant={stock.closing_stock > 10 ? "default" : "destructive"}>
                        {stock.closing_stock} available
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Avg Rate: ₹{stock.weighted_avg_purchase_rate.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {selectedItem ? "No stock available for this item on selected date" : "Select an item to view stock"}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Purchase Details Entry */}
      {selectedSeller && selectedItem && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Purchase Details</CardTitle>
              <Button onClick={addLineItem} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Type
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lineItems.length > 0 ? (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Sale Rate</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Select
                            value={item.type_name}
                            onValueChange={(value) => updateLineItem(item.id, 'type_name', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
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
                          <div className="text-sm">
                            {item.available_stock ? (
                              <>
                                <div>{item.available_stock} units</div>
                                <div className="text-xs text-muted-foreground">
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
                            onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                            className={!validateStock(item) ? "border-red-500" : ""}
                          />
                          {!validateStock(item) && (
                            <div className="text-xs text-red-500 mt-1">
                              Exceeds available stock
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.sale_rate.toString()}
                            onChange={(e) => updateLineItem(item.id, 'sale_rate', e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">₹{item.amount.toFixed(2)}</div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeLineItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="text-right space-y-1">
                    <div className="text-sm text-muted-foreground">
                      Total Quantity: {totalQuantityPurchased} units
                    </div>
                    <div className="text-lg font-bold">
                      Total Amount: ₹{totalAmountPurchased.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Click "Add Type" to start adding purchase details
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment & Returns Section */}
      {lineItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Payment & Returns
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Quantity Returned (units)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={quantityReturned.toString()}
                  onChange={(e) => setQuantityReturned(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label>Amount Paid (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid.toString()}
                  onChange={(e) => setAmountPaid(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label>Less Discount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={lessDiscount.toString()}
                  onChange={(e) => setLessDiscount(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outstanding Balance Calculation Display */}
      {lineItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Outstanding Balance Calculation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Payment Calculation */}
              <div className="space-y-3">
                <h4 className="font-medium">Payment Outstanding</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Previous Outstanding:</span>
                    <span>₹{currentOutstanding.payment.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Today's Purchase:</span>
                    <span>₹{totalAmountPurchased.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount Paid:</span>
                    <span>-₹{amountPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Less Discount:</span>
                    <span>-₹{lessDiscount.toLocaleString()}</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between font-bold">
                    <span>New Outstanding:</span>
                    <span className={newOutstanding.payment < 0 ? "text-green-600" : "text-red-600"}>
                      ₹{newOutstanding.payment.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quantity Calculation */}
              <div className="space-y-3">
                <h4 className="font-medium">Quantity Outstanding</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Previous Outstanding:</span>
                    <span>{currentOutstanding.quantity} units</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Today's Purchase:</span>
                    <span>{totalQuantityPurchased} units</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity Returned:</span>
                    <span>-{quantityReturned} units</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between font-bold">
                    <span>New Outstanding:</span>
                    <span className={newOutstanding.quantity < 0 ? "text-green-600" : "text-red-600"}>
                      {newOutstanding.quantity} units
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end">
        <Button
          onClick={handleSubmit}
          disabled={isLoading || lineItems.length === 0 || !selectedSeller || !selectedItem}
          size="lg"
        >
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? "Saving..." : "Save Sales Entry"}
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