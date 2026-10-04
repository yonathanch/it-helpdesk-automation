'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordField } from '@/components/ui/password-field';
import { FieldError, FieldHint, FormAlert } from '@/components/ui/form-alert';
import { toUserMessage } from '@/lib/api-error';
import { homeForRole } from '@/lib/navigation';

/**
 * Aturan mencerminkan RegisterDto backend:
 * name min 2, email format email, password min 8.
 */
const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Nama minimal 2 karakter')
      .max(100, 'Nama terlalu panjang'),
    email: z
      .string()
      .min(1, 'Email wajib diisi')
      .email('Format email tidak valid'),
    department: z.string().max(120, 'Nama departemen terlalu panjang').optional(),
    password: z
      .string()
      .min(8, 'Password minimal 8 karakter')
      .max(72, 'Password terlalu panjang'),
    confirmPassword: z.string().min(1, 'Ulangi password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Konfirmasi password tidak sama',
    path: ['confirmPassword'],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const { register: registerAccount } = useAuth();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      department: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const user = await registerAccount({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        department: values.department?.trim() || undefined,
      });
      router.replace(homeForRole(user.role));
    } catch (error) {
      setServerError(toUserMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Buat akun</h1>
        <p className="text-sm text-muted-foreground">
          Akun baru otomatis mendapat peran pengguna. Hubungi admin bila Anda
          memerlukan akses agen IT.
        </p>
      </div>

      <FormAlert message={serverError} />

      <div className="space-y-1.5">
        <Label htmlFor="name" required>
          Nama lengkap
        </Label>
        <Input
          id="name"
          autoComplete="name"
          placeholder="Budi Santoso"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'name-error' : undefined}
          {...register('name')}
        />
        <FieldError id="name-error" message={errors.name?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" required>
          Email
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="nama@perusahaan.com"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
        <FieldError id="email-error" message={errors.email?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="department">Departemen</Label>
        <Input
          id="department"
          autoComplete="organization"
          placeholder="Opsional — mis. Finance"
          aria-invalid={Boolean(errors.department)}
          aria-describedby={
            errors.department ? 'department-error' : 'department-hint'
          }
          {...register('department')}
        />
        {errors.department ? (
          <FieldError id="department-error" message={errors.department?.message} />
        ) : (
          <FieldHint id="department-hint">
            Membantu tim IT memahami konteks bisnis Anda.
          </FieldHint>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" required>
          Password
        </Label>
        <PasswordField
          id="password"
          autoComplete="new-password"
          placeholder="Minimal 8 karakter"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password ? 'password-error' : 'password-hint'
          }
          {...register('password')}
        />
        {errors.password ? (
          <FieldError id="password-error" message={errors.password?.message} />
        ) : (
          <FieldHint id="password-hint">
            Gunakan kombinasi huruf dan angka yang sulit ditebak.
          </FieldHint>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword" required>
          Ulangi password
        </Label>
        <PasswordField
          id="confirmPassword"
          autoComplete="new-password"
          placeholder="Ketik ulang password"
          aria-invalid={Boolean(errors.confirmPassword)}
          aria-describedby={
            errors.confirmPassword ? 'confirm-error' : undefined
          }
          {...register('confirmPassword')}
        />
        <FieldError
          id="confirm-error"
          message={errors.confirmPassword?.message}
        />
      </div>

      <Button type="submit" className="w-full" loading={isSubmitting}>
        {isSubmitting ? 'Mendaftarkan…' : 'Daftar'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Sudah punya akun?{' '}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Masuk
        </Link>
      </p>
    </form>
  );
}
