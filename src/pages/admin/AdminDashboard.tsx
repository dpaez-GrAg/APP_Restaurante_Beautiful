import { useState } from "react";
import { DashboardHeader } from "@/components/admin/DashboardHeader";
import { DashboardStats } from "@/components/admin/DashboardStats";
import { RecentReservationsList } from "@/components/admin/RecentReservationsList";
import { QuickActions } from "@/components/admin/QuickActions";
import { useDashboardData } from "@/hooks/useDashboardData";

const AdminDashboard = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const { stats, recentReservations, isLoading } = useDashboardData(selectedDate);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-muted animate-pulse rounded" />
          <div className="h-96 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader selectedDate={selectedDate} onDateChange={setSelectedDate} />

      {/* Stats Cards */}
      <DashboardStats stats={stats} />

      {/* Recent Reservations and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentReservationsList reservations={recentReservations} />
        <QuickActions />
      </div>
    </div>
  );
};

export default AdminDashboard;