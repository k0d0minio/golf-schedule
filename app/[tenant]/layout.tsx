import { Logo } from '@/components/logo';
import { UserMenu } from '@/components/user-menu';
import { getUser } from '@/app/actions/auth';
import { getTenantFromHeaders } from '@/lib/tenant';
import { TenantProvider } from '@/lib/tenant-context';

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, tenant] = await Promise.all([
    getUser(),
    getTenantFromHeaders(),
  ]);

  return (
    <TenantProvider tenantId={tenant.id} tenantSlug={tenant.slug}>
      <div className="min-h-screen flex flex-col">
        <header className="border-b px-6 h-14 flex items-center justify-between">
          <Logo />
          {user && <UserMenu user={user} />}
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </TenantProvider>
  );
}
