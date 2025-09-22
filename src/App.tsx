import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RestaurantConfigProvider } from "./contexts/RestaurantConfigContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLayout from "./components/admin/AdminLayout";
import AdminAuth from "./pages/admin/AdminAuth";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ReservationsManager from "./pages/admin/ReservationsManager";
import TablesManager from "./pages/admin/TablesManager";
import CombinationsManager from "./pages/admin/CombinationsManager";
import ScheduleManager from "./pages/admin/ScheduleManager";
import RestaurantSettings from "./pages/admin/RestaurantSettings";
import RestaurantLayout from "./pages/admin/RestaurantLayout";
import CustomersManager from "./pages/admin/CustomersManager";
import UsersManager from "./pages/admin/UsersManager";
import ReservarPage from "./pages/ReservarPage";
import CartaPage from "./pages/CartaPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1, // Reducir reintentos
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

// console.log("QueryClient created:", queryClient);

function App() {
  // console.log("App component rendering...");

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RestaurantConfigProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter
                future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true,
                }}
              >
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/reservar" element={<ReservarPage />} />
                  <Route path="/carta" element={<CartaPage />} />
                  <Route path="/admin/auth" element={<AdminAuth />} />

                  {/* Admin Routes - Simplificadas */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute requiredPermission="dashboard.view">
                        <AdminLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<AdminDashboard />} />
                    <Route
                      path="reservations"
                      element={
                        <ProtectedRoute requiredPermission="reservations.view">
                          <ReservationsManager />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="customers"
                      element={
                        <ProtectedRoute requiredPermission="customers.view">
                          <CustomersManager />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="tables"
                      element={
                        <ProtectedRoute requiredPermission="tables.view">
                          <TablesManager />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="layout"
                      element={
                        <ProtectedRoute requiredPermission="layout.view">
                          <RestaurantLayout />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="combinations"
                      element={
                        <ProtectedRoute requiredPermission="combinations.view">
                          <CombinationsManager />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="schedules"
                      element={
                        <ProtectedRoute requiredPermission="schedules.view">
                          <ScheduleManager />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="settings"
                      element={
                        <ProtectedRoute requiredPermission="settings.view">
                          <RestaurantSettings />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="users"
                      element={
                        <ProtectedRoute requiredPermission="users.view">
                          <UsersManager />
                        </ProtectedRoute>
                      }
                    />
                  </Route>

                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </RestaurantConfigProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
