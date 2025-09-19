import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Users, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CustomerWithStats, CustomerClassification } from "@/types/customer";
import CustomerClassificationBadge from "@/components/CustomerClassificationBadge";
import { useToast } from "@/hooks/use-toast";
import CustomerDetailModal from "@/components/CustomerDetailModal";

const CustomersManager = () => {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<CustomerClassification | "ALL">("ALL");
  const [orderBy, setOrderBy] = useState<"name" | "classification" | "last_reservation">("last_reservation");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const { toast } = useToast();

  const ITEMS_PER_PAGE = 50;

  const loadCustomers = useCallback(
    async (reset = false) => {
      try {
        if (reset) {
          setLoading(true);
          setCustomers([]);
        } else {
          setLoadingMore(true);
        }

        const offset = reset ? 0 : customers.length;

        const { data, error } = await supabase.rpc("get_customers_with_stats", {
          p_search: searchTerm || null,
          p_classification: classificationFilter === "ALL" ? null : classificationFilter,
          p_order_by: orderBy,
          p_limit: ITEMS_PER_PAGE,
          p_offset: offset,
        });

        if (error) {
          console.error("Error loading customers:", error);
          toast({
            title: "Error",
            description: "No se pudieron cargar los clientes",
            variant: "destructive",
          });
          return;
        }

        const newCustomers = data || [];

        if (reset) {
          setCustomers(newCustomers);
        } else {
          setCustomers((prev) => [...prev, ...newCustomers]);
        }

        setHasMore(newCustomers.length === ITEMS_PER_PAGE);
      } catch (error) {
        console.error("Error loading customers:", error);
        toast({
          title: "Error",
          description: "Ocurrió un error al cargar los clientes",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [searchTerm, classificationFilter, orderBy, customers.length, toast]
  );

  // Cargar clientes inicialmente
  useEffect(() => {
    loadCustomers(true);
  }, [searchTerm, classificationFilter, orderBy]);

  // Scroll infinito
  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 1000 &&
      hasMore &&
      !loadingMore
    ) {
      loadCustomers(false);
    }
  }, [hasMore, loadingMore, loadCustomers]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const handleCustomerClick = (customerId: string) => {
    setSelectedCustomerId(customerId);
  };

  const handleCustomerUpdated = () => {
    // Recargar la lista cuando se actualice un cliente
    loadCustomers(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-restaurant-brown flex items-center gap-2">
          <Users className="w-8 h-8" />
          Gestión de Clientes
        </h1>
        <p className="text-muted-foreground">Administra y clasifica a tus clientes</p>
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por nombre o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtro por clasificación */}
          <Select
            value={classificationFilter}
            onValueChange={(value) => setClassificationFilter(value as CustomerClassification | "ALL")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por clasificación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las clasificaciones</SelectItem>
              <SelectItem value="VIP">VIP</SelectItem>
              <SelectItem value="NEUTRO">Neutro</SelectItem>
              <SelectItem value="ALERTA">Alerta</SelectItem>
              <SelectItem value="RED_FLAG">Red Flag</SelectItem>
            </SelectContent>
          </Select>

          {/* Ordenar por */}
          <Select
            value={orderBy}
            onValueChange={(value) => setOrderBy(value as "name" | "classification" | "last_reservation")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nombre</SelectItem>
              <SelectItem value="classification">Clasificación</SelectItem>
              <SelectItem value="last_reservation">Última reserva</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de clientes */}
      <div className="bg-white rounded-lg shadow-sm">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-restaurant-gold mx-auto"></div>
            <p className="mt-2 text-gray-500">Cargando clientes...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No se encontraron clientes</p>
          </div>
        ) : (
          <>
            <div className="grid gap-2 p-4">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => handleCustomerClick(customer.id)}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <CustomerClassificationBadge classification={customer.classification} showLabel={false} size="md" />
                    <div>
                      <h3 className="font-medium text-gray-900">{customer.name}</h3>
                      <p className="text-sm text-gray-500">{customer.phone}</p>
                    </div>
                  </div>

                  <div className="text-right text-sm text-gray-500">
                    <p>{customer.total_reservations} reservas</p>
                    {customer.last_reservation_date && (
                      <p>Última: {new Date(customer.last_reservation_date).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Loading más elementos */}
            {loadingMore && (
              <div className="p-4 text-center border-t">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-restaurant-gold mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Cargando más clientes...</p>
              </div>
            )}

            {/* Fin de resultados */}
            {!hasMore && customers.length > 0 && (
              <div className="p-4 text-center border-t text-gray-500 text-sm">No hay más clientes para mostrar</div>
            )}
          </>
        )}
      </div>

      {/* Modal de detalle del cliente */}
      {selectedCustomerId && (
        <CustomerDetailModal
          customerId={selectedCustomerId}
          isOpen={!!selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onCustomerUpdated={handleCustomerUpdated}
        />
      )}
    </div>
  );
};

export default CustomersManager;
