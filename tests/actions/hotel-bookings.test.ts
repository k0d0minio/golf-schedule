import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/tenant', () => ({ getTenantId: vi.fn().mockResolvedValue('tenant-1') }));
vi.mock('@/lib/membership', () => ({ requireEditor: vi.fn(), getUserRole: vi.fn().mockResolvedValue('editor') }));
vi.mock('@/lib/supabase-server', () => ({ createTenantClient: vi.fn() }));

// ── Helpers ──────────────────────────────────────────────────────────────────

import { createTenantClient } from '@/lib/supabase-server';
import {
  createHotelBooking,
  updateHotelBooking,
  deleteHotelBooking,
} from '@/app/actions/hotel-bookings';
import { hotelBookingSchema } from '@/lib/hotel-booking-schema';

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };

/** Creates a chainable query builder that is also directly awaitable. */
function makeChain(result: QueryResult = { data: null, error: null }) {
  const chain: Record<string, unknown> = {};
  ['select', 'insert', 'update', 'delete', 'upsert',
   'eq', 'neq', 'in', 'lt', 'lte', 'gt', 'gte', 'order', 'limit'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  // Thenable: allows `await supabase.from('t').insert(...)` without .single()
  (chain as { then?: unknown }).then = (fn: (v: QueryResult) => void) =>
    Promise.resolve(result).then(fn);
  return chain;
}

const VALID_BOOKING = {
  guestName: 'Smith Party',
  guestCount: 4,
  checkIn: '2024-06-01',
  checkOut: '2024-06-04',
  isTourOperator: false,
};

const BOOKING_ROW = {
  id: 'booking-1',
  tenant_id: 'tenant-1',
  ...VALID_BOOKING,
  notes: null,
};

// ── hotelBookingSchema ────────────────────────────────────────────────────────

describe('hotelBookingSchema', () => {
  it('accepts a valid booking', () => {
    expect(hotelBookingSchema.safeParse(VALID_BOOKING).success).toBe(true);
  });

  it('rejects empty guestName', () => {
    const r = hotelBookingSchema.safeParse({ ...VALID_BOOKING, guestName: '' });
    expect(r.success).toBe(false);
  });

  it('rejects guestCount less than 1', () => {
    const r = hotelBookingSchema.safeParse({ ...VALID_BOOKING, guestCount: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects checkOut on same day as checkIn', () => {
    const r = hotelBookingSchema.safeParse({ ...VALID_BOOKING, checkOut: '2024-06-01' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe('Check-out must be after check-in');
  });

  it('rejects checkOut before checkIn', () => {
    const r = hotelBookingSchema.safeParse({ ...VALID_BOOKING, checkOut: '2024-05-31' });
    expect(r.success).toBe(false);
  });
});

// ── createHotelBooking ────────────────────────────────────────────────────────

describe('createHotelBooking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error on schema validation failure', async () => {
    const result = await createHotelBooking({
      ...VALID_BOOKING,
      guestName: '',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('inserts the booking and auto-creates breakfast configs for each night', async () => {
    const from = vi.fn()
      .mockReturnValueOnce(makeChain({ data: BOOKING_ROW, error: null }))   // hotel_booking insert
      .mockReturnValue(makeChain({ data: null, error: null }));              // breakfast_configuration insert

    vi.mocked(createTenantClient).mockResolvedValue({
      supabase: { from } as never,
      tenantId: 'tenant-1',
    });

    const result = await createHotelBooking(VALID_BOOKING);

    expect(result.success).toBe(true);

    // breakfast_configuration.insert should be called once, for nights Jun 1, Jun 2, Jun 3
    const bfFrom = from.mock.calls.find(([table]) => table === 'breakfast_configuration');
    expect(bfFrom).toBeDefined();

    const insertCall = (from.mock.results.find((_, i) =>
      from.mock.calls[i]?.[0] === 'breakfast_configuration'
    )?.value as ReturnType<typeof makeChain>);
    expect((insertCall?.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]).toHaveLength(3); // 3 nights
  });

  it('returns error when Supabase insert fails', async () => {
    const from = vi.fn().mockReturnValue(
      makeChain({ data: null, error: { message: 'insert error' } })
    );

    vi.mocked(createTenantClient).mockResolvedValue({
      supabase: { from } as never,
      tenantId: 'tenant-1',
    });

    const result = await createHotelBooking(VALID_BOOKING);
    expect(result.success).toBe(false);
    expect(result.error).toBe('insert error');
  });
});

// ── updateHotelBooking ────────────────────────────────────────────────────────

describe('updateHotelBooking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reconciles breakfast configs when check-out is extended by one night', async () => {
    // Existing: Jun 1–3 (nights: Jun 1, Jun 2)
    // Updated:  Jun 1–4 (nights: Jun 1, Jun 2, Jun 3) → toAdd: Jun 3
    const updatedBooking = { ...BOOKING_ROW, check_out: '2024-06-04' };

    const from = vi.fn()
      .mockReturnValueOnce(makeChain({ data: { check_in: '2024-06-01', check_out: '2024-06-03' }, error: null }))
      .mockReturnValueOnce(makeChain({ data: updatedBooking, error: null }))
      .mockReturnValue(makeChain({ data: null, error: null })); // breakfast_configuration insert

    vi.mocked(createTenantClient).mockResolvedValue({
      supabase: { from } as never,
      tenantId: 'tenant-1',
    });

    const result = await updateHotelBooking('booking-1', {
      ...VALID_BOOKING,
      checkOut: '2024-06-04',
    });

    expect(result.success).toBe(true);

    // Verify breakfast_configuration insert was called for the new night
    const insertCalls = from.mock.calls
      .map((args, i) => ({ table: args[0], chain: from.mock.results[i].value }))
      .filter(({ table }) => table === 'breakfast_configuration');

    expect(insertCalls.length).toBeGreaterThan(0);
    const insertArgs = (insertCalls[0].chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(insertArgs).toContainEqual(expect.objectContaining({ breakfast_date: '2024-06-03' }));
  });

  it('returns error when initial fetch fails', async () => {
    const from = vi.fn().mockReturnValue(
      makeChain({ data: null, error: { message: 'fetch error' } })
    );

    vi.mocked(createTenantClient).mockResolvedValue({
      supabase: { from } as never,
      tenantId: 'tenant-1',
    });

    const result = await updateHotelBooking('booking-1', VALID_BOOKING);
    expect(result.success).toBe(false);
    expect(result.error).toBe('fetch error');
  });
});

// ── deleteHotelBooking ────────────────────────────────────────────────────────

describe('deleteHotelBooking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the booking and returns success', async () => {
    const chain = makeChain({ data: null, error: null });
    const from = vi.fn().mockReturnValue(chain);

    vi.mocked(createTenantClient).mockResolvedValue({
      supabase: { from } as never,
      tenantId: 'tenant-1',
    });

    const result = await deleteHotelBooking('booking-1');
    expect(result.success).toBe(true);
    expect(from).toHaveBeenCalledWith('hotel_booking');
    expect((chain.delete as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it('returns error when Supabase delete fails', async () => {
    const from = vi.fn().mockReturnValue(
      makeChain({ data: null, error: { message: 'delete error' } })
    );

    vi.mocked(createTenantClient).mockResolvedValue({
      supabase: { from } as never,
      tenantId: 'tenant-1',
    });

    const result = await deleteHotelBooking('booking-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('delete error');
  });
});
