import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RestaurantConfigProvider } from "./contexts/RestaurantConfigContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ReservationsManager from "./pages/admin/ReservationsManager";
import TablesManager from "./pages/admin/TablesManager";
import CombinationsManager from "./pages/admin/CombinationsManager";
import ScheduleManager from "./pages/admin/ScheduleManager";
import RestaurantSettings from "./pages/admin/RestaurantSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RestaurantConfigProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="reservations" element={<ReservationsManager />} />
              <Route path="tables" element={<TablesManager />} />
              <Route path="combinations" element={<CombinationsManager />} />
              <Route path="schedules" element={<ScheduleManager />} />
              <Route path="settings" element={<RestaurantSettings />} />
            </Route>
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </RestaurantConfigProvider>
  </QueryClientProvider>
);

export default App;
