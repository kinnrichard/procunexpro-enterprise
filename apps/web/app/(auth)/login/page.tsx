'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Building2, User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Form state (no react-hook-form to avoid URL params issue)
  const [companyName, setCompanyName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Field-level errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!companyName.trim()) errors.companyName = 'Organization is required';
    if (!username.trim()) errors.username = 'Username is required';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 6) errors.password = 'Password must be at least 6 characters';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setIsLoading(true);
    try {
      await login(companyName.trim(), username.trim(), password);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Invalid credentials';

      // Map specific error messages
      if (msg.includes('Invalid credentials')) {
        setError('Invalid organization, username, or password. Please try again.');
      } else if (msg.includes('locked')) {
        setError('Your account has been locked due to too many failed attempts. Please try again later.');
      } else if (msg.includes('inactive') || msg.includes('deactivated')) {
        setError('Your account has been deactivated. Please contact your administrator.');
      } else {
        setError(msg);
      }

      // Only clear password on failure, keep org and username
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  }

  function clearFieldError(field: string) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (error) setError('');
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-[#1e3a5f]">
      {/* Decorative Elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full" style={{ background: 'rgba(255, 255, 255, 0.05)', filter: 'blur(80px)' }} />
      <div className="absolute bottom-[-10%] left-[-5%] w-[35%] h-[35%] rounded-full" style={{ background: 'rgba(255, 255, 255, 0.05)', filter: 'blur(80px)' }} />

      <div className="min-h-screen relative z-10 flex flex-col lg:flex-row">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] items-center justify-center p-10">
          <div className="max-w-xl text-center">
            <div className="flex items-center justify-center mb-10">
              <img src="/logo-white.png" alt="Procunex" className="h-75" />
            </div>
            <p className="text-xl text-white/90 leading-relaxed max-w-lg mx-auto mb-10">
              Streamline purchasing, vendors, and stock control
            </p>
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
          <div className="w-full max-w-md bg-white rounded-2xl border-none" style={{ boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)', padding: '48px 40px' }}>
            {/* Logo inside card */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center mb-3">
                <img src="/logo-primary.png" alt="Procunex" className="h-22" />
              </div>
              <p className="text-sm text-gray-500">Sign in to your account</p>
            </div>

            {/* Mobile branding */}
            <div className="lg:hidden text-center mb-8 -mt-4">
              <span className="inline-block px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-blue-600 bg-blue-50 rounded-full">
                Enterprise
              </span>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Organization */}
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-sm font-semibold text-gray-700">Organization</Label>
                <div className="relative">
                  <div className={cn("absolute left-4 top-1/2 -translate-y-1/2 transition-colors", focusedField === 'companyName' ? 'text-blue-600' : 'text-gray-400')}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <Input
                    id="companyName"
                    placeholder="Enter your organization"
                    value={companyName}
                    onChange={(e) => { setCompanyName(e.target.value); clearFieldError('companyName'); }}
                    disabled={isLoading}
                    onFocus={() => setFocusedField('companyName')}
                    onBlur={() => setFocusedField(null)}
                    className={cn(
                      "pl-12 h-[50px] rounded-lg border transition-all text-base",
                      focusedField === 'companyName' ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-gray-200 hover:border-gray-300',
                      fieldErrors.companyName && 'border-red-400 ring-2 ring-red-200'
                    )}
                  />
                </div>
                {fieldErrors.companyName && <p className="text-xs text-red-500 mt-1">{fieldErrors.companyName}</p>}
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold text-gray-700">Username</Label>
                <div className="relative">
                  <div className={cn("absolute left-4 top-1/2 -translate-y-1/2 transition-colors", focusedField === 'username' ? 'text-blue-600' : 'text-gray-400')}>
                    <User className="w-5 h-5" />
                  </div>
                  <Input
                    id="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); clearFieldError('username'); }}
                    disabled={isLoading}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    className={cn(
                      "pl-12 h-[50px] rounded-lg border transition-all text-base",
                      focusedField === 'username' ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-gray-200 hover:border-gray-300',
                      fieldErrors.username && 'border-red-400 ring-2 ring-red-200'
                    )}
                  />
                </div>
                {fieldErrors.username && <p className="text-xs text-red-500 mt-1">{fieldErrors.username}</p>}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">Password</Label>
                <div className="relative">
                  <div className={cn("absolute left-4 top-1/2 -translate-y-1/2 transition-colors", focusedField === 'password' ? 'text-blue-600' : 'text-gray-400')}>
                    <Lock className="w-5 h-5" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                    disabled={isLoading}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className={cn(
                      "pl-12 pr-12 h-[50px] rounded-lg border transition-all text-base",
                      focusedField === 'password' ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-gray-200 hover:border-gray-300',
                      fieldErrors.password && 'border-red-400 ring-2 ring-red-200'
                    )}
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
                {fieldErrors.password && <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>}
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
                &copy; {new Date().getFullYear()} Procunex. All rights reserved.
              </div>
              <div className="text-gray-400">
                Developed by{' '}
                <a href="https://kinn-softwares.solutions" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
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
