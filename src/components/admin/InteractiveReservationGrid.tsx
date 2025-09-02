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
    const headers = [];
    for (let hour = 12; hour <= 23; hour++) {
      headers.push({
        hour: `${hour.toString().padStart(2, '0')}h`,
        startSlotIndex: (hour - 12) * 4,
        spanSlots: hour === 23 ? 2 : 4 // 23h solo hasta 23:30
      });
    }
    return headers;
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
      return timeSlot >= openTime && timeSlot < closeTime;
    });
  };

  const getReservationForTableAndTime = (tableId: string, timeSlot: string) => {
    return reservations.find(reservation => {
      const hasTableAssigned = reservation.tableAssignments?.some(
        assignment => assignment.table_id === tableId
      );
      
      if (!hasTableAssigned) return false;

      if (reservation.start_at && reservation.end_at) {
        // Parse times as local time to avoid timezone conversion
        const reservationTimeStr = reservation.time.substring(0, 5); // Use time field directly
        const slotTime = timeSlot;
        
        // Check if the slot time matches the reservation time
        if (reservationTimeStr === slotTime) {
          return true;
        }
        
        // For duration-based checking, calculate if slot falls within reservation period
        const [resHour, resMinute] = reservationTimeStr.split(':').map(Number);
        const [slotHour, slotMinute] = slotTime.split(':').map(Number);
        
        const resStartMinutes = resHour * 60 + resMinute;
        const slotStartMinutes = slotHour * 60 + slotMinute;
        const slotEndMinutes = slotStartMinutes + 15;
        
        // Default duration 90 minutes if not calculable from timestamps
        let durationMinutes = 90;
        if (reservation.start_at && reservation.end_at) {
          const start = new Date(reservation.start_at);
          const end = new Date(reservation.end_at);
          durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        }
        
        const resEndMinutes = resStartMinutes + durationMinutes;
        
        return (
          (resStartMinutes <= slotStartMinutes && resEndMinutes > slotStartMinutes) ||
          (resStartMinutes < slotEndMinutes && resEndMinutes >= slotEndMinutes) ||
          (resStartMinutes >= slotStartMinutes && resEndMinutes <= slotEndMinutes)
        );
      }
      
      return reservation.time.substring(0, 5) === timeSlot;
    });
  };

  // Get reservation details with position info for rendering as single block
  const getReservationDetails = (tableId: string, timeSlot: string) => {
    const reservation = getReservationForTableAndTime(tableId, timeSlot);
    if (!reservation) return null;

    // Use the reservation.time field directly instead of start_at to avoid timezone issues
    const reservationTimeStr = reservation.time.substring(0, 5); // "14:30"
    const [resHour, resMinute] = reservationTimeStr.split(':').map(Number);
    
    // Calculate duration from reservation data (default 90 minutes if not specified)
    let durationMinutes = 90;
    if (reservation.start_at && reservation.end_at) {
      const start = new Date(reservation.start_at);
      const end = new Date(reservation.end_at);
      durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    }
    
    // Find the starting slot index for this reservation based on time field
    const startSlotIndex = timeSlots.findIndex(slot => slot === reservationTimeStr);
    if (startSlotIndex === -1) return null;

    // Calculate duration in 15-minute slots
    const durationSlots = Math.ceil(durationMinutes / 15);
    
    // Check if this is the first slot of the reservation
    const currentSlotIndex = timeSlots.findIndex(slot => slot === timeSlot);
    const isFirstSlot = currentSlotIndex === startSlotIndex;
    
    return {
      reservation,
      isFirstSlot,
      startSlotIndex,
      durationSlots,
      currentSlotIndex
    };
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
              {/* Header with hour markers only */}
              <div className="relative" style={{ minWidth: '800px' }}>
                {/* Mesa column header */}
                <div className="absolute top-0 left-0 w-[100px] h-[40px] bg-muted border flex items-center justify-center z-10">
                  <span className="text-sm font-medium">Mesa</span>
                </div>
                
                {/* Hour headers spanning multiple slots */}
                <div className="ml-[100px] relative h-[40px] border-t border-b">
                  {hourHeaders.map((header, index) => (
                    <div 
                      key={header.hour}
                      className="absolute top-0 h-full flex items-center justify-center bg-muted border-l border-r font-medium text-sm"
                      style={{
                        left: `${(header.startSlotIndex / timeSlots.length) * 100}%`,
                        width: `${(header.spanSlots / timeSlots.length) * 100}%`,
                        borderLeftWidth: index === 0 ? '0px' : '1px'
                      }}
                    >
                      {header.hour}
                    </div>
                  ))}
                </div>
              </div>

              {/* Table rows with perfect alignment */}
              <div style={{ minWidth: '800px' }}>
                {tables.map(table => (
                  <div key={table.id} className="relative">
                    {/* Table name column */}
                    <div className="absolute left-0 top-0 w-[100px] min-h-[50px] bg-muted text-sm font-medium flex items-center border-r border-b p-2">
                      <div>
                        <div className="font-semibold text-xs">{table.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {table.capacity}p
                        </div>
              </div>
            </div>
                    
                    {/* Time slots grid for this table */}
                    <div 
                      className="ml-[100px] grid gap-0" 
                      style={{ 
                        gridTemplateColumns: `repeat(${timeSlots.length}, minmax(10px, 1fr))`
                      }}
                    >
                      {timeSlots.map(timeSlot => {
                        const reservationDetails = getReservationDetails(table.id, timeSlot);
                        const isOpen = isRestaurantOpen(timeSlot);
                        const cellId = `${table.id}-${timeSlot}`;
                        
                        // Only render content for the first slot of each reservation
                        const shouldRenderReservation = reservationDetails?.isFirstSlot;
                        const isPartOfReservation = reservationDetails !== null;
                        
                        return (
                          <div 
                            key={cellId}
                            id={cellId}
                            onClick={() => !isPartOfReservation && handleCellClick(table.id, timeSlot)}
                            className={`border-b border-r min-h-[50px] relative ${
                              !isOpen 
                                ? 'bg-gray-200 border-gray-300 cursor-not-allowed' 
                                : isPartOfReservation
                                  ? reservationDetails.reservation.status === 'confirmed' 
                                    ? 'bg-green-100 border-green-300' 
                                    : 'bg-yellow-100 border-yellow-300'
                                  : 'bg-gray-50 hover:bg-blue-50 border-gray-200 cursor-pointer'
                            }`}
                            style={{
                              cursor: isPartOfReservation ? 'pointer' : isOpen ? 'pointer' : 'not-allowed'
                            }}
                          >
                            {shouldRenderReservation && (
                              <div
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', reservationDetails.reservation.id);
                                  setDraggedReservation(reservationDetails.reservation);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingReservation(reservationDetails.reservation);
                                  setEditDialogOpen(true);
                                }}
                                className="absolute inset-0 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity z-10 text-xs font-medium"
                                style={{
                                  width: `${reservationDetails.durationSlots * 100}%`,
                                  left: '0%',
                                  backgroundColor: reservationDetails.reservation.status === 'confirmed' 
                                    ? 'rgba(34, 197, 94, 0.2)' 
                                    : 'rgba(251, 191, 36, 0.2)',
                                  border: `2px solid ${reservationDetails.reservation.status === 'confirmed' 
                                    ? 'rgb(34, 197, 94)' 
                                    : 'rgb(251, 191, 36)'}`,
                                  borderRadius: '4px'
                                }}
                              >
                                <div className="text-center px-1">
                                  <div className="font-semibold text-foreground leading-tight truncate" title={reservationDetails.reservation.customer_name}>
                                    {reservationDetails.reservation.customer_name}
                                  </div>
                                  <div className="text-xs">
                                    {reservationDetails.reservation.guests}p • {reservationDetails.reservation.time.substring(0, 5)}
                                  </div>
                                  {reservationDetails.reservation.tableAssignments && reservationDetails.reservation.tableAssignments.length > 0 && (
                                    <div className="text-xs opacity-75">
                                      {reservationDetails.reservation.tableAssignments.map(t => t.table_name).join(', ')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {!isPartOfReservation && !isOpen && (
                              <div className="text-xs text-gray-500 flex items-center justify-center h-full">✕</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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