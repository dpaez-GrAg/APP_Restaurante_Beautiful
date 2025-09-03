import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, Clock, Users, Mail, Phone, Search, Filter, Check, X, Grid3X3, CalendarIcon, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReservationTimeGrid from "@/components/ReservationTimeGrid";
import InteractiveReservationGrid from "@/components/admin/InteractiveReservationGrid";
import { CreateReservationDialog } from "@/components/admin/CreateReservationDialog";
import { EditReservationDialog } from "@/components/admin/EditReservationDialog";
import { Edit } from "lucide-react";
import { formatDateLocal } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
interface Reservation {
  id: string;
  name: string;
  email: string;
  phone?: string;
  date: string;
  time: string;
  guests: number;
  message?: string;
  status: "pending" | "confirmed" | "cancelled";
  table_assignments?: Array<{
    table_id: string;
    table_name?: string;
  }>;
  created_at: string;
  duration_minutes?: number;
  start_at?: string;
  end_at?: string;
}
const ReservationsManager = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(formatDateLocal(new Date()));
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [gridRefreshKey, setGridRefreshKey] = useState(0);
  const {
    toast
  } = useToast();
  useEffect(() => {
    loadReservations();

    // Set up realtime subscription for reservations list
    const listChannel = supabase
      .channel('reservations-list-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reservations'
      }, (payload) => {
        console.log('List: Reservation change detected:', payload);
        loadReservations();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reservation_table_assignments'
      }, (payload) => {
        console.log('List: Table assignment change detected:', payload);
        loadReservations();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'customers'
      }, (payload) => {
        console.log('List: Customer change detected:', payload);
        loadReservations();
      })
      .subscribe((status) => {
        console.log('List realtime subscription status:', status);
      });
    
    return () => {
      supabase.removeChannel(listChannel);
    };
  }, []);
  useEffect(() => {
    filterReservations();
  }, [searchTerm, statusFilter, dateFilter, reservations]);
  const loadReservations = async () => {
    try {
      setIsLoading(true);
      const {
        data: reservationData,
        error
      } = await supabase.from('reservations').select(`
          *,
          customers (name, email, phone),
          reservation_table_assignments (
            table_id,
            tables (name)
          )
        `).order('date', {
        ascending: false
      }).order('time', {
        ascending: false
      });
      if (error) throw error;
      const formattedReservations: Reservation[] = reservationData?.map(reservation => ({
        id: reservation.id,
        name: reservation.customers?.name || 'Sin nombre',
        email: reservation.customers?.email || 'Sin email',
        phone: reservation.customers?.phone || undefined,
        date: reservation.date,
        time: reservation.time,
        guests: reservation.guests,
        message: reservation.special_requests || undefined,
        status: reservation.status as "pending" | "confirmed" | "cancelled",
        table_assignments: reservation.reservation_table_assignments?.map(assignment => ({
          table_id: assignment.table_id,
          table_name: assignment.tables?.name
        })) || [],
        created_at: reservation.created_at,
        duration_minutes: reservation.duration_minutes,
        start_at: reservation.start_at,
        end_at: reservation.end_at
      })) || [];
      setReservations(formattedReservations);
    } catch (error) {
      console.error('Error loading reservations:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las reservas.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const filterReservations = () => {
    let filtered = [...reservations];

    // Filtro por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(reservation => reservation.name.toLowerCase().includes(searchTerm.toLowerCase()) || reservation.email.toLowerCase().includes(searchTerm.toLowerCase()) || reservation.phone?.includes(searchTerm));
    }

    // Filtro por estado
    if (statusFilter !== "all") {
      filtered = filtered.filter(reservation => reservation.status === statusFilter);
    }

    // Filtro por fecha
    if (dateFilter) {
      filtered = filtered.filter(reservation => reservation.date === dateFilter);
    }
    setFilteredReservations(filtered);
  };
  const updateReservationStatus = async (id: string, newStatus: "confirmed" | "cancelled") => {
    try {
      const {
        error
      } = await supabase.from('reservations').update({
        status: newStatus
      }).eq('id', id);
      if (error) throw error;
      setReservations(prev => prev.map(reservation => reservation.id === id ? {
        ...reservation,
        status: newStatus
      } : reservation));
      toast({
        title: "Estado actualizado",
        description: `Reserva ${newStatus === "confirmed" ? "confirmada" : "cancelada"} correctamente.`
      });
    } catch (error) {
      console.error('Error updating reservation:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la reserva.",
        variant: "destructive"
      });
    }
  };
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Confirmada</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendiente</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  const getStatusCount = (status: string) => {
    const dateFilteredReservations = reservations.filter(r => r.date === dateFilter);
    if (status === "all") {
      return dateFilteredReservations.length;
    }
    if (status === "guests") {
      return dateFilteredReservations.reduce((total, r) => total + r.guests, 0);
    }
    return dateFilteredReservations.filter(r => r.status === status).length;
  };
  return <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-restaurant-brown">Gestión de Reservas</h1>
          <p className="text-muted-foreground">
            Administra todas las reservas de tu restaurante
          </p>
        </div>
        
        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
          const currentDate = new Date(dateFilter);
          currentDate.setDate(currentDate.getDate() - 1);
          setDateFilter(formatDateLocal(currentDate));
        }}>
            ←
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("min-w-[140px] justify-center text-sm font-medium")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {new Date(dateFilter).toLocaleDateString('es-ES', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
              })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <CalendarComponent mode="single" selected={new Date(dateFilter)} onSelect={date => {
              if (date) {
                setDateFilter(formatDateLocal(date));
              }
            }} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => {
          const currentDate = new Date(dateFilter);
          currentDate.setDate(currentDate.getDate() + 1);
          setDateFilter(formatDateLocal(currentDate));
        }}>
            →
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-elegant">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-restaurant-brown">{getStatusCount("all")}</p>
              </div>
              <Calendar className="w-8 h-8 text-restaurant-gold" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elegant">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Comensales</p>
                <p className="text-2xl font-bold text-blue-600">{getStatusCount("guests")}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elegant">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Confirmadas</p>
                <p className="text-2xl font-bold text-green-600">{getStatusCount("confirmed")}</p>
              </div>
              <Check className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elegant">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Canceladas</p>
                <p className="text-2xl font-bold text-red-600">{getStatusCount("cancelled")}</p>
              </div>
              <X className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Grid */}
      <div className="space-y-4 overflow-x-hidden">
        <div className="w-full max-w-full overflow-x-auto overscroll-x-contain touch-pan-x">
          <InteractiveReservationGrid selectedDate={dateFilter} onRefresh={loadReservations} refreshTrigger={gridRefreshKey} onReservationClick={gridReservation => {
        // Convert grid reservation to manager reservation format
        const managerReservation: Reservation = {
          id: gridReservation.id,
          name: gridReservation.customer_name,
          email: gridReservation.email,
          phone: gridReservation.phone,
          date: gridReservation.date,
          time: gridReservation.time,
          guests: gridReservation.guests,
          status: gridReservation.status as "pending" | "confirmed" | "cancelled",
          message: gridReservation.special_requests,
          table_assignments: gridReservation.tableAssignments?.map(ta => ({
            table_id: ta.table_id,
            table_name: ta.table_name
          })),
          created_at: new Date().toISOString(),
          // Fallback
          duration_minutes: gridReservation.duration_minutes,
          start_at: gridReservation.start_at,
          end_at: gridReservation.end_at
        };
        setEditingReservation(managerReservation);
        setEditDialogOpen(true);
      }} onNewReservation={() => setCreateDialogOpen(true)} />
        </div>
      </div>

      {/* Lista de Reservas */}
      <div className="space-y-4">
          {/* Filters */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="text-restaurant-brown flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buscar</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input placeholder="Nombre, email o teléfono..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendientes</SelectItem>
                      <SelectItem value="confirmed">Confirmadas</SelectItem>
                      <SelectItem value="cancelled">Canceladas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium invisible">Acción</label>
                   <Button variant="outline" onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setDateFilter(formatDateLocal(new Date()));
              }} className="w-full">
                     Limpiar Filtros
                   </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reservations List */}
          <Card className="shadow-elegant">
            <CardHeader>
              
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                 {filteredReservations.map(reservation => <div key={reservation.id} className="p-4 rounded-lg border border-border hover:border-restaurant-gold/50 transition-colors bg-card">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between space-y-3 lg:space-y-0">
                      <div className="space-y-2 flex-1">
                        {/* Primera línea: Nombre, Mesa y Estado */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <h3 className="font-semibold text-restaurant-brown">{reservation.name}</h3>
                            {reservation.table_assignments && reservation.table_assignments.length > 0 && (
                              <span className="text-sm text-muted-foreground bg-restaurant-cream/30 px-2 py-1 rounded">
                                Mesa: {reservation.table_assignments.map(ta => ta.table_name).join(', ')}
                              </span>
                            )}
                          </div>
                          {getStatusBadge(reservation.status)}
                        </div>
                        
                        {/* Segunda línea: Fecha, Hora y Personas */}
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>{reservation.date} • {reservation.time}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Users className="w-4 h-4" />
                            <span>{reservation.guests} personas</span>
                          </div>
                        </div>

                        {/* Tercera línea: Email y Teléfono */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1 min-w-0">
                            <Mail className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{reservation.email}</span>
                          </div>
                          {reservation.phone && (
                            <div className="flex items-center space-x-1 min-w-0">
                              <Phone className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">{reservation.phone}</span>
                            </div>
                          )}
                        </div>

                         {reservation.message && <div className="text-sm text-muted-foreground bg-restaurant-cream/30 p-2 rounded mt-2">
                             <strong>Mensaje:</strong> {reservation.message}
                           </div>}
                      </div>

                       <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                         <Button variant="outline" size="sm" onClick={() => {
                    setEditingReservation(reservation);
                    setEditDialogOpen(true);
                  }} className="flex items-center gap-1">
                           <Edit className="w-4 h-4" />
                           Editar
                         </Button>
                         
                         {reservation.status === "pending" && <>
                             <Button variant="default" size="sm" onClick={() => updateReservationStatus(reservation.id, "confirmed")} className="bg-green-600 hover:bg-green-700">
                               <Check className="w-4 h-4 mr-1" />
                               Confirmar
                             </Button>
                             <Button variant="outline" size="sm" onClick={() => updateReservationStatus(reservation.id, "cancelled")} className="text-red-600 border-red-200 hover:bg-red-50">
                               <X className="w-4 h-4 mr-1" />
                               Cancelar
                             </Button>
                           </>}
                       </div>
                    </div>
                  </div>)}

                 {isLoading ? <div className="text-center py-8 text-muted-foreground">
                     <div className="animate-spin w-8 h-8 border-4 border-restaurant-gold border-t-transparent rounded-full mx-auto mb-4"></div>
                     <p>Cargando reservas...</p>
                   </div> : filteredReservations.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                     <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                     <p>No se encontraron reservas con los filtros aplicados.</p>
                   </div> : null}
              </div>
            </CardContent>
           </Card>
        </div>

      <CreateReservationDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} defaultDate={dateFilter} onSuccess={() => {
      loadReservations();
      setGridRefreshKey(prev => prev + 1);
    }} />

      <EditReservationDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} reservation={editingReservation ? {
      id: editingReservation.id,
      customer_name: editingReservation.name,
      name: editingReservation.name,
      email: editingReservation.email,
      phone: editingReservation.phone,
      date: editingReservation.date,
      time: editingReservation.time,
      guests: editingReservation.guests,
      status: editingReservation.status,
      special_requests: editingReservation.message,
      duration_minutes: editingReservation.duration_minutes,
      start_at: editingReservation.start_at,
      end_at: editingReservation.end_at,
      tableAssignments: editingReservation.table_assignments?.map(ta => ({
        table_id: ta.table_id,
        table_name: ta.table_name || ''
      }))
    } : null} onUpdate={() => {
      loadReservations();
      setGridRefreshKey(prev => prev + 1);
    }} />
    </div>;
};
export default ReservationsManager;