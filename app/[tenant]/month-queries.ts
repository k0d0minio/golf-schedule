import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { ProgramItem, Reservation, HotelBooking, BreakfastConfiguration } from '@/types/index';

/**
 * Returns all program items for days whose date_iso falls in [start, end].
 * dayIds should be the IDs returned by ensureDaysRange for the same range.
 */
export async function getProgramItemsForMonth(
  tenantId: string,
  dayIds: string[]
): Promise<ProgramItem[]> {
  if (dayIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('program_item')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('day_id', dayIds);
  return (data ?? []) as ProgramItem[];
}

/**
 * Returns all reservations for days whose date_iso falls in [start, end].
 */
export async function getReservationsForMonth(
  tenantId: string,
  dayIds: string[]
): Promise<Reservation[]> {
  if (dayIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('reservation')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('day_id', dayIds);
  return (data ?? []) as Reservation[];
}

/**
 * Returns hotel bookings overlapping the [start, end] range.
 * Overlap: check_in < end AND check_out > start.
 */
export async function getHotelBookingsForMonth(
  tenantId: string,
  start: string,
  end: string
): Promise<HotelBooking[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('hotel_booking')
    .select('*')
    .eq('tenant_id', tenantId)
    .lt('check_in', end)
    .gt('check_out', start);
  return (data ?? []) as HotelBooking[];
}

/**
 * Returns all breakfast configs whose breakfast_date falls in [start, end].
 */
export async function getBreakfastConfigsForMonth(
  tenantId: string,
  start: string,
  end: string
): Promise<BreakfastConfiguration[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('breakfast_configuration')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('breakfast_date', start)
    .lte('breakfast_date', end);
  return (data ?? []) as BreakfastConfiguration[];
}
