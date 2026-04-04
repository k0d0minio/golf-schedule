import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getTenantFromHeaders } from '@/lib/tenant';
import { getAuthState } from '@/app/actions/auth';
import { ensureDayExists } from '@/app/actions/days';
import { isPastDate, isDateWithinOneYear, getTenantToday } from '@/lib/day-utils';
import {
  getProgramItemsForDay,
  getReservationsForDay,
  getHotelBookingsForDate,
  getBreakfastConfigForDay,
} from './queries';
import { DayViewClient } from './DayViewClient';
import type { ProgramItem, Reservation, HotelBooking, BreakfastConfiguration } from '@/types/index';
import type { AuthState } from '@/types/actions';

export type DayViewProps = {
  date: string;
  programItems: ProgramItem[];
  reservations: Reservation[];
  hotelBookings: HotelBooking[];
  breakfastConfig: BreakfastConfiguration | null;
  authState: AuthState;
};

const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const tenant = await getTenantFromHeaders();

  // Fetch tenant timezone
  const supabase = await createSupabaseServerClient();
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('timezone')
    .eq('id', tenant.id)
    .single();
  const timezone = tenantRow?.timezone ?? 'UTC';

  const today = getTenantToday(timezone);

  // Validate date — redirect to today on any invalid input
  if (
    !YMD_REGEX.test(date) ||
    isPastDate(date, timezone) ||
    !isDateWithinOneYear(date, timezone)
  ) {
    redirect(`/day/${today}`);
  }

  // Ensure Day row exists (idempotent)
  const dayResult = await ensureDayExists(date);
  if (!dayResult.success) redirect(`/day/${today}`);
  const day = dayResult.data;

  // Load all day data + auth state in parallel
  const [programItems, reservations, hotelBookings, breakfastConfig, authState] =
    await Promise.all([
      getProgramItemsForDay(tenant.id, day.id),
      getReservationsForDay(tenant.id, day.id),
      getHotelBookingsForDate(tenant.id, date),
      getBreakfastConfigForDay(tenant.id, day.id),
      getAuthState(),
    ]);

  return (
    <DayViewClient
      date={date}
      programItems={programItems}
      reservations={reservations}
      hotelBookings={hotelBookings}
      breakfastConfig={breakfastConfig}
      authState={authState}
    />
  );
}
