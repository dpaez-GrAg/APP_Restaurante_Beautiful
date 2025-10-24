import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, CalendarIcon } from "lucide-react";
import { formatDateLocal } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { Reservation as ReservationType } from "@/types/reservation";
import { useReservations } from "@/hooks/useReservations";
import { useSchedules } from "@/hooks/useSchedules";
import { ReservationListItem } from "@/components/admin/reservations/ReservationListItem";
import { ReservationMetricsCard } from "@/components/admin/reservations/ReservationMetricsCard";
import { ReservationFilters } from "@/components/admin/reservations/ReservationFilters";
import InteractiveReservationGrid from "@/components/admin/InteractiveReservationGrid";
import { ReservationDialog } from "@/components/admin/ReservationDialog";
import { 
  filterReservations, 
  getMetricsForShift, 
  ReservationListItem as ReservationItemType 
} from "@/lib/reservationsUtils";

const ReservationsManager = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(formatDateLocal(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingReservation, setEditingReservation] = useState<ReservationType | null>(null);
  const [filteredReservations, setFilteredReservations] = useState<ReservationItemType[]>([]);

  const {
    reservations,
    isLoading,
    gridRefreshKey,
    loadReservations,
    updateReservationStatus,
    confirmArrival,
  } = useReservations();

  const { schedules, isSplitSchedule } = useSchedules(dateFilter);

  useEffect(() => {
    const filtered = filterReservations(reservations, searchTerm, statusFilter, dateFilter);
    setFilteredReservations(filtered);
  }, [searchTerm, statusFilter, dateFilter, reservations]);

  const handleEditReservation = (reservation: ReservationItemType) => {
    const typedReservation: ReservationType = {
      id: reservation.id,
      customer_id: "",
      customer_name: reservation.name,
      email: reservation.email,
      phone: reservation.phone,
      date: reservation.date,
      time: reservation.time,
      guests: reservation.guests,
      status: reservation.status,
      duration_minutes: reservation.duration_minutes || 90,
      special_requests: reservation.message,
      tableAssignments: reservation.table_assignments?.map(ta => ({
        table_id: ta.table_id,
        table_name: ta.table_name || ""
      })),
    };
    setEditingReservation(typedReservation);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFilter(formatDateLocal(new Date()));
  };

  const handleDateChange = (days: number) => {
    const currentDate = new Date(dateFilter);
    currentDate.setDate(currentDate.getDate() + days);
    setDateFilter(formatDateLocal(currentDate));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-restaurant-brown">Gestión de Reservas</h1>
          <p className="text-muted-foreground">Administra todas las reservas de tu restaurante</p>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleDateChange(-1)}>
            ←
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("min-w-[140px] justify-center text-sm font-medium")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {new Date(dateFilter).toLocaleDateString("es-ES", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <CalendarComponent
                mode="single"
                selected={new Date(dateFilter)}
                onSelect={(date) => {
                  if (date) {
                    setDateFilter(formatDateLocal(date));
                  }
                }}
                weekStartsOn={1}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => handleDateChange(1)}>
            →
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      {isSplitSchedule() ? (
        <div className="grid grid-cols-2 gap-3">
          <ReservationMetricsCard
            title="Comida"
            metrics={getMetricsForShift(reservations, dateFilter, schedules, 0)}
          />
          <ReservationMetricsCard
            title="Cena"
            metrics={getMetricsForShift(reservations, dateFilter, schedules, 1)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <ReservationMetricsCard
            title="Comida"
            metrics={getMetricsForShift(reservations, dateFilter, schedules, 0)}
          />
        </div>
      )}

      {/* Timeline Grid */}
      <div className="space-y-4">
        <InteractiveReservationGrid
          selectedDate={dateFilter}
          onRefresh={loadReservations}
          refreshTrigger={gridRefreshKey}
          onReservationClick={(gridReservation) => {
            setEditingReservation(gridReservation);
            setDialogMode("edit");
            setDialogOpen(true);
          }}
          onNewReservation={() => {
            setDialogMode("create");
            setEditingReservation(null);
            setDialogOpen(true);
          }}
        />
      </div>

      {/* Filters */}
      <ReservationFilters
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        onSearchChange={setSearchTerm}
        onStatusChange={setStatusFilter}
        onClearFilters={handleClearFilters}
      />

      {/* Reservations List */}
      <Card className="shadow-elegant">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {filteredReservations.map((reservation) => (
              <ReservationListItem
                key={reservation.id}
                reservation={reservation}
                onEdit={handleEditReservation}
                onConfirm={(id) => updateReservationStatus(id, "confirmed")}
                onConfirmArrival={confirmArrival}
                onCancel={(id) => updateReservationStatus(id, "cancelled")}
                onReactivate={(id) => updateReservationStatus(id, "confirmed")}
              />
            ))}

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="animate-spin w-8 h-8 border-4 border-restaurant-gold border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Cargando reservas...</p>
              </div>
            ) : filteredReservations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No se encontraron reservas con los filtros aplicados.</p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <ReservationDialog
        mode={dialogMode}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultDate={dateFilter}
        reservation={editingReservation}
        onSuccess={loadReservations}
      />
    </div>
  );
};

export default ReservationsManager;
