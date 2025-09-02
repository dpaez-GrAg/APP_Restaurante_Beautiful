import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, Users, Mail, Phone, Search, Filter, Check, X, Grid3X3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReservationTimeGrid from "@/components/ReservationTimeGrid";
import { formatDateLocal } from "@/lib/dateUtils";

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
  table_assignments?: Array<{ table_id: string; table_name?: string }>;
  created_at: string;
}

const ReservationsManager = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(formatDateLocal(new Date()));

  const { toast } = useToast();

  useEffect(() => {
    loadReservations();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        () => {
          loadReservations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    filterReservations();
  }, [searchTerm, statusFilter, dateFilter, reservations]);

  const loadReservations = async () => {
    try {
      setIsLoading(true);
      
      const { data: reservationData, error } = await supabase
        .from('reservations')
        .select(`
          *,
          customers (name, email, phone),
          reservation_table_assignments (
            table_id,
            tables (name)
          )
        `)
        .order('date', { ascending: false })
        .order('time', { ascending: false });

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
        created_at: reservation.created_at
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
      filtered = filtered.filter(
        (reservation) =>
          reservation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          reservation.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          reservation.phone?.includes(searchTerm)
      );
    }

    // Filtro por estado
    if (statusFilter !== "all") {
      filtered = filtered.filter((reservation) => reservation.status === statusFilter);
    }

    // Filtro por fecha
    if (dateFilter) {
      filtered = filtered.filter((reservation) => reservation.date === dateFilter);
    }

    setFilteredReservations(filtered);
  };

  const updateReservationStatus = async (id: string, newStatus: "confirmed" | "cancelled") => {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setReservations((prev) =>
        prev.map((reservation) =>
          reservation.id === id ? { ...reservation, status: newStatus } : reservation
        )
      );

      toast({
        title: "Estado actualizado",
        description: `Reserva ${newStatus === "confirmed" ? "confirmada" : "cancelada"} correctamente.`,
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
    return reservations.filter((r) => r.status === status).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-restaurant-brown">Gestión de Reservas</h1>
          <p className="text-muted-foreground">
            Administra todas las reservas de tu restaurante
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-elegant">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-restaurant-brown">{reservations.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-restaurant-gold" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elegant">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{getStatusCount("pending")}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
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

      {/* Tabs para diferentes vistas */}
      <Tabs defaultValue="grid" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:w-400">
          <TabsTrigger value="grid" className="flex items-center gap-2">
            <Grid3X3 className="w-4 h-4" />
            Vista de Ocupación
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Lista de Reservas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha</label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-48"
              />
            </div>
          </div>
          <ReservationTimeGrid selectedDate={dateFilter} />
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="text-restaurant-brown flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buscar</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      placeholder="Nombre, email o teléfono..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
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
                  <label className="text-sm font-medium">Fecha</label>
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium invisible">Acción</label>
                   <Button
                     variant="outline"
                     onClick={() => {
                       setSearchTerm("");
                       setStatusFilter("all");
                       setDateFilter(formatDateLocal(new Date()));
                     }}
                     className="w-full"
                   >
                     Limpiar Filtros
                   </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reservations List */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="text-restaurant-brown">
                Reservas ({filteredReservations.length})
              </CardTitle>
              <CardDescription>
                Lista de todas las reservas filtradas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredReservations.map((reservation) => (
                  <div
                    key={reservation.id}
                    className="p-4 rounded-lg border border-border hover:border-restaurant-gold/50 transition-colors bg-card"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-3 lg:space-y-0">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-semibold text-restaurant-brown">{reservation.name}</h3>
                          {getStatusBadge(reservation.status)}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>{reservation.date} • {reservation.time}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Users className="w-4 h-4" />
                            <span>{reservation.guests} personas</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Mail className="w-4 h-4" />
                            <span>{reservation.email}</span>
                          </div>
                        </div>

                        {reservation.phone && (
                          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            <span>{reservation.phone}</span>
                          </div>
                        )}

                         {reservation.table_assignments && reservation.table_assignments.length > 0 && (
                           <div className="text-sm text-muted-foreground">
                             <strong>Mesas asignadas:</strong> {reservation.table_assignments.map(ta => ta.table_name).join(', ')}
                           </div>
                         )}

                         {reservation.message && (
                           <div className="text-sm text-muted-foreground bg-restaurant-cream/30 p-2 rounded">
                             <strong>Mensaje:</strong> {reservation.message}
                           </div>
                         )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                        {reservation.status === "pending" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => updateReservationStatus(reservation.id, "confirmed")}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Confirmar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateReservationStatus(reservation.id, "cancelled")}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancelar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReservationsManager;