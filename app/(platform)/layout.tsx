import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 h-14 flex items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/auth/sign-in">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/new">
            <Button size="sm">Get started</Button>
          </Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
