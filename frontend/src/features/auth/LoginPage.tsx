import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { loginRequestSchema, type LoginRequest } from '@hosni/shared';
import { useLogin } from './hooks';
import { ApiError } from '../../lib/apiClient';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';

export default function LoginPage() {
  const { t } = useTranslation();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(
    (values) => {
      login.mutate(values);
    },
    (fieldErrors) => {
      const first = Object.keys(fieldErrors)[0] as keyof LoginRequest | undefined;
      if (first) setFocus(first);
    },
  );

  const topError =
    login.error instanceof ApiError
      ? login.error.code === 'RATE_LIMITED'
        ? t('auth.rateLimited')
        : t('auth.invalidCredentials')
      : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-6 shadow-card">
        <h1 className="mb-1 text-xl font-bold text-primary">{t('app.name')}</h1>
        <p className="mb-6 text-sm text-muted">{t('auth.welcome')}</p>

        {topError && (
          <div
            role="alert"
            className="mb-4 rounded-sm border border-error bg-surface-alt px-3 py-2 text-sm text-error"
          >
            {topError}
          </div>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <TextField
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            inputMode="email"
            helper={t('auth.emailHelp')}
            error={errors.email ? t('auth.email') : undefined}
            {...register('email')}
          />
          <TextField
            label={t('auth.password')}
            type="password"
            autoComplete="current-password"
            helper={t('auth.passwordHelp')}
            error={errors.password ? t('auth.password') : undefined}
            {...register('password')}
          />
          <Button type="submit" variant="accent" disabled={isSubmitting || login.isPending}>
            {login.isPending ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
        </form>
      </div>
    </div>
  );
}
