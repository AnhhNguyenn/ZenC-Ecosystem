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
import { Mail, Lock } from 'lucide-react';
import styles from './page.module.scss';
import axios from 'axios'; // We'll replace with configured instance later
import { useAuth } from '@/features/auth/AuthContext';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const { login } = useAuth();

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await axios.post(`${apiUrl}/auth/login`, data);
      
      const { access_token, user } = response.data;
      
      // If backend only returns token, decode it or fetch user profile
      // For now assume response structure: { access_token: string, user: { id, email } }
      // If user is missing from login response, fetch it:
      // const userRes = await axios.get(`${apiUrl}/users/me`, { headers: { Authorization: `Bearer ${access_token}` } });
      
      login(access_token, user || { id: 'uuid', email: data.email }); // Fallback for safety
      
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Invalid email or password');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.logoWrapper}>
        <Logo size="lg" />
      </div>

      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Enter your email to sign in to your account</CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className={styles.formContent}>
            {error && (
              <div className={styles.errorAlert}>
                {error}
              </div>
            )}
            
            <Input
              id="email"
              label="Email"
              placeholder="name@example.com"
              type="email"
              icon={<Mail size={16} />}
              error={errors.email?.message}
              {...register('email')}
            />
            
            <div className={styles.passwordWrapper}>
              <Input
                id="password"
                label="Password"
                type="password"
                icon={<Lock size={16} />}
                error={errors.password?.message}
                {...register('password')}
              />
              <Link href="/forgot-password" className={styles.forgotLink}>
                Forgot password?
              </Link>
            </div>
          </CardContent>
          
          <CardFooter className={styles.footer}>
            <Button 
              type="submit" 
              className={styles.submitButton}
              isLoading={isSubmitting}
            >
              Sign In
            </Button>
            
            <p className={styles.registerText}>
              Don't have an account?{' '}
              <Link href="/register" className={styles.registerLink}>
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
