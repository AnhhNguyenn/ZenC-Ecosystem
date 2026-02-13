"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { Mail, Lock, User } from 'lucide-react';
import styles from './page.module.scss'; // Reuse/adapt structure

const registerSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setError(null);
    try {
      // TODO: Replace with real Auth Service call
      console.log('Register attempt:', data);
      await new Promise(resolve => setTimeout(resolve, 1500));
      router.push('/dashboard');
    } catch (err) {
      setError('Registration failed. Please try again.');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.logoWrapper}>
        <Logo size="lg" />
      </div>

      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Join ZenC AI to master English conversation</CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className={styles.formContent}>
            {error && (
              <div className={styles.errorAlert}>
                {error}
              </div>
            )}
            
            <Input
              id="fullName"
              label="Full Name"
              placeholder="John Doe"
              icon={<User size={16} />}
              error={errors.fullName?.message}
              {...register('fullName')}
            />

            <Input
              id="email"
              label="Email"
              placeholder="name@example.com"
              type="email"
              icon={<Mail size={16} />}
              error={errors.email?.message}
              {...register('email')}
            />
            
            <Input
              id="password"
              label="Password"
              type="password"
              icon={<Lock size={16} />}
              error={errors.password?.message}
              {...register('password')}
            />

            <Input
              id="confirmPassword"
              label="Confirm Password"
              type="password"
              icon={<Lock size={16} />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </CardContent>
          
          <CardFooter className={styles.footer}>
            <Button 
              type="submit" 
              className={styles.submitButton}
              isLoading={isSubmitting}
            >
              Get Started
            </Button>
            
            <p className={styles.loginText}>
              Already have an account?{' '}
              <Link href="/login" className={styles.loginLink}>
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
