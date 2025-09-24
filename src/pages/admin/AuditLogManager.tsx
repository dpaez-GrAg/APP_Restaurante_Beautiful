import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Shield, Calendar, User, Activity, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface AuditLog {
  id: string;
  action_type: string;
  table_name: string;
  record_id: string;
  user_name: string;
  user_id: string | null;
  details: any;
  created_at: string;
}

const AuditLogManager = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("ALL");
  const { toast } = useToast();

  const ITEMS_PER_PAGE = 50;

  const actionTypeLabels: Record<string, string> = {
    reservation_created: "Reserva Creada",
    reservation_cancelled: "Reserva Cancelada",
    reservation_modified: "Reserva Modificada",
    table_created: "Mesa Creada",
    table_modified: "Mesa Modificada",
    table_deleted: "Mesa Eliminada",
    customer_classification_changed: "Clasificación Cliente",
    user_created: "Usuario Creado",
    user_modified: "Usuario Modificado",
    schedule_modified: "Horario Modificado",
    config_modified: "Configuración Modificada",
  };

  const actionTypeColors: Record<string, string> = {
    reservation_created: "bg-green-100 text-green-800",
    reservation_cancelled: "bg-red-100 text-red-800",
    reservation_modified: "bg-yellow-100 text-yellow-800",
    table_created: "bg-blue-100 text-blue-800",
    table_modified: "bg-blue-100 text-blue-800",
    table_deleted: "bg-red-100 text-red-800",
    customer_classification_changed: "bg-purple-100 text-purple-800",
    user_created: "bg-indigo-100 text-indigo-800",
    user_modified: "bg-indigo-100 text-indigo-800",
    schedule_modified: "bg-orange-100 text-orange-800",
    config_modified: "bg-gray-100 text-gray-800",
  };

  const loadAuditLogs = useCallback(
    async (reset = false) => {
      try {
        if (reset) {
          setLoading(true);
          setLogs([]);
        } else {
          setLoadingMore(true);
        }

        const offset = reset ? 0 : logs.length;

        const { data, error } = await supabase.rpc("get_audit_logs", {
          p_limit: ITEMS_PER_PAGE,
          p_offset: offset,
          p_search_text: searchTerm || null,
          p_action_type: actionTypeFilter === "ALL" ? null : actionTypeFilter,
        });

        if (error) {
          console.error("Error loading audit logs:", error);
          toast({
            title: "Error",
            description: "No se pudieron cargar los logs de auditoría",
            variant: "destructive",
          });
          return;
        }

        const newLogs = data || [];

        if (reset) {
          setLogs(newLogs);
        } else {
          setLogs((prev) => [...prev, ...newLogs]);
        }

        setHasMore(newLogs.length === ITEMS_PER_PAGE);
      } catch (error) {
        console.error("Error loading audit logs:", error);
        toast({
          title: "Error",
          description: "Error inesperado al cargar los logs",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [searchTerm, actionTypeFilter, logs.length, toast]
  );

  useEffect(() => {
    loadAuditLogs(true);
  }, [searchTerm, actionTypeFilter]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleActionTypeFilter = (value: string) => {
    setActionTypeFilter(value);
  };

  const formatActionDetails = (log: AuditLog) => {
    const details = log.details;

    switch (log.action_type) {
      case "reservation_created":
        return `${details.customer_name} - ${details.guests} personas - ${details.date} ${details.time}`;

      case "reservation_cancelled":
        return `${details.customer_name} - ${details.date} ${details.time} - Motivo: ${
          details.reason || "No especificado"
        }`;

      case "reservation_modified":
        const oldValues = details.old_values;
        const newValues = details.new_values;
        const changes = [];

        if (oldValues.date !== newValues.date) {
          changes.push(`Fecha: ${oldValues.date} → ${newValues.date}`);
        }
        if (oldValues.time !== newValues.time) {
          changes.push(`Hora: ${oldValues.time} → ${newValues.time}`);
        }
        if (oldValues.guests !== newValues.guests) {
          changes.push(`Comensales: ${oldValues.guests} → ${newValues.guests}`);
        }

        return `${details.customer_name} - ${changes.join(", ") || "Cambios menores"}`;

      case "table_created":
        return `Mesa ${details.table_number} - Capacidad: ${details.capacity} - Ubicación: ${
          details.location || "No especificada"
        }`;

      case "table_modified":
        return `Mesa ${details.table_number} - Capacidad: ${details.capacity}`;

      case "table_deleted":
        return `Mesa ${details.table_number} eliminada`;

      case "customer_classification_changed":
        return `${details.old_classification} → ${details.new_classification}${
          details.notes ? ` - ${details.notes}` : ""
        }`;

      case "user_created":
        return `${details.target_user_name} (${details.target_user_email}) - Rol: ${details.target_user_role}`;

      case "user_modified":
        return `${details.target_user_name} (${details.target_user_email}) - Rol: ${details.target_user_role}`;

      default:
        return "Acción registrada";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-gray-600" />
          <h1 className="text-2xl font-bold text-gray-900">Registro de Auditoría</h1>
        </div>
        <Button onClick={() => loadAuditLogs(true)} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Search className="h-5 w-5 mr-2" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar por nombre o detalles</label>
              <Input
                placeholder="Buscar en logs..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Acción</label>
              <Select value={actionTypeFilter} onValueChange={handleActionTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las acciones</SelectItem>
                  {Object.entries(actionTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Registro de Actividades ({logs.length} entradas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Cargando logs de auditoría...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No se encontraron registros de auditoría</p>
              <p className="text-sm">Prueba con diferentes filtros de búsqueda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center space-x-3">
                        <Badge className={actionTypeColors[log.action_type] || "bg-gray-100 text-gray-800"}>
                          {actionTypeLabels[log.action_type] || log.action_type}
                        </Badge>
                        <div className="flex items-center text-sm text-gray-500">
                          <User className="h-4 w-4 mr-1" />
                          {log.user_name}
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          {format(parseISO(log.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                        </div>
                      </div>

                      <div className="text-sm text-gray-700">{formatActionDetails(log)}</div>

                      {log.record_id && <div className="text-xs text-gray-400">ID: {log.record_id}</div>}
                    </div>
                  </div>
                </div>
              ))}

              {/* Botón Cargar Más */}
              {hasMore && (
                <div className="text-center pt-4">
                  <Button onClick={() => loadAuditLogs(false)} variant="outline" disabled={loadingMore}>
                    {loadingMore ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      <>Cargar más registros</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogManager;
