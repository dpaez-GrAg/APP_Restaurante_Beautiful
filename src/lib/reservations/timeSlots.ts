/**
 * Time slot utilities for reservation system
 * Centralizes time slot generation, validation, and normalization
 */

import { Schedule } from "@/types/reservation";

/**
 * Generate time slots at specified intervals between start and end times
 * @param startTime - Start time in HH:MM format
 * @param endTime - End time in HH:MM format
 * @param intervalMinutes - Interval between slots (default: 15)
 * @returns Array of time strings in HH:MM format
 */
export const generateTimeSlots = (
  startTime: string,
  endTime: string,
  intervalMinutes: number = 15
): string[] => {
  const slots: string[] = [];
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  let currentHour = startHour;
  let currentMin = startMin;

  while (currentHour < endHour || (currentHour === endHour && currentMin <= endMin)) {
    const timeString = `${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`;
    slots.push(timeString);

    currentMin += intervalMinutes;
    if (currentMin >= 60) {
      currentMin = 0;
      currentHour++;
    }
  }

  return slots;
};

/**
 * Generate time slots for multiple schedules (e.g., lunch and dinner)
 * @param schedules - Array of schedule objects
 * @param intervalMinutes - Interval between slots (default: 15)
 * @returns Array of time strings in HH:MM format
 */
export const generateTimeSlotsFromSchedules = (
  schedules: Schedule[],
  intervalMinutes: number = 15
): string[] => {
  if (schedules.length === 0) {
    return [];
  }

  const allSlots: string[] = [];

  schedules.forEach((schedule) => {
    const scheduleSlots = generateTimeSlots(
      schedule.opening_time,
      schedule.closing_time,
      intervalMinutes
    );
    allSlots.push(...scheduleSlots);
  });

  // Remove duplicates and sort
  return [...new Set(allSlots)].sort();
};

/**
 * Normalize a time to the nearest 15-minute slot
 * @param time - Time string in HH:MM format
 * @returns Normalized time in HH:MM format
 */
export const normalizeTimeToSlot = (time: string): string => {
  const [hours, minutes] = time.split(":").map(Number);
  
  // Round to nearest 15 minutes
  let normalizedMinutes = Math.round(minutes / 15) * 15;
  let normalizedHours = hours;
  
  if (normalizedMinutes === 60) {
    normalizedMinutes = 0;
    normalizedHours += 1;
  }
  
  return `${normalizedHours.toString().padStart(2, "0")}:${normalizedMinutes.toString().padStart(2, "0")}`;
};

/**
 * Format time for display (ensure HH:MM format)
 * @param time - Time string
 * @returns Formatted time in HH:MM format
 */
export const formatTimeDisplay = (time: string): string => {
  if (time.includes(":") && time.length === 5) {
    return time;
  }

  const [hours, minutes] = time.split(":");
  return `${hours.padStart(2, "0")}:${minutes?.padStart(2, "0") || "00"}`;
};

/**
 * Get the index of a time slot in an array of slots
 * @param time - Time string in HH:MM format
 * @param slots - Array of time slots
 * @returns Index of the slot, or -1 if not found
 */
export const getSlotIndex = (time: string, slots: string[]): number => {
  const normalizedTime = time.substring(0, 5);
  return slots.findIndex((slot) => slot === normalizedTime);
};

/**
 * Calculate duration in 15-minute slots
 * @param durationMinutes - Duration in minutes
 * @returns Number of 15-minute slots
 */
export const minutesToSlots = (durationMinutes: number): number => {
  return Math.ceil(durationMinutes / 15);
};

/**
 * Check if a time is within a schedule
 * @param time - Time to check in HH:MM format
 * @param schedule - Schedule object
 * @returns True if time is within schedule
 */
export const isTimeInSchedule = (time: string, schedule: Schedule): boolean => {
  const timeStr = time + ":00"; // Add seconds for comparison
  return timeStr >= schedule.opening_time && timeStr <= schedule.closing_time;
};

/**
 * Group time slots by schedule (useful for lunch/dinner separation)
 * @param slots - Array of time slots
 * @param schedules - Array of schedules
 * @returns Object with schedule indices as keys and slot arrays as values
 */
export const groupSlotsBySchedule = (
  slots: string[],
  schedules: Schedule[]
): Record<number, string[]> => {
  const grouped: Record<number, string[]> = {};

  schedules.forEach((schedule, index) => {
    grouped[index] = slots.filter((slot) => isTimeInSchedule(slot, schedule));
  });

  return grouped;
};

/**
 * Generate hour headers for timeline display
 * @param startHour - Starting hour (default: 12)
 * @param endHour - Ending hour (default: 23)
 * @returns Array of hour header objects
 */
export const generateHourHeaders = (startHour: number = 12, endHour: number = 23) => {
  const headers = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    headers.push({
      hour: `${hour.toString().padStart(2, "0")}h`,
      startSlotIndex: (hour - startHour) * 4,
      spanSlots: hour === endHour ? 3 : 4, // Last hour has only 3 slots (00, 15, 30)
    });
  }
  return headers;
};

/**
 * Check if a time slot is in the past for today
 * @param date - Date to check
 * @param time - Time slot in HH:MM format
 * @returns True if the slot is in the past
 */
export const isSlotInPast = (date: Date, time: string): boolean => {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (!isToday) {
    return false;
  }
  
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  return time < currentTime;
};
