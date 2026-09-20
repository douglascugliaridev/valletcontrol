'use client';

import { Card, CardHeader, CardTitle, Input, Label } from '@/components/ui';
import { AuthShell } from '../(auth)/auth-shell';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiClient, authErrorMessage, setSession } from '@/lib/api';
import { Spinner } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.login({ email, password });
      setSession(res.tokens.accessToken, res.user);
      router.replace('/dashboard');
    } catch (err) {
      setError(authErrorMessage(err, 'Não foi possível entrar. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Entrar</CardTitle>
          <p className="text-sm text-muted-foreground">
            Acesse sua conta para ver seu controle financeiro.
          </p>
        </CardHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4 p-5 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <Spinner className="size-4" />}
            Entrar
          </button>
          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{' '}
            <a href="/register" className="font-medium text-primary hover:underline">
              Cadastre-se
            </a>
          </p>
        </form>
      </Card>
    </AuthShell>
  );
}
