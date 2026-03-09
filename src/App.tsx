import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import AppSidebar, { MobileHeader } from "@/components/AppSidebar";
import DashboardPage from "@/pages/DashboardPage";
import FacultyPage from "@/pages/FacultyPage";
import SlotsPage from "@/pages/SlotsPage";
import UnavailabilityPage from "@/pages/UnavailabilityPage";
import AllocationPage from "@/pages/AllocationPage";
import ReportsPage from "@/pages/ReportsPage";
import ConflictsPage from "@/pages/ConflictsPage";
import FacultyDashboard from "@/pages/FacultyDashboard";
import LoginPage from "@/pages/LoginPage";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "@/context/AuthContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              {/* Public Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Routes Wrapper */}
              <Route element={<ProtectedRoute />}>
                <Route
                  path="*"
                  element={
                    <div className="flex h-screen w-full bg-app-gradient relative overflow-hidden">
                      <AppSidebar />
                      <div className="flex-1 flex flex-col min-w-0 relative z-10">
                        <MobileHeader />
                        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
                          <Routes>
                            <Route path="/" element={<DashboardPage />} />
                            <Route path="/faculty" element={<FacultyPage />} />
                            <Route path="/slots" element={<SlotsPage />} />
                            <Route path="/unavailability" element={<UnavailabilityPage />} />
                            <Route path="/allocation" element={<AllocationPage />} />
                            <Route path="/reports" element={<ReportsPage />} />
                            <Route path="/conflicts" element={<ConflictsPage />} />
                            <Route path="/my-schedule" element={<FacultyDashboard />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </main>
                      </div>
                    </div>
                  }
                />
              </Route>
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
