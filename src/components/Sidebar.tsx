import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  FileText,
  ShoppingCart,
  DollarSign,
  Package,
  RotateCcw,
  BarChart3,
  FileBarChart,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  Settings,
  Edit,
  Trash2,
  Calculator,
  Users,
  Building2,
  Apple,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  children?: NavigationItem[];
}

const navigationItems: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Home,
    path: "/",
  },
  {
    id: "daily-operations",
    label: "Daily Operations",
    icon: FileText,
    children: [
      { id: "procurement", label: "Procurement Entry", icon: ShoppingCart, path: "/procurement" },
      { id: "sales", label: "Sales Entry", icon: DollarSign, path: "/sales" },
      { id: "stock-summary", label: "Stock Summary", icon: Package, path: "/stock-summary" },
      { id: "end-of-day", label: "End of Day", icon: RotateCcw, path: "/end-of-day" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    children: [
      { id: "daily-dues", label: "Daily Dues Report", icon: FileBarChart, path: "/reports/daily-dues" },
      { id: "ledger", label: "Ledger Report", icon: BookOpen, path: "/reports/ledger" },
      { id: "stock-report", label: "Stock Report", icon: TrendingUp, path: "/reports/stock" },
      { id: "outstanding", label: "Outstanding Summary", icon: AlertTriangle, path: "/reports/outstanding" },
      { id: "profit", label: "Profit Analysis", icon: TrendingUp, path: "/reports/profit" },
    ],
  },
  {
    id: "data-management",
    label: "Data Management",
    icon: Settings,
    children: [
      { id: "update-entries", label: "Update Entries", icon: Edit, path: "/data/update" },
      { id: "delete-entries", label: "Delete Entries", icon: Trash2, path: "/data/delete" },
      { id: "recalculate", label: "Recalculate All", icon: Calculator, path: "/data/recalculate" },
    ],
  },
  {
    id: "opening-balances",
    label: "Opening Balances",
    icon: FileText,
    children: [
      { id: "seller-balances", label: "Seller Balances", icon: Users, path: "/balances/sellers" },
      { id: "supplier-balances", label: "Supplier Balances", icon: Building2, path: "/balances/suppliers" },
    ],
  },
  {
    id: "master-data",
    label: "Master Data",
    icon: Users,
    children: [
      { id: "sellers", label: "Sellers", icon: Users, path: "/master/sellers" },
      { id: "suppliers", label: "Suppliers", icon: Building2, path: "/master/suppliers" },
      { id: "items", label: "Items", icon: Apple, path: "/master/items" },
    ],
  },
  {
    id: "sync-status",
    label: "Sync Status",
    icon: RefreshCw,
    path: "/sync-status",
  },
];

export function Sidebar() {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const handleItemClick = (item: NavigationItem) => {
    if (item.children) {
      // Toggle expansion for parent items
      setExpandedItem(expandedItem === item.id ? null : item.id);
    } else if (item.path) {
      // Navigate to the page for leaf items
      navigate(item.path);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const renderNavigationItem = (item: NavigationItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItem === item.id;
    const isItemActive = item.path ? isActive(item.path) : false;

    return (
      <div key={item.id}>
        {/* Parent Item */}
        <button
          onClick={() => handleItemClick(item)}
          className={cn(
            "w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
            "hover:bg-accent hover:text-accent-foreground",
            isItemActive && "bg-primary text-primary-foreground",
            level === 0 ? "mx-2" : "mx-6"
          )}
        >
          <item.icon className="w-4 h-4 mr-3 flex-shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {hasChildren && (
            <div className="flex-shrink-0 ml-2">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
          )}
        </button>

        {/* Children Items */}
        {hasChildren && (
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="py-1">
              {item.children!.map((child) => (
                <div key={child.id} className="ml-6 mr-3">
                  <button
                    onClick={() => child.path && navigate(child.path)}
                    className={cn(
                      "w-full flex items-center px-3 py-2 text-sm rounded-lg transition-all duration-200",
                      "hover:bg-accent hover:text-accent-foreground",
                      child.path && isActive(child.path) && "bg-primary text-primary-foreground"
                    )}
                  >
                    <child.icon className="w-4 h-4 mr-3 flex-shrink-0" />
                    <span className="text-left">{child.label}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-72 bg-card border-r border-border overflow-y-auto">
      <div className="p-4">
        <nav className="space-y-1">
          {navigationItems.map((item) => renderNavigationItem(item))}
        </nav>
      </div>
    </aside>
  );
}