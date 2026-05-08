'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Building2, User, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  companyName: z.string().min(2, 'Organization is required'),
  username: z.string().min(2, 'Username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const login = useAuthStore((s) => s.login);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { companyName: '', username: '', password: '' },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await login(data.companyName, data.username, data.password);
      toast({ title: 'Welcome back!', description: 'Login successful.' });
      router.push('/dashboard');
    } catch (err: any) {
      toast({
        title: 'Login failed',
        description: err?.response?.data?.message || err?.message || 'Invalid credentials',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-[#1e3a5f]">
      {/* Decorative Elements */}
      <div
        className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          filter: 'blur(80px)',
        }}
      />
      <div
        className="absolute bottom-[-10%] left-[-5%] w-[35%] h-[35%] rounded-full"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          filter: 'blur(80px)',
        }}
      />

      <div className="min-h-screen relative z-10 flex flex-col lg:flex-row">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] items-center justify-center p-10">
          <div className="max-w-xl text-center">
            {/* Logo */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
                <span className="text-2xl font-bold text-white">PE</span>
              </div>
            </div>
            <h1 className="text-5xl font-bold text-white tracking-tight mb-2">
              ProcunexPro
            </h1>
            <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-200 bg-blue-500/20 rounded-full border border-blue-400/30 mb-8">
              Enterprise
            </span>
            <p className="text-xl text-white/90 leading-relaxed max-w-lg mx-auto mb-10">
              Enterprise Procurement & Inventory Management
              <br />
              <span className="text-white/70">
                Streamline purchasing, vendors, and stock control
              </span>
            </p>

            {/* Stats */}
            <div className="flex gap-12 justify-center mt-10">
              <div className="text-center">
                <div className="text-4xl font-bold text-white">100%</div>
                <div className="text-sm text-white/70 mt-1">Cloud-Based</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-white">24/7</div>
                <div className="text-sm text-white/70 mt-1">Access</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-white">Secure</div>
                <div className="text-sm text-white/70 mt-1">Multi-Tenant</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
          <div
            className="w-full max-w-md bg-white rounded-2xl border-none"
            style={{
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              padding: '48px 40px',
            }}
          >
            {/* Logo inside card */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-3 mb-3">
                <div className="w-11 h-11 bg-gradient-to-br from-slate-700 to-[#1e3a5f] rounded-xl flex items-center justify-center">
                  <span className="text-sm font-bold text-white">PE</span>
                </div>
                <span className="text-2xl font-bold text-slate-800 tracking-tight">ProcunexPro</span>
              </div>
              <p className="text-sm text-gray-500">Sign in to your account</p>
            </div>

            {/* Mobile branding - only visible on small screens */}
            <div className="lg:hidden text-center mb-8 -mt-4">
              <span className="inline-block px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-blue-600 bg-blue-50 rounded-full">
                Enterprise
              </span>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Organization */}
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-sm font-semibold text-gray-700">
                  Organization
                </Label>
                <div className="relative">
                  <div className={cn(
                    "absolute left-4 top-1/2 -translate-y-1/2 transition-colors",
                    focusedField === 'companyName' ? 'text-blue-600' : 'text-gray-400'
                  )}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <Input
                    id="companyName"
                    placeholder="Enter your organization"
                    className={cn(
                      "pl-12 h-[50px] rounded-lg border transition-all text-base",
                      focusedField === 'companyName'
                        ? 'border-blue-600 ring-2 ring-blue-600/20'
                        : 'border-gray-200 hover:border-gray-300',
                      errors.companyName && 'border-red-300'
                    )}
                    {...register('companyName')}
                    disabled={isLoading}
                    onFocus={() => setFocusedField('companyName')}
                    onBlur={() => setFocusedField(null)}
                  />
                </div>
                {errors.companyName && (
                  <p className="text-sm text-red-500">{errors.companyName.message}</p>
                )}
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold text-gray-700">
                  Username
                </Label>
                <div className="relative">
                  <div className={cn(
                    "absolute left-4 top-1/2 -translate-y-1/2 transition-colors",
                    focusedField === 'username' ? 'text-blue-600' : 'text-gray-400'
                  )}>
                    <User className="w-5 h-5" />
                  </div>
                  <Input
                    id="username"
                    placeholder="Enter your username"
                    className={cn(
                      "pl-12 h-[50px] rounded-lg border transition-all text-base",
                      focusedField === 'username'
                        ? 'border-blue-600 ring-2 ring-blue-600/20'
                        : 'border-gray-200 hover:border-gray-300',
                      errors.username && 'border-red-300'
                    )}
                    {...register('username')}
                    disabled={isLoading}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                  />
                </div>
                {errors.username && (
                  <p className="text-sm text-red-500">{errors.username.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                  Password
                </Label>
                <div className="relative">
                  <div className={cn(
                    "absolute left-4 top-1/2 -translate-y-1/2 transition-colors",
                    focusedField === 'password' ? 'text-blue-600' : 'text-gray-400'
                  )}>
                    <Lock className="w-5 h-5" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className={cn(
                      "pl-12 pr-12 h-[50px] rounded-lg border transition-all text-base",
                      focusedField === 'password'
                        ? 'border-blue-600 ring-2 ring-blue-600/20'
                        : 'border-gray-200 hover:border-gray-300',
                      errors.password && 'border-red-300'
                    )}
                    {...register('password')}
                    disabled={isLoading}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              {/* Submit button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full h-[50px] rounded-lg text-base bg-gradient-to-r from-slate-700 to-[#1e3a5f] hover:from-slate-800 hover:to-[#162d4a]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </div>
            </form>

            {/* Footer */}
            <div className="text-center mt-8 text-xs text-gray-500">
              <div className="text-gray-400 mb-1">
                &copy; {new Date().getFullYear()} ProcunexPro Enterprise. All rights reserved.
              </div>
              <div className="text-gray-400">
                Developed by{' '}
                <a
                  href="https://kinn-softwares.solutions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  Kinnitech Softwares
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
