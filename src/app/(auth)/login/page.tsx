'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FullPageSpinner } from '@/components/ui/spinner';
import { errorMessage } from '@/lib/api';
import { credentialsSchema, type Credentials } from '@/lib/schemas';
import { useCurrentUser, useLogin, useSetupStatus } from '@/hooks/use-auth';

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const setupStatus = useSetupStatus();
  const currentUser = useCurrentUser();

  // Nobody has set the instance up yet, or we are already signed in.
  useEffect(() => {
    if (setupStatus.data?.setupRequired) router.replace('/setup');
    else if (currentUser.data) router.replace('/drive');
  }, [setupStatus.data, currentUser.data, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => router.replace('/drive'),
      onError: (error) => toast.error(errorMessage(error)),
    });
  });

  if (setupStatus.isLoading || currentUser.isLoading) {
    return <FullPageSpinner label="Checking your session" />;
  }

  return (
    <div className="border-border bg-surface rounded-xl border p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold">Sign in</h2>
      <p className="text-muted-foreground mb-5 text-sm">
        Welcome back. Enter your credentials to continue.
      </p>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="username"
          autoFocus
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          placeholder="••••••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
