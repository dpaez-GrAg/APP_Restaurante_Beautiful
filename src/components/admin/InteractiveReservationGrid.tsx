import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
} from '@dnd-kit/core';
import { CreateReservationDialog } from './CreateReservationDialog';
import { EditReservationDialog } from './EditReservationDialog';

interface Reservation {
  id: string;
  customer_name: string;
  date: string;
  time: string;
  guests: number;
  status: string;
  start_at?: string;
  end_at?: string;
  email: string;
  phone?: string;
  special_requests?: string;
  tableAssignments?: Array<{
    table_id: string;
    table_name: string;
  }>;
}

interface Table {
  id: string;
  name: string;
  capacity: number;
}

interface InteractiveReservationGridProps {
  selectedDate: string;
  onRefresh: () => void;
}

const InteractiveReservationGrid: React.FC<InteractiveReservationGridProps> = ({
  selectedDate,
  onRefresh
}) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedReservation, setDraggedReservation] = useState<Reservation | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogData, setCreateDialogData] = useState<{
    date: string;
    time: string;
    tableId?: string;
  }>({ date: selectedDate, time: '20:00' });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Generate 15-minute time slots from 12:00 to 23:30
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 12; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === 23 && minute === 45) break;
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  const generateHourHeaders = () => {
    const hours = [];
    for (let hour = 12; hour <= 23; hour++) {
      hours.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return hours;
  };

  const timeSlots = generateTimeSlots();
  const hourHeaders = generateHourHeaders();

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  useEffect(() => {
    // Subscribe to real-time updates
    const reservationsChannel = supabase
      .channel('reservations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservation_table_assignments' }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(reservationsChannel);
    };
  }, [selectedDate]);

  const loadData = async () => {
    try {
      const [reservationsResult, tablesResult, schedulesResult] = await Promise.all([
        supabase
          .from('reservations')
          .select(`
            *,
            customers(name, email, phone),
            reservation_table_assignments(
              table_id,
              tables(name)
            )
          `)
          .eq('date', selectedDate)
          .in('status', ['confirmed', 'pending']),
        supabase
          .from('tables')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('restaurant_schedules')
          .select('*')
          .eq('is_active', true)
      ]);

      if (reservationsResult.error) throw reservationsResult.error;
      if (tablesResult.error) throw tablesResult.error;
      if (schedulesResult.error) throw schedulesResult.error;

      const mappedReservations = (reservationsResult.data || []).map(reservation => ({
        id: reservation.id,
        customer_name: reservation.customers?.name || 'Cliente',
        email: reservation.customers?.email || '',
        phone: reservation.customers?.phone,
        date: reservation.date,
        time: reservation.time,
        guests: reservation.guests,
        status: reservation.status,
        start_at: reservation.start_at,
        end_at: reservation.end_at,
        special_requests: reservation.special_requests,
        tableAssignments: reservation.reservation_table_assignments?.map(assignment => ({
          table_id: assignment.table_id,
          table_name: assignment.tables?.name || 'Mesa'
        })) || []
      }));

      setReservations(mappedReservations);
      setTables(tablesResult.data || []);
      setSchedules(schedulesResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  const isRestaurantOpen = (timeSlot: string) => {
    const currentDay = new Date(selectedDate).getDay();
    const daySchedules = schedules.filter(s => s.day_of_week === currentDay && s.is_active);
    
    return daySchedules.some(schedule => {
      const openTime = schedule.opening_time.substring(0, 5);
      const closeTime = schedule.closing_time.substring(0, 5);
      return timeSlot >= openTime && timeSlot <= closeTime;
    });
  };

  const getReservationForTableAndTime = (tableId: string, timeSlot: string) => {
    return reservations.find(reservation => {
      const hasTableAssigned = reservation.tableAssignments?.some(
        assignment => assignment.table_id === tableId
      );
      
      if (!hasTableAssigned) return false;

      if (reservation.start_at && reservation.end_at) {
        const slotStartTime = new Date(`${selectedDate}T${timeSlot}:00`);
        const slotEndTime = new Date(slotStartTime.getTime() + 15 * 60000);
        
        const reservationStart = new Date(reservation.start_at);
        const reservationEnd = new Date(reservation.end_at);
        
        return (
          (reservationStart <= slotStartTime && reservationEnd > slotStartTime) ||
          (reservationStart < slotEndTime && reservationEnd >= slotEndTime) ||
          (reservationStart >= slotStartTime && reservationEnd <= slotEndTime)
        );
      }
      
      return reservation.time.substring(0, 5) === timeSlot;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const reservationId = event.active.id as string;
    const reservation = reservations.find(r => r.id === reservationId);
    setDraggedReservation(reservation || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !draggedReservation) {
      setDraggedReservation(null);
      return;
    }

    const [targetTableId, targetTime] = (over.id as string).split('-');
    
    // Snap to nearest 15-minute slot
    const targetTimeSlot = timeSlots.find(slot => slot === targetTime) || targetTime;
    
    // Check if this is a different location
    const currentTableId = draggedReservation.tableAssignments?.[0]?.table_id;
    const currentTime = draggedReservation.time.substring(0, 5);
    
    if (targetTableId === currentTableId && targetTimeSlot === currentTime) {
      setDraggedReservation(null);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('move_reservation_with_validation', {
        p_reservation_id: draggedReservation.id,
        p_new_date: selectedDate,
        p_new_time: targetTimeSlot,
        p_duration_minutes: 90,
        p_new_table_ids: [targetTableId]
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Error al mover la reserva');
      }

      toast.success('Reserva movida correctamente');
      loadData();
      onRefresh();
    } catch (error: any) {
      console.error('Error moving reservation:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setDraggedReservation(null);
    }
  };

  const handleCellClick = (tableId: string, timeSlot: string) => {
    const existingReservation = getReservationForTableAndTime(tableId, timeSlot);
    
    if (existingReservation) {
      // Edit existing reservation
      setEditingReservation(existingReservation);
      setEditDialogOpen(true);
    } else if (isRestaurantOpen(timeSlot)) {
      // Create new reservation
      setCreateDialogData({
        date: selectedDate,
        time: timeSlot,
        tableId: tableId
      });
      setCreateDialogOpen(true);
    }
  };

  const ReservationBlock = ({ reservation }: { reservation: Reservation }) => (
    <div className="text-center w-full px-0.5 cursor-pointer">
      <div className="font-semibold text-foreground text-xs leading-tight mb-1 truncate" title={reservation.customer_name}>
        {reservation.customer_name.split(' ')[0]}
      </div>
      <div className="text-xs font-medium">
        {reservation.guests}p
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Cargando vista de reservas...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Vista Interactiva de Ocupación
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setCreateDialogData({
                      date: selectedDate,
                      time: '20:00'
                    });
                    setCreateDialogOpen(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Reserva
                </Button>
                <Badge variant="secondary">
                  {format(parseISO(selectedDate), "EEEE, d 'de' MMMM", { locale: es })}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="w-full overflow-x-auto">
              {/* Hour headers */}
              <div className="grid gap-0 mb-2" style={{ 
                gridTemplateColumns: `100px repeat(${hourHeaders.length}, minmax(40px, 1fr))`,
                minWidth: '800px'
              }}>
                <div className="p-2 text-sm font-medium text-center bg-muted border">Mesa</div>
                {hourHeaders.map(time => (
                  <div key={time} className="p-1 text-xs font-medium text-center bg-muted border-l border-t border-b">
                    {time.substring(0, 2)}h
                  </div>
                ))}
              </div>

              {/* Table rows */}
              <div style={{ minWidth: '800px' }}>
                {tables.map(table => (
                  <div 
                    key={table.id} 
                    className="grid gap-0 border-b" 
                    style={{ 
                      gridTemplateColumns: `100px repeat(${timeSlots.length}, minmax(10px, 1fr))`
                    }}
                  >
                    {/* Table name */}
                    <div className="p-2 bg-muted text-sm font-medium flex items-center border-r border-b">
                      <div>
                        <div className="font-semibold text-xs">{table.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {table.capacity}p
                        </div>
                      </div>
                    </div>
                    
                    {/* Time slots for this table */}
                    {timeSlots.map(timeSlot => {
                      const reservation = getReservationForTableAndTime(table.id, timeSlot);
                      const isOpen = isRestaurantOpen(timeSlot);
                      const cellId = `${table.id}-${timeSlot}`;
                      
                      return (
                        <div 
                          key={cellId}
                          id={cellId}
                          onClick={() => handleCellClick(table.id, timeSlot)}
                          className={`border-b border-r min-h-[50px] flex items-center justify-center text-xs transition-all cursor-pointer ${
                            !isOpen 
                              ? 'bg-gray-200 border-gray-300 cursor-not-allowed' 
                              : reservation 
                                ? reservation.status === 'confirmed' 
                                  ? 'bg-green-100 border-green-300 hover:bg-green-200' 
                                  : 'bg-yellow-100 border-yellow-300 hover:bg-yellow-200'
                                : 'bg-gray-50 hover:bg-blue-50 border-gray-200 cursor-pointer'
                          }`}
                        >
                          {reservation && (
                            <div
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', reservation.id);
                                setDraggedReservation(reservation);
                              }}
                              className="w-full h-full flex items-center justify-center"
                            >
                              <ReservationBlock reservation={reservation} />
                            </div>
                          )}
                          {!reservation && !isOpen && (
                            <div className="text-xs text-gray-500">✕</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                <span>Confirmada</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
                <span>Pendiente</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-200 border border-gray-300 rounded"></div>
                <span>Cerrado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
                <span>Libre (Click para reservar)</span>
              </div>
              <div className="text-sm text-muted-foreground">
                💡 Arrastra las reservas para moverlas entre mesas y horarios
              </div>
            </div>
          </CardContent>
        </Card>

        <DragOverlay>
          {draggedReservation ? (
            <div className="bg-white border border-primary rounded p-2 shadow-lg">
              <ReservationBlock reservation={draggedReservation} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CreateReservationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultDate={createDialogData.date}
        defaultTime={createDialogData.time}
        defaultTableId={createDialogData.tableId}
        onSuccess={() => {
          loadData();
          onRefresh();
        }}
      />

      <EditReservationDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        reservation={editingReservation}
        onUpdate={() => {
          loadData();
          onRefresh();
        }}
      />
    </>
  );
};

export default InteractiveReservationGrid;