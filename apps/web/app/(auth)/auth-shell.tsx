import { ThemeToggle } from '@/components/theme-toggle';
import { LogoLockup } from '@/components/logo';

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col p-6">
      <div className="fixed right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="m-auto flex w-full max-w-sm flex-col items-center gap-8 py-4">
        <LogoLockup />
        {children}
      </div>
    </main>
  );
}
