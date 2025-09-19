import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Phone, Mail, Calendar, Clock, Users, MessageSquare, History, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CustomerDetail, CustomerClassification, CustomerClassificationHistory } from "@/types/customer";
import CustomerClassificationBadge from "./CustomerClassificationBadge";
import { useToast } from "@/hooks/use-toast";

interface CustomerDetailModalProps {
  customerId: string;
  isOpen: boolean;
  onClose: () => void;
  onCustomerUpdated: () => void;
}

const CustomerDetailModal = ({ customerId, isOpen, onClose, onCustomerUpdated }: CustomerDetailModalProps) => {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newClassification, setNewClassification] = useState<CustomerClassification>("NEUTRO");
  const [newNotes, setNewNotes] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && customerId) {
      loadCustomerDetail();
    }
  }, [isOpen, customerId]);

  const loadCustomerDetail = async () => {
    try {
      setLoading(true);

      // Cargar información básica del cliente
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select(
          `
          *,
          reservations!inner(
            id,
            date,
            time,
            guests,
            status,
            special_requests,
            created_at
          )
        `
        )
        .eq("id", customerId)
        .single();

      if (customerError) throw customerError;

      // Cargar estadísticas de reservas
      const { data: statsData } = await supabase
        .rpc("get_customers_with_stats", {
          p_search: null,
          p_classification: null,
          p_order_by: "name",
          p_limit: 1,
          p_offset: 0,
        })
        .eq("id", customerId);

      // Cargar historial de clasificación
      const { data: historyData, error: historyError } = await supabase.rpc("get_customer_classification_history", {
        p_customer_id: customerId,
      });

      if (historyError) throw historyError;

      const stats = statsData?.[0] || { total_reservations: 0, last_reservation_date: null };

      const customerDetail: CustomerDetail = {
        ...customerData,
        total_reservations: stats.total_reservations,
        last_reservation_date: stats.last_reservation_date,
        reservations: customerData.reservations || [],
        classification_history: historyData || [],
      };

      setCustomer(customerDetail);
      setNewClassification(customerDetail.classification);
      setNewNotes(customerDetail.classification_notes || "");
    } catch (error) {
      console.error("Error loading customer detail:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información del cliente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClassification = async () => {
    if (!customer) return;

    try {
      setSaving(true);

      // TODO: Implementar permisos según tipo de usuario
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase.rpc("update_customer_classification", {
        p_customer_id: customer.id,
        p_new_classification: newClassification,
        p_notes: newNotes || null,
        p_changed_by: user?.id || null,
      });

      if (error) throw error;

      if (data) {
        toast({
          title: "Clasificación actualizada",
          description: "La clasificación del cliente se ha actualizado correctamente",
        });

        // Recargar datos del cliente
        await loadCustomerDetail();
        onCustomerUpdated();
      } else {
        toast({
          title: "Sin cambios",
          description: "No se realizaron cambios en la clasificación",
        });
      }
    } catch (error) {
      console.error("Error updating classification:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la clasificación",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "confirmed":
        return "default";
      case "completed":
        return "secondary";
      case "pending":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Confirmada";
      case "completed":
        return "Completada";
      case "pending":
        return "Pendiente";
      case "cancelled":
        return "Cancelada";
      default:
        return status;
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {loading ? "Cargando cliente..." : customer?.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-restaurant-gold mx-auto"></div>
            <p className="mt-2 text-gray-500">Cargando información del cliente...</p>
          </div>
        ) : customer ? (
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Información</TabsTrigger>
              <TabsTrigger value="reservations">Reservas</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-6">
              {/* Información básica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Información Personal</h3>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{customer.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <span>{customer.phone}</span>
                    </div>

                    {customer.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span>{customer.email}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span>Cliente desde: {formatDate(customer.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Estadísticas</h3>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span>{customer.total_reservations} reservas totales</span>
                    </div>

                    {customer.last_reservation_date && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span>Última reserva: {formatDate(customer.last_reservation_date)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Clasificación actual */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Clasificación Actual</h3>
                <div className="flex items-center gap-3">
                  <CustomerClassificationBadge classification={customer.classification} />
                  {customer.classification_notes && (
                    <span className="text-sm text-gray-600">"{customer.classification_notes}"</span>
                  )}
                </div>
              </div>

              {/* Actualizar clasificación */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-semibold">Actualizar Clasificación</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Nueva Clasificación</label>
                    <Select
                      value={newClassification}
                      onValueChange={(value) => setNewClassification(value as CustomerClassification)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VIP">VIP</SelectItem>
                        <SelectItem value="NEUTRO">Neutro</SelectItem>
                        <SelectItem value="ALERTA">Alerta</SelectItem>
                        <SelectItem value="RED_FLAG">Red Flag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Comentarios</label>
                    <Textarea
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="Motivo del cambio de clasificación..."
                      rows={3}
                    />
                  </div>
                </div>

                <Button onClick={handleSaveClassification} disabled={saving} className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? "Guardando..." : "Guardar Clasificación"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="reservations" className="space-y-4">
              <h3 className="text-lg font-semibold">Historial de Reservas</h3>

              {customer.reservations.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay reservas registradas</p>
              ) : (
                <div className="space-y-3">
                  {customer.reservations
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((reservation) => (
                      <div key={reservation.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">
                              {formatDate(reservation.date)} - {formatTime(reservation.time)}
                            </span>
                          </div>
                          <Badge variant={getStatusBadgeVariant(reservation.status)}>
                            {getStatusLabel(reservation.status)}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{reservation.guests} personas</span>
                          {reservation.special_requests && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {reservation.special_requests}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <History className="w-5 h-5" />
                Historial de Clasificaciones
              </h3>

              {customer.classification_history.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay cambios de clasificación registrados</p>
              ) : (
                <div className="space-y-3">
                  {customer.classification_history.map((change) => (
                    <div key={change.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {change.old_classification && (
                            <CustomerClassificationBadge classification={change.old_classification} size="sm" />
                          )}
                          <span className="text-gray-400">→</span>
                          <CustomerClassificationBadge classification={change.new_classification} size="sm" />
                        </div>
                        <span className="text-sm text-gray-500">{formatDate(change.changed_at)}</span>
                      </div>

                      {change.notes && <p className="text-sm text-gray-600 mt-2">"{change.notes}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <p>No se pudo cargar la información del cliente</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDetailModal;
