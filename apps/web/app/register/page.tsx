'use client';

import { Card, CardHeader, CardTitle, Input, Label, Spinner } from '@/components/ui';
import { AuthShell } from '../(auth)/auth-shell';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiClient, authErrorMessage, setSession } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.register({ name, email, password });
      setSession(res.tokens.accessToken, res.user);
      router.replace('/dashboard');
    } catch (err) {
      setError(
        authErrorMessage(err, 'Não foi possível criar a conta. Tente novamente.'),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Criar conta</CardTitle>
          <p className="text-sm text-muted-foreground">Seus dados são isolados por usuário.</p>
        </CardHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4 p-5 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              required
              minLength={2}
              placeholder="Maria Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
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
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
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
            Cadastrar
          </button>
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <a href="/login" className="font-medium text-primary hover:underline">
              Entrar
            </a>
          </p>
        </form>
      </Card>
    </AuthShell>
  );
}
