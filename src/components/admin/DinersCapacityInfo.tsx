import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface DinersCapacityData {
  schedule_id: string;
  opening_time: string;
  closing_time: string;
  max_diners: number | null;
  current_diners: number;
  available_diners: number | null;
  is_special_schedule: boolean;
}

interface DinersCapacityInfoProps {
  selectedDate: string;
}

export const DinersCapacityInfo = ({ selectedDate }: DinersCapacityInfoProps) => {
  const [capacityData, setCapacityData] = useState<DinersCapacityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadCapacityData();
  }, [selectedDate]);

  const loadCapacityData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.rpc("get_diners_capacity_info", {
        p_date: selectedDate,
      });

      if (error) throw error;

      setCapacityData(data || []);
    } catch (error) {
      console.error("Error loading capacity data:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información de capacidad",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5);
  };

  const getCapacityStatus = (current: number, max: number | null) => {
    if (max === null) return "unlimited";
    const percentage = (current / max) * 100;
    if (percentage >= 90) return "critical";
    if (percentage >= 75) return "warning";
    return "normal";
  };

  const getStatusBadge = (current: number, max: number | null) => {
    if (max === null) {
      return <Badge variant="secondary">Sin límite</Badge>;
    }

    const status = getCapacityStatus(current, max);
    switch (status) {
      case "critical":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Completo</Badge>;
      case "warning":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Casi lleno</Badge>;
      default:
        return <Badge className="bg-green-100 text-green-800 border-green-200">Disponible</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Cargando información de capacidad...</div>
        </CardContent>
      </Card>
    );
  }

  if (capacityData.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Capacidad de Comensales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">No hay horarios configurados para este día</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5" />
          Capacidad de Comensales
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {capacityData.map((schedule) => (
          <div key={schedule.schedule_id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">
                  {formatTime(schedule.opening_time)} - {formatTime(schedule.closing_time)}
                </span>
                {schedule.is_special_schedule && (
                  <Badge variant="outline" className="text-xs">
                    Especial
                  </Badge>
                )}
              </div>
              {getStatusBadge(schedule.current_diners, schedule.max_diners)}
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold text-blue-600">{schedule.current_diners}</div>
                <div className="text-xs text-muted-foreground">Actuales</div>
              </div>

              <div className="text-center">
                <div className="font-semibold text-gray-600">{schedule.max_diners || "∞"}</div>
                <div className="text-xs text-muted-foreground">Máximo</div>
              </div>

              <div className="text-center">
                <div className="font-semibold text-green-600">
                  {schedule.available_diners !== null ? schedule.available_diners : "∞"}
                </div>
                <div className="text-xs text-muted-foreground">Disponibles</div>
              </div>
            </div>

            {schedule.max_diners && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    getCapacityStatus(schedule.current_diners, schedule.max_diners) === "critical"
                      ? "bg-red-500"
                      : getCapacityStatus(schedule.current_diners, schedule.max_diners) === "warning"
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{
                    width: `${Math.min((schedule.current_diners / schedule.max_diners) * 100, 100)}%`,
                  }}
                />
              </div>
            )}

            {schedule.max_diners && schedule.current_diners >= schedule.max_diners * 0.9 && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                <AlertTriangle className="w-3 h-3" />
                <span>
                  {schedule.current_diners >= schedule.max_diners
                    ? "Capacidad máxima alcanzada"
                    : "Acercándose a la capacidad máxima"}
                </span>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
