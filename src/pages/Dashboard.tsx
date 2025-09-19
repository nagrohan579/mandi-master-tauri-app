import { CheckCircle, Clock, XCircle, Package, TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusCardProps {
  title: string;
  status: "complete" | "progress" | "pending";
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

function StatusCard({ title, status, value, icon: Icon, description }: StatusCardProps) {
  const statusColors = {
    complete: "border-green-200 bg-green-50 text-green-800",
    progress: "border-yellow-200 bg-yellow-50 text-yellow-800",
    pending: "border-red-200 bg-red-50 text-red-800",
  };

  const statusIcons = {
    complete: CheckCircle,
    progress: Clock,
    pending: XCircle,
  };

  const StatusIcon = statusIcons[status];

  return (
    <div className={cn("rounded-lg border-2 p-4", statusColors[status])}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Icon className="w-8 h-8" />
          <div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-2xl font-bold">{value}</p>
            {description && <p className="text-sm opacity-75">{description}</p>}
          </div>
        </div>
        <StatusIcon className="w-6 h-6" />
      </div>
    </div>
  );
}

interface StockCardProps {
  item: string;
  quantity: string;
  details?: string;
}

function StockCard({ item, quantity, details }: StockCardProps) {
  return (
    <div className="bg-white border border-border rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-foreground">{item}</h4>
          <p className="text-2xl font-bold text-primary">{quantity}</p>
          {details && <p className="text-sm text-muted-foreground">{details}</p>}
        </div>
        <Package className="w-8 h-8 text-muted-foreground" />
      </div>
    </div>
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

function QuickAction({ title, description, icon: Icon, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow text-left w-full"
    >
      <div className="flex items-center space-x-3">
        <div className="bg-primary/10 p-2 rounded-lg">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h4 className="font-semibold text-foreground">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  );
}

export function Dashboard() {
  const currentDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of today's operations - {currentDate}</p>
      </div>

      {/* Today's Work Status */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">Today's Work Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusCard
            title="Procurement Status"
            status="complete"
            value="100 crates"
            icon={Package}
            description="All procurement completed"
          />
          <StatusCard
            title="Sales Progress"
            status="progress"
            value="67 crates"
            icon={TrendingUp}
            description="8 entries - 33 crates remaining"
          />
          <StatusCard
            title="Payments Status"
            status="pending"
            value="₹45,000"
            icon={AlertTriangle}
            description="Pending collections"
          />
        </div>
      </section>

      {/* Stock Status */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">Current Stock Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StockCard
            item="Banana"
            quantity="33 crates"
            details="Type X: 25, Type Y: 8"
          />
          <StockCard
            item="Papaya"
            quantity="45 kg"
            details="remaining"
          />
          <StockCard
            item="Mango"
            quantity="28 crates"
            details="Alphonso: 15, Local: 13"
          />
          <StockCard
            item="Tomato"
            quantity="52 kg"
            details="Grade A: 30kg, Grade B: 22kg"
          />
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickAction
            title="New Sale Entry"
            description="Record a new sale transaction"
            icon={TrendingUp}
            onClick={() => console.log("Navigate to sales")}
          />
          <QuickAction
            title="Stock Summary"
            description="View current stock levels"
            icon={Package}
            onClick={() => console.log("Navigate to stock")}
          />
          <QuickAction
            title="Daily Report"
            description="Generate today's summary"
            icon={CheckCircle}
            onClick={() => console.log("Navigate to reports")}
          />
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">Recent Activity</h2>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div>
                <p className="font-medium">Sale to Rajesh Traders</p>
                <p className="text-sm text-muted-foreground">Banana - 15 crates @ ₹350/crate</p>
              </div>
              <span className="text-sm text-muted-foreground">2 hours ago</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div>
                <p className="font-medium">Procurement from Farmer Co-op</p>
                <p className="text-sm text-muted-foreground">Mango - 25 crates @ ₹280/crate</p>
              </div>
              <span className="text-sm text-muted-foreground">4 hours ago</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">Payment Received</p>
                <p className="text-sm text-muted-foreground">₹12,500 from Krishna Suppliers</p>
              </div>
              <span className="text-sm text-muted-foreground">6 hours ago</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}