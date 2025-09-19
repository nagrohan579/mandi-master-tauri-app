import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Plus, Search, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateForIndia } from "@/lib/utils";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface Item {
  _id: Id<"items">;
  name: string;
  quantity_type: "crates" | "weight" | "mixed";
  unit_name: string;
  is_active: boolean;
  _creationTime: number;
}

const QUANTITY_TYPE_OPTIONS = [
  { value: "crates", label: "Crates" },
  { value: "weight", label: "Weight" },
  { value: "mixed", label: "Mixed" },
] as const;

export function ItemsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "crates" | "weight" | "mixed">("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<Id<"items">>>(new Set());

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    quantity_type: "crates" | "weight" | "mixed";
    unit_name: string;
    is_active: boolean;
  }>({
    name: "",
    quantity_type: "crates",
    unit_name: "",
    is_active: true,
  });

  // Convex queries and mutations
  const items = useQuery(api.masterData.getItems, {});
  const createItem = useMutation(api.masterData.createItem);
  const updateItem = useMutation(api.masterData.updateItem);

  const filteredItems = items?.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.unit_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" ||
                         (statusFilter === "active" && item.is_active) ||
                         (statusFilter === "inactive" && !item.is_active);
    const matchesType = typeFilter === "all" || item.quantity_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  }) || [];

  const activeCount = items?.filter(i => i.is_active).length || 0;
  const totalCount = items?.length || 0;
  const cratesCount = items?.filter(i => i.quantity_type === "crates").length || 0;
  const weightCount = items?.filter(i => i.quantity_type === "weight").length || 0;

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.unit_name.trim()) {
      alert("Item name and unit name are required");
      return;
    }

    try {
      if (editingItem) {
        await updateItem({
          id: editingItem._id,
          name: formData.name,
          quantity_type: formData.quantity_type,
          unit_name: formData.unit_name,
          is_active: formData.is_active,
        });
      } else {
        await createItem({
          name: formData.name,
          quantity_type: formData.quantity_type,
          unit_name: formData.unit_name,
          is_active: formData.is_active,
        });
      }

      // Reset form and close modal
      setFormData({ name: "", quantity_type: "crates", unit_name: "", is_active: true });
      setIsAddModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Error saving item:", error);
      alert("Error saving item. Please try again.");
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      quantity_type: item.quantity_type,
      unit_name: item.unit_name,
      is_active: item.is_active,
    });
    setIsAddModalOpen(true);
  };

  const handleToggleStatus = async (item: Item) => {
    try {
      await updateItem({
        id: item._id,
        is_active: !item.is_active,
      });
    } catch (error) {
      console.error("Error updating item status:", error);
      alert("Error updating item status. Please try again.");
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(filteredItems.map(i => i._id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (itemId: Id<"items">, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleBulkStatusChange = async (status: boolean) => {
    try {
      for (const itemId of selectedItems) {
        await updateItem({
          id: itemId,
          is_active: status,
        });
      }
      setSelectedItems(new Set());
    } catch (error) {
      console.error("Error updating items:", error);
      alert("Error updating items. Please try again.");
    }
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingItem(null);
    setFormData({ name: "", quantity_type: "crates", unit_name: "", is_active: true });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Items Management</h1>
          <p className="text-muted-foreground mt-1">Manage fruits, vegetables and their measurement properties</p>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              Add New Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Item" : "Add New Item"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Banana, Tomato, Onion"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity_type">Quantity Type *</Label>
                <Select
                  value={formData.quantity_type}
                  onValueChange={(value: "crates" | "weight" | "mixed") => setFormData(prev => ({ ...prev, quantity_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select quantity type" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUANTITY_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_name">Unit Name *</Label>
                <Input
                  id="unit_name"
                  value={formData.unit_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, unit_name: e.target.value }))}
                  placeholder="e.g., crates, kg, quintal"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked as boolean }))}
                />
                <Label htmlFor="active">Active</Label>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSubmit} className="flex-1">
                  {editingItem ? "Update Item" : "Add Item"}
                </Button>
                <Button variant="outline" onClick={closeModal} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Crate Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{cratesCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Weight Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{weightCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search items by name or unit..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(value: "all" | "crates" | "weight" | "mixed") => setTypeFilter(value)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="crates">Crates Only</SelectItem>
                <SelectItem value="weight">Weight Only</SelectItem>
                <SelectItem value="mixed">Mixed Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedItems.size} item(s) selected
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange(true)}>
                  Activate Selected
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange(false)}>
                  Deactivate Selected
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedItems(new Set())}>
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Quantity Type</TableHead>
                <TableHead>Unit Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchTerm || statusFilter !== "all" || typeFilter !== "all" ? "No items found matching your criteria" : "No items yet. Add your first item to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.has(item._id)}
                        onCheckedChange={(checked) => handleSelectItem(item._id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {item.quantity_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.unit_name}</TableCell>
                    <TableCell>
                      <Badge variant={item.is_active ? "default" : "secondary"}>
                        {item.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateForIndia(item._creationTime)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(item)}
                        >
                          {item.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}