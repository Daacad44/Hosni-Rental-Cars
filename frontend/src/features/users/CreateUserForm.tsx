import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { createUserRequestSchema, ROLES, type CreateUserRequest } from '@hosni/shared';
import { useCreateUser } from './hooks';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { ApiError } from '../../lib/apiClient';

export function CreateUserForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const createUser = useCreateUser();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserRequest>({
    resolver: zodResolver(createUserRequestSchema),
    mode: 'onBlur',
    defaultValues: { role: 'AGENT', locale: 'so' },
  });

  const onSubmit = handleSubmit((values) => {
    createUser.mutate(values, { onSuccess: onDone });
  });

  const topError = createUser.error instanceof ApiError ? createUser.error.message : null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {topError && (
        <div role="alert" className="rounded-sm border border-error bg-surface-alt px-3 py-2 text-sm text-error">
          {topError}
        </div>
      )}
      <TextField
        label={t('users.name')}
        helper={t('users.nameHelp')}
        error={errors.name?.message}
        {...register('name')}
      />
      <TextField
        label={t('auth.email')}
        type="email"
        inputMode="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        label={t('auth.password')}
        type="password"
        helper={t('users.passwordHelp')}
        error={errors.password?.message}
        {...register('password')}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="role" className="text-sm font-medium text-foreground">
          {t('users.role')}
        </label>
        <select
          id="role"
          className="min-h-[44px] rounded-md border border-border bg-surface px-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          {...register('role')}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone} type="button">
          {t('common.cancel')}
        </Button>
        <Button variant="accent" type="submit" disabled={createUser.isPending}>
          {t('common.create')}
        </Button>
      </div>
    </form>
  );
}
