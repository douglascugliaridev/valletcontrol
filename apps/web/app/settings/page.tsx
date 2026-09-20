'use client';

import { clearSession, getStoredUser, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button, Spinner } from '@/components/ui';
import { CardsManager } from '@/components/cards-manager';
import { Logo } from '@/components/logo';
import { LayoutDashboard, LogOut, Settings as SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { RecurringRulesManager } from '@/components/recurring-rules-manager';
import { ThemeToggle } from '@/components/theme-toggle';

export default function SettingsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setAuthed(true);
  }, [router]);

  const user = useMemo(() => getStoredUser(), []);

  const logout = () => {
    clearSession();
    router.replace('/login');
  };

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-4 pb-16 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Logo />
          <div className="leading-tight">
            <p className="font-semibold">ValletControl</p>
            <p className="text-xs text-muted-foreground">
              {user?.name ? `Olá, ${String(user.name).split(' ')[0]}` : 'Olá'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" onClick={logout} aria-label="Sair" className="px-2 sm:px-4">
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SettingsIcon className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Configurações</h1>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            <LayoutDashboard className="size-4" />
            Voltar ao dashboard
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-6">
        <RecurringRulesManager />
        <CardsManager />
      </div>
    </main>
  );
}
