import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { ProcurementPage } from "./pages/ProcurementPage";
import { SalesEntryPage } from "./pages/SalesEntryPage";
import { SellersPage } from "./pages/SellersPage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { ItemsPage } from "./pages/ItemsPage";
import { UpdateEntriesPage } from "./pages/UpdateEntriesPage";
import { DeleteEntriesPage } from "./pages/DeleteEntriesPage";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="procurement" element={<ProcurementPage />} />
          <Route path="sales" element={<SalesEntryPage />} />
          <Route path="stock-summary" element={<PlaceholderPage />} />
          <Route path="end-of-day" element={<PlaceholderPage />} />
          <Route path="reports/daily-dues" element={<PlaceholderPage />} />
          <Route path="reports/ledger" element={<PlaceholderPage />} />
          <Route path="reports/stock" element={<PlaceholderPage />} />
          <Route path="reports/outstanding" element={<PlaceholderPage />} />
          <Route path="reports/profit" element={<PlaceholderPage />} />
          <Route path="data/update" element={<UpdateEntriesPage />} />
          <Route path="data/delete" element={<DeleteEntriesPage />} />
          <Route path="data/recalculate" element={<PlaceholderPage />} />
          <Route path="balances/sellers" element={<PlaceholderPage />} />
          <Route path="balances/suppliers" element={<PlaceholderPage />} />
          <Route path="master/sellers" element={<SellersPage />} />
          <Route path="master/suppliers" element={<SuppliersPage />} />
          <Route path="master/items" element={<ItemsPage />} />
          <Route path="sync-status" element={<PlaceholderPage />} />
        </Route>
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
