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

interface Seller {
  _id: Id<"sellers">;
  name: string;
  contact_info?: string;
  is_active: boolean;
  _creationTime: number;
}

export function SellersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [selectedSellers, setSelectedSellers] = useState<Set<Id<"sellers">>>(new Set());

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    contact_info: "",
    is_active: true,
  });

  // Convex queries and mutations
  const sellers = useQuery(api.masterData.getSellers, {});
  const createSeller = useMutation(api.masterData.createSeller);
  const updateSeller = useMutation(api.masterData.updateSeller);

  const filteredSellers = sellers?.filter((seller) => {
    const matchesSearch = seller.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         seller.contact_info?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" ||
                         (statusFilter === "active" && seller.is_active) ||
                         (statusFilter === "inactive" && !seller.is_active);
    return matchesSearch && matchesStatus;
  }) || [];

  const activeCount = sellers?.filter(s => s.is_active).length || 0;
  const totalCount = sellers?.length || 0;

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert("Seller name is required");
      return;
    }

    try {
      if (editingSeller) {
        await updateSeller({
          id: editingSeller._id,
          name: formData.name,
          contact_info: formData.contact_info || undefined,
          is_active: formData.is_active,
        });
      } else {
        await createSeller({
          name: formData.name,
          contact_info: formData.contact_info || undefined,
          is_active: formData.is_active,
        });
      }

      // Reset form and close modal
      setFormData({ name: "", contact_info: "", is_active: true });
      setIsAddModalOpen(false);
      setEditingSeller(null);
    } catch (error) {
      console.error("Error saving seller:", error);
      alert("Error saving seller. Please try again.");
    }
  };

  const handleEdit = (seller: Seller) => {
    setEditingSeller(seller);
    setFormData({
      name: seller.name,
      contact_info: seller.contact_info || "",
      is_active: seller.is_active,
    });
    setIsAddModalOpen(true);
  };

  const handleToggleStatus = async (seller: Seller) => {
    try {
      await updateSeller({
        id: seller._id,
        is_active: !seller.is_active,
      });
    } catch (error) {
      console.error("Error updating seller status:", error);
      alert("Error updating seller status. Please try again.");
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSellers(new Set(filteredSellers.map(s => s._id)));
    } else {
      setSelectedSellers(new Set());
    }
  };

  const handleSelectSeller = (sellerId: Id<"sellers">, checked: boolean) => {
    const newSelected = new Set(selectedSellers);
    if (checked) {
      newSelected.add(sellerId);
    } else {
      newSelected.delete(sellerId);
    }
    setSelectedSellers(newSelected);
  };

  const handleBulkStatusChange = async (status: boolean) => {
    try {
      for (const sellerId of selectedSellers) {
        await updateSeller({
          id: sellerId,
          is_active: status,
        });
      }
      setSelectedSellers(new Set());
    } catch (error) {
      console.error("Error updating sellers:", error);
      alert("Error updating sellers. Please try again.");
    }
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingSeller(null);
    setFormData({ name: "", contact_info: "", is_active: true });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sellers Management</h1>
          <p className="text-muted-foreground mt-1">Manage fruit/vegetable shop owners and customers</p>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              Add New Seller
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSeller ? "Edit Seller" : "Add New Seller"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Seller Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter seller name"
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
                  {editingSeller ? "Update Seller" : "Add Seller"}
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sellers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Sellers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inactive Sellers</CardTitle>
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
                  placeholder="Search sellers by name or contact..."
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
                <SelectItem value="all">All Sellers</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedSellers.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedSellers.size} seller(s) selected
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange(true)}>
                  Activate Selected
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange(false)}>
                  Deactivate Selected
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedSellers(new Set())}>
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
                    checked={selectedSellers.size === filteredSellers.length && filteredSellers.length > 0}
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
              {filteredSellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchTerm || statusFilter !== "all" ? "No sellers found matching your criteria" : "No sellers yet. Add your first seller to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSellers.map((seller) => (
                  <TableRow key={seller._id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedSellers.has(seller._id)}
                        onCheckedChange={(checked) => handleSelectSeller(seller._id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{seller.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{seller.contact_info || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={seller.is_active ? "default" : "secondary"}>
                        {seller.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateForIndia(seller._creationTime)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(seller)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(seller)}
                        >
                          {seller.is_active ? "Deactivate" : "Activate"}
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