import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/app/actions/auth';

function makeAuthClient(signInResult: { error: { message: string } | null }) {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: signInResult.error }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

// ── signIn ────────────────────────────────────────────────────────────────────

describe('signIn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when credentials are invalid', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeAuthClient({ error: { message: 'Invalid login credentials' } }) as never
    );

    const formData = new FormData();
    formData.set('email', 'wrong@example.com');
    formData.set('password', 'badpassword');

    const result = await signIn(null, formData);
    expect(result).toEqual({ error: 'Invalid login credentials' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects to / on successful sign-in (no redirectTo)', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeAuthClient({ error: null }) as never
    );

    const formData = new FormData();
    formData.set('email', 'user@example.com');
    formData.set('password', 'correct');

    await signIn(null, formData);
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('redirects to the given redirectTo path after sign-in', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeAuthClient({ error: null }) as never
    );

    const formData = new FormData();
    formData.set('email', 'user@example.com');
    formData.set('password', 'correct');
    formData.set('redirectTo', '/day/2024-06-15');

    await signIn(null, formData);
    expect(redirect).toHaveBeenCalledWith('/day/2024-06-15');
  });
});

// ── signOut ───────────────────────────────────────────────────────────────────

describe('signOut', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls signOut on the Supabase client and redirects to sign-in', async () => {
    const client = makeAuthClient({ error: null });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);

    await signOut();

    expect(client.auth.signOut).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/auth/sign-in');
  });
});
