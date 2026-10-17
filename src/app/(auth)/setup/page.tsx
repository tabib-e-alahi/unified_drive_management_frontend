'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FullPageSpinner } from '@/components/ui/spinner';
import { errorMessage } from '@/lib/api';
import { registerSchema, type RegisterInput } from '@/lib/schemas';
import { useRegister, useSetupStatus } from '@/hooks/use-auth';

/**
 * First-run screen. The backend permanently closes registration once a user
 * exists, so this is reachable exactly once per instance.
 */
export default function SetupPage() {
  const router = useRouter();
  const setupStatus = useSetupStatus();
  const registerOwner = useRegister();

  /*
   * Bounce to login if this instance already has an owner — but not while our
   * own registration is in flight. Registering flips `setupRequired` to false,
   * which would otherwise fire this guard and redirect the new owner to
   * /login instead of the accounts page they should land on.
   */
  const registrationInFlight =
    registerOwner.isPending || registerOwner.isSuccess;
  useEffect(() => {
    if (registrationInFlight) return;
    if (setupStatus.data && !setupStatus.data.setupRequired) {
      router.replace('/login');
    }
  }, [setupStatus.data, router, registrationInFlight]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    registerOwner.mutate(values, {
      onSuccess: () => {
        toast.success('Account created. Next, link a Google account.');
        router.replace('/accounts');
      },
      onError: (error) => toast.error(errorMessage(error)),
    });
  });

  if (setupStatus.isLoading) {
    return <FullPageSpinner label="Checking setup status" />;
  }

  return (
    <div className="border-border bg-surface rounded-xl border p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold">Create your account</h2>
      <p className="text-muted-foreground mb-5 text-sm">
        This is a single-owner instance. Once you create this account,
        registration closes permanently.
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
          autoComplete="new-password"
          placeholder="At least 12 characters"
          hint="At least 12 characters. Use a password manager."
          error={errors.password?.message}
          {...register('password')}
        />
        <Button
          type="submit"
          className="w-full"
          loading={registerOwner.isPending}
        >
          Create account
        </Button>
      </form>

      <p className="text-muted-foreground mt-5 flex items-start gap-2 text-xs">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Your session is stored in an httpOnly cookie, and Google refresh
          tokens are encrypted before they reach the database.
        </span>
      </p>
    </div>
  );
}
