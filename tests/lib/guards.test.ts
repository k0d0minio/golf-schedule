import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('@/app/actions/auth', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/lib/membership', () => ({
  getUserRole: vi.fn(),
}));

vi.mock('@/lib/tenant', () => ({
  getTenantFromHeaders: vi.fn().mockResolvedValue({ id: 'tenant-1', slug: 'test' }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

import { getUser } from '@/app/actions/auth';
import { getUserRole } from '@/lib/membership';
import { redirect, notFound } from 'next/navigation';
import { requireAuth, requireTenantMember, requireTenantEditor } from '@/lib/guards';

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

// ── requireAuth ───────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls redirect to sign-in when user is not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null);
    await requireAuth();
    expect(redirect).toHaveBeenCalledWith('/auth/sign-in');
  });

  it('returns the user when authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(MOCK_USER as never);
    const user = await requireAuth();
    expect(user).toBe(MOCK_USER);
    expect(redirect).not.toHaveBeenCalled();
  });
});

// ── requireTenantMember ───────────────────────────────────────────────────────

describe('requireTenantMember', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls redirect to sign-in when unauthenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null);
    await requireTenantMember();
    expect(redirect).toHaveBeenCalledWith('/auth/sign-in');
  });

  it('calls notFound when user is not a member of the tenant', async () => {
    vi.mocked(getUser).mockResolvedValue(MOCK_USER as never);
    vi.mocked(getUserRole).mockResolvedValue(null);
    await requireTenantMember();
    expect(notFound).toHaveBeenCalled();
  });

  it('returns { user, role } for a viewer member', async () => {
    vi.mocked(getUser).mockResolvedValue(MOCK_USER as never);
    vi.mocked(getUserRole).mockResolvedValue('viewer');
    const result = await requireTenantMember();
    expect(result.user).toBe(MOCK_USER);
    expect(result.role).toBe('viewer');
    expect(redirect).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });

  it('returns { user, role } for an editor member', async () => {
    vi.mocked(getUser).mockResolvedValue(MOCK_USER as never);
    vi.mocked(getUserRole).mockResolvedValue('editor');
    const result = await requireTenantMember();
    expect(result.role).toBe('editor');
  });
});

// ── requireTenantEditor ───────────────────────────────────────────────────────

describe('requireTenantEditor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls redirect to / when user is a viewer', async () => {
    vi.mocked(getUser).mockResolvedValue(MOCK_USER as never);
    vi.mocked(getUserRole).mockResolvedValue('viewer');
    await requireTenantEditor();
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('returns { user, role: editor } for an editor', async () => {
    vi.mocked(getUser).mockResolvedValue(MOCK_USER as never);
    vi.mocked(getUserRole).mockResolvedValue('editor');
    const result = await requireTenantEditor();
    expect(result.role).toBe('editor');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('calls redirect to sign-in when unauthenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null);
    await requireTenantEditor();
    expect(redirect).toHaveBeenCalledWith('/auth/sign-in');
  });
});
