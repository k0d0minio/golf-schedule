import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/tenant', () => ({ getTenantId: vi.fn().mockResolvedValue('tenant-1') }));
vi.mock('@/lib/membership', () => ({ requireEditor: vi.fn(), getUserRole: vi.fn().mockResolvedValue('editor') }));
vi.mock('@/lib/supabase-server', () => ({ createTenantClient: vi.fn() }));
vi.mock('@/app/actions/days', () => ({ ensureDayExists: vi.fn().mockResolvedValue({ success: true, data: { id: 'day-1', date_iso: '2024-06-01' } }) }));

// ── Helpers ──────────────────────────────────────────────────────────────────

import { createTenantClient } from '@/lib/supabase-server';
import {
  createProgramItem,
  updateProgramItem,
  deleteProgramItem,
  deleteRecurrenceGroup,
  getProgramItemsForDay,
} from '@/app/actions/program-items';

type QueryResult = { data: unknown; error: { message: string } | null };

function makeChain(result: QueryResult = { data: null, error: null }) {
  const chain: Record<string, unknown> = {};
  ['select', 'insert', 'update', 'delete', 'upsert',
   'eq', 'neq', 'in', 'lt', 'lte', 'gt', 'gte', 'order', 'limit'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  (chain as { then?: unknown }).then = (fn: (v: QueryResult) => void) =>
    Promise.resolve(result).then(fn);
  return chain;
}

const VALID_ITEM = {
  title: 'Morning Round',
  type: 'golf' as const,
  dayId: '123e4567-e89b-12d3-a456-426614174000',
};

const ITEM_ROW = {
  id: 'item-1',
  tenant_id: 'tenant-1',
  day_id: VALID_ITEM.dayId,
  type: 'golf',
  title: 'Morning Round',
  is_recurring: false,
};

// ── createProgramItem ─────────────────────────────────────────────────────────

describe('createProgramItem (non-recurring)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error on schema validation failure', async () => {
    const result = await createProgramItem({ ...VALID_ITEM, title: '' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Title is required');
  });

  it('inserts a golf item and returns it', async () => {
    const from = vi.fn().mockReturnValue(makeChain({ data: ITEM_ROW, error: null }));
    vi.mocked(createTenantClient).mockResolvedValue({ supabase: { from } as never, tenantId: 'tenant-1' });

    const result = await createProgramItem(VALID_ITEM);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'golf', title: 'Morning Round' });
    expect(from).toHaveBeenCalledWith('program_item');
  });

  it('returns error when Supabase insert fails', async () => {
    const from = vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'db error' } }));
    vi.mocked(createTenantClient).mockResolvedValue({ supabase: { from } as never, tenantId: 'tenant-1' });

    const result = await createProgramItem(VALID_ITEM);
    expect(result.success).toBe(false);
    expect(result.error).toBe('db error');
  });
});

// ── createProgramItem (recurring) ────────────────────────────────────────────

describe('createProgramItem (recurring)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fans out to multiple day records and returns the first-day item', async () => {
    // Call sequence:
    // 1. from('day').select().eq().single() → date_iso
    // 2. from('day').select().eq().in() → all day rows (thenable)
    // 3. from('program_item').insert().select().eq().single() → inserted item

    const dayRow = { date_iso: '2024-06-01' };
    const allDayRows = [
      { id: 'day-1', date_iso: '2024-06-01' },
      { id: 'day-2', date_iso: '2024-06-08' },
    ];

    const from = vi.fn()
      .mockReturnValueOnce(makeChain({ data: dayRow, error: null }))          // fetch date_iso
      .mockReturnValueOnce(makeChain({ data: allDayRows, error: null }))      // fetch day IDs
      .mockReturnValue(makeChain({ data: ITEM_ROW, error: null }));           // insert items

    vi.mocked(createTenantClient).mockResolvedValue({ supabase: { from } as never, tenantId: 'tenant-1' });

    const result = await createProgramItem({
      ...VALID_ITEM,
      isRecurring: true,
      recurrenceFrequency: 'weekly',
    });

    expect(result.success).toBe(true);
    // insert should be called with an array of rows (one per occurrence)
    const insertFn = (from.mock.results[2].value as ReturnType<typeof makeChain>)
      .insert as ReturnType<typeof vi.fn>;
    const insertedRows = insertFn.mock.calls[0][0] as unknown[];
    expect(Array.isArray(insertedRows)).toBe(true);
    expect(insertedRows.length).toBeGreaterThan(1);
  });
});

// ── updateProgramItem ─────────────────────────────────────────────────────────

describe('updateProgramItem', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates the item and returns it', async () => {
    const updated = { ...ITEM_ROW, title: 'Afternoon Round' };
    const from = vi.fn().mockReturnValue(makeChain({ data: updated, error: null }));
    vi.mocked(createTenantClient).mockResolvedValue({ supabase: { from } as never, tenantId: 'tenant-1' });

    const result = await updateProgramItem('item-1', { ...VALID_ITEM, title: 'Afternoon Round' });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ title: 'Afternoon Round' });
  });

  it('returns error on schema validation failure', async () => {
    const result = await updateProgramItem('item-1', { ...VALID_ITEM, title: '' });
    expect(result.success).toBe(false);
  });
});

// ── deleteProgramItem ─────────────────────────────────────────────────────────

describe('deleteProgramItem', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes by id and tenant and returns success', async () => {
    const chain = makeChain({ data: null, error: null });
    const from = vi.fn().mockReturnValue(chain);
    vi.mocked(createTenantClient).mockResolvedValue({ supabase: { from } as never, tenantId: 'tenant-1' });

    const result = await deleteProgramItem('item-1');
    expect(result.success).toBe(true);
    expect(from).toHaveBeenCalledWith('program_item');
    expect((chain.delete as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it('returns error when Supabase delete fails', async () => {
    const from = vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'delete error' } }));
    vi.mocked(createTenantClient).mockResolvedValue({ supabase: { from } as never, tenantId: 'tenant-1' });

    const result = await deleteProgramItem('item-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('delete error');
  });
});

// ── deleteRecurrenceGroup ─────────────────────────────────────────────────────

describe('deleteRecurrenceGroup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes all items in the recurrence group', async () => {
    const chain = makeChain({ data: null, error: null });
    const from = vi.fn().mockReturnValue(chain);
    vi.mocked(createTenantClient).mockResolvedValue({ supabase: { from } as never, tenantId: 'tenant-1' });

    const result = await deleteRecurrenceGroup('group-abc');
    expect(result.success).toBe(true);

    // Must filter by recurrence_group_id
    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls).toContainEqual(['recurrence_group_id', 'group-abc']);
  });
});

// ── getProgramItemsForDay ─────────────────────────────────────────────────────

describe('getProgramItemsForDay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns items for the given day', async () => {
    const items = [ITEM_ROW, { ...ITEM_ROW, id: 'item-2', title: 'Evening Event' }];
    const from = vi.fn().mockReturnValue(makeChain({ data: items, error: null }));
    vi.mocked(createTenantClient).mockResolvedValue({ supabase: { from } as never, tenantId: 'tenant-1' });

    const result = await getProgramItemsForDay('day-1');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it('returns error when not authorized', async () => {
    const { getUserRole } = await import('@/lib/membership');
    vi.mocked(getUserRole).mockResolvedValue(null);

    const result = await getProgramItemsForDay('day-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authorized.');
  });
});
