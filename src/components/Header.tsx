import { Calendar, Wifi } from "lucide-react";

export function Header() {
  const currentDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="h-16 bg-white border-b border-border px-6 flex items-center justify-between shadow-sm">
      {/* App Title */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">M</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">MandiMaster</h1>
          <p className="text-xs text-muted-foreground">Wholesale Market Management</p>
        </div>
      </div>

      {/* Date and Status */}
      <div className="flex items-center space-x-6">
        {/* Current Date */}
        <div className="flex items-center space-x-2 text-sm text-foreground">
          <Calendar className="w-4 h-4" />
          <span>{currentDate}</span>
        </div>

        {/* Sync Status */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-green-600">
            <Wifi className="w-4 h-4" />
            <span className="text-xs font-medium">Online</span>
          </div>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </div>
    </header>
  );
}