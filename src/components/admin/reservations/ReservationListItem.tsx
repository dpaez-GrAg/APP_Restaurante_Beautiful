import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Phone, Check, X, Edit, UserCheck } from "lucide-react";
import { ReservationListItem as ReservationItemType, getStatusBadgeClass } from "@/lib/reservationsUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ReservationListItemProps {
  reservation: ReservationItemType;
  onEdit: (reservation: ReservationItemType) => void;
  onConfirm: (id: string) => void;
  onConfirmArrival: (id: string) => void;
  onCancel: (id: string) => void;
  onReactivate: (id: string) => void;
}

export const ReservationListItem = ({
  reservation,
  onEdit,
  onConfirm,
  onConfirmArrival,
  onCancel,
  onReactivate,
}: ReservationListItemProps) => {
  return (
    <div className="p-4 rounded-lg border border-border hover:border-restaurant-gold/50 transition-colors bg-card">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-3 lg:space-y-0">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <h3 className="font-semibold text-restaurant-brown">{reservation.name}</h3>
            <Badge className={getStatusBadgeClass(reservation.status).className}>
              {getStatusBadgeClass(reservation.status).text}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>
                {reservation.date} • {reservation.time}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{reservation.guests} personas</span>
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
              <strong>Mesas asignadas:</strong>{" "}
              {reservation.table_assignments.map((ta) => ta.table_name).join(", ")}
            </div>
          )}

          {reservation.message && (
            <div className="text-sm text-muted-foreground bg-restaurant-cream/30 p-2 rounded">
              <strong>Mensaje:</strong> {reservation.message}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(reservation)}
            className="flex items-center gap-1"
          >
            <Edit className="w-4 h-4" />
            Editar
          </Button>

          {reservation.status === "pending" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onConfirm(reservation.id)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4 mr-1" />
              Confirmar
            </Button>
          )}

          {reservation.status === "confirmed" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onConfirmArrival(reservation.id)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <UserCheck className="w-4 h-4 mr-1" />
              Confirmar llegada
            </Button>
          )}

          {reservation.status !== "cancelled" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancelar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar reserva</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Estás seguro de que deseas cancelar la reserva de {reservation.name}?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onCancel(reservation.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Confirmar cancelación
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {reservation.status === "cancelled" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReactivate(reservation.id)}
              className="text-green-600 border-green-200 hover:bg-green-50"
            >
              <Check className="w-4 h-4 mr-1" />
              Reactivar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
