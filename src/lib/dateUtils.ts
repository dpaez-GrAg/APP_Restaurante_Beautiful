/**
 * Helper function to format date as YYYY-MM-DD in local timezone
 * Avoids UTC conversion issues when saving dates
 */
export const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Check if a date falls within special closed days
 */
export const isDateClosed = (
  date: Date, 
  specialClosedDays: Array<{
    date: string;
    is_range: boolean;
    range_start?: string;
    range_end?: string;
  }>
): boolean => {
  const dateStr = formatDateLocal(date);
  
  return specialClosedDays.some(closedDay => {
    if (closedDay.is_range) {
      return closedDay.range_start && closedDay.range_end &&
             dateStr >= closedDay.range_start && 
             dateStr <= closedDay.range_end;
    } else {
      return closedDay.date === dateStr;
    }
  });
};

/**
 * Get special schedule for a specific date
 */
export const getSpecialSchedule = (
  date: Date,
  specialSchedules: Array<{
    date: string;
    opening_time: string;
    closing_time: string;
    is_active: boolean;
  }>
) => {
  const dateStr = formatDateLocal(date);
  return specialSchedules.find(
    schedule => schedule.date === dateStr && schedule.is_active
  );
};