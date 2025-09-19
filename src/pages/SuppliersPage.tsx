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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateForIndia } from "@/lib/utils";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface Supplier {
  _id: Id<"suppliers">;
  name: string;
  contact_info?: string;
  is_active: boolean;
  _creationTime: number;
}

export function SuppliersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<Id<"suppliers">>>(new Set());

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    contact_info: "",
    is_active: true,
  });

  // Convex queries and mutations
  const suppliers = useQuery(api.masterData.getSuppliers, {});
  const createSupplier = useMutation(api.masterData.createSupplier);
  const updateSupplier = useMutation(api.masterData.updateSupplier);

  const filteredSuppliers = suppliers?.filter((supplier) => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.contact_info?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" ||
                         (statusFilter === "active" && supplier.is_active) ||
                         (statusFilter === "inactive" && !supplier.is_active);
    return matchesSearch && matchesStatus;
  }) || [];

  const activeCount = suppliers?.filter(s => s.is_active).length || 0;
  const totalCount = suppliers?.length || 0;

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert("Supplier name is required");
      return;
    }

    try {
      if (editingSupplier) {
        await updateSupplier({
          id: editingSupplier._id,
          name: formData.name,
          contact_info: formData.contact_info || undefined,
          is_active: formData.is_active,
        });
      } else {
        await createSupplier({
          name: formData.name,
          contact_info: formData.contact_info || undefined,
          is_active: formData.is_active,
        });
      }

      // Reset form and close modal
      setFormData({ name: "", contact_info: "", is_active: true });
      setIsAddModalOpen(false);
      setEditingSupplier(null);
    } catch (error) {
      console.error("Error saving supplier:", error);
      alert("Error saving supplier. Please try again.");
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_info: supplier.contact_info || "",
      is_active: supplier.is_active,
    });
    setIsAddModalOpen(true);
  };

  const handleToggleStatus = async (supplier: Supplier) => {
    try {
      await updateSupplier({
        id: supplier._id,
        is_active: !supplier.is_active,
      });
    } catch (error) {
      console.error("Error updating supplier status:", error);
      alert("Error updating supplier status. Please try again.");
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSuppliers(new Set(filteredSuppliers.map(s => s._id)));
    } else {
      setSelectedSuppliers(new Set());
    }
  };

  const handleSelectSupplier = (supplierId: Id<"suppliers">, checked: boolean) => {
    const newSelected = new Set(selectedSuppliers);
    if (checked) {
      newSelected.add(supplierId);
    } else {
      newSelected.delete(supplierId);
    }
    setSelectedSuppliers(newSelected);
  };

  const handleBulkStatusChange = async (status: boolean) => {
    try {
      for (const supplierId of selectedSuppliers) {
        await updateSupplier({
          id: supplierId,
          is_active: status,
        });
      }
      setSelectedSuppliers(new Set());
    } catch (error) {
      console.error("Error updating suppliers:", error);
      alert("Error updating suppliers. Please try again.");
    }
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingSupplier(null);
    setFormData({ name: "", contact_info: "", is_active: true });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Suppliers Management</h1>
          <p className="text-muted-foreground mt-1">Manage vendors who supply fruits and vegetables</p>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              Add New Supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Supplier Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter supplier name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Contact Information</Label>
                <Textarea
                  id="contact"
                  value={formData.contact_info}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_info: e.target.value }))}
                  placeholder="Phone number, address, etc."
                  rows={3}
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
                  {editingSupplier ? "Update Supplier" : "Add Supplier"}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inactive Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalCount - activeCount}</div>
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
                  placeholder="Search suppliers by name or contact..."
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
                <SelectItem value="all">All Suppliers</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedSuppliers.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedSuppliers.size} supplier(s) selected
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange(true)}>
                  Activate Selected
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange(false)}>
                  Deactivate Selected
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedSuppliers(new Set())}>
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
                    checked={selectedSuppliers.size === filteredSuppliers.length && filteredSuppliers.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchTerm || statusFilter !== "all" ? "No suppliers found matching your criteria" : "No suppliers yet. Add your first supplier to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier._id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedSuppliers.has(supplier._id)}
                        onCheckedChange={(checked) => handleSelectSupplier(supplier._id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{supplier.contact_info || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={supplier.is_active ? "default" : "secondary"}>
                        {supplier.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateForIndia(supplier._creationTime)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(supplier)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(supplier)}
                        >
                          {supplier.is_active ? "Deactivate" : "Activate"}
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