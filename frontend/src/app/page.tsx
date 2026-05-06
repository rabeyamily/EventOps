'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui';
import { signUp, login, lookupRoleByEmail } from '@/lib/api/auth';

const PASSWORD_RULES =
  'At least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character (e.g. !@#$%).';

function PasswordStrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ['bg-red-400', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400'];
  const labels = ['', 'Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= score ? colors[score - 1] : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${score <= 2 ? 'text-red-500' : score <= 3 ? 'text-yellow-600' : 'text-green-600'}`}>
        {labels[score]}
      </p>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, hasHydrated, setUser } = useAuthStore();
  const [revealed, setRevealed] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Sign up state
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suConfirm, setSuConfirm] = useState('');
  const [suFullName, setSuFullName] = useState('');
  const [suRole, setSuRole] = useState<'staff' | 'admin' | ''>('');
  const [showSuPassword, setShowSuPassword] = useState(false);

  // Login state
  const [liEmail, setLiEmail] = useState('');
  const [liPassword, setLiPassword] = useState('');
  const [liRole, setLiRole] = useState<'staff' | 'admin' | ''>('');
  const [liRoleTouched, setLiRoleTouched] = useState(false);
  const [showLiPassword, setShowLiPassword] = useState(false);

  useEffect(() => {
    if (hasHydrated && !isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [hasHydrated, isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      const timer = setTimeout(() => setRevealed(true), 1800);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!showLoginModal) return;

    const email = liEmail.trim();
    if (!email || !email.includes('@')) {
      if (!liRoleTouched) {
        setLiRole('');
      }
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const detectedRole = await lookupRoleByEmail(email);
        if (!cancelled && !liRoleTouched) {
          setLiRole(detectedRole ?? '');
        }
      } catch {
        if (!cancelled && !liRoleTouched) {
          setLiRole('');
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [liEmail, liRoleTouched, showLoginModal]);

  const resetSignUp = () => {
    setSuEmail(''); setSuPassword(''); setSuConfirm(''); setSuFullName(''); setSuRole('');
    setError(''); setShowSignUpModal(false);
  };

  const resetLogin = () => {
    setLiEmail(''); setLiPassword(''); setLiRole('');
    setLiRoleTouched(false);
    setError(''); setShowLoginModal(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (suPassword !== suConfirm) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signUp({ email: suEmail, password: suPassword, fullName: suFullName || undefined, role: suRole as 'staff' | 'admin' });
      resetSignUp();
      setShowLoginModal(true);
    } catch (err: any) {
      setError(err.error || err.message || 'Sign up failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const user = await login({ email: liEmail, password: liPassword, role: liRole as 'staff' | 'admin' });
      setUser(user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.error || err.message || 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: 'url(/loginPage.png)' }}
    >
      <div className="absolute inset-0 bg-[#57068c]/20" />

      <div className="text-center relative z-10 px-4">
        <h1
          className="landing-title text-5xl sm:text-6xl md:text-7xl font-black text-white mb-4"
          style={{
            fontFamily: "'NYU Perstare', sans-serif",
            WebkitTextStroke: '1.5px rgba(255,255,255,0.6)',
            letterSpacing: '-0.01em',
          } as React.CSSProperties}
        >
          {'VSP EventOps'.split('').map((ch, i) => (
            <span key={i} className="landing-letter" style={{ animationDelay: `${i * 60}ms` }}>
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          ))}
        </h1>

        <div
          className={`flex items-center justify-center gap-2 mb-6 transition-all duration-500 ${
            revealed ? 'opacity-0 scale-75 h-0 mb-0' : 'opacity-100'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-white/90 loading-dot" style={{ animationDelay: '0ms' }} />
          <span className="w-2.5 h-2.5 rounded-full bg-white/90 loading-dot" style={{ animationDelay: '150ms' }} />
          <span className="w-2.5 h-2.5 rounded-full bg-white/90 loading-dot" style={{ animationDelay: '300ms' }} />
        </div>

        <p
          className={`text-white/90 text-sm sm:text-base font-light mb-8 transition-all duration-700 ease-out ${
            revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          Welcome to NYU Abu Dhabi Visiting Students Program Event Operations ☀️🏜️
        </p>

        <div
          className={`flex flex-col sm:flex-row gap-3 sm:gap-5 justify-center items-center transition-all duration-700 ease-out ${
            revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'
          }`}
          style={{ transitionDelay: revealed ? '250ms' : '0ms' }}
        >
          <Button
            onClick={() => { setError(''); setShowSignUpModal(true); }}
            variant="outline"
            size="lg"
            className="px-4 py-2 sm:px-8 sm:py-3 text-sm sm:text-base font-semibold border-2 border-white/90 text-white bg-white/10 backdrop-blur-sm hover:bg-white hover:text-[#57068c] transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 min-w-[120px] sm:min-w-[140px]"
          >
            Sign Up
          </Button>
          <Button
            onClick={() => { setError(''); setShowLoginModal(true); }}
            variant="outline"
            size="lg"
            className="px-4 py-2 sm:px-8 sm:py-3 text-sm sm:text-base font-semibold border-2 border-white/90 text-white bg-white/10 backdrop-blur-sm hover:bg-white hover:text-[#57068c] transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 min-w-[120px] sm:min-w-[140px]"
          >
            Log In
          </Button>
        </div>
      </div>

      {/* ── Sign Up Modal ── */}
      <Modal
        isOpen={showSignUpModal}
        onClose={resetSignUp}
        title="Create Your Account"
        size="md"
        centerTitle
      >
        <form onSubmit={handleSignUp} className="space-y-5">
          {error && <ErrorBanner message={error} />}

          <Field label="Email" required>
            <EmailIcon />
            <Input
              id="su-email"
              type="email"
              value={suEmail}
              onChange={(e) => setSuEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="pl-10"
            />
          </Field>

          <Field label="Full Name" hint="Optional">
            <PersonIcon />
            <Input
              id="su-name"
              type="text"
              value={suFullName}
              onChange={(e) => setSuFullName(e.target.value)}
              placeholder="Your full name"
              className="pl-10"
            />
          </Field>

          <Field label="Role" required>
            <Select
              id="su-role"
              value={suRole}
              onChange={(e) => setSuRole(e.target.value as 'staff' | 'admin')}
              required
              options={[
                { value: '', label: 'Select a role' },
                { value: 'staff', label: 'GEO' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </Field>

          <Field label="Password" required>
            <div className="relative">
              <LockIcon />
              <Input
                id="su-password"
                type={showSuPassword ? 'text' : 'password'}
                value={suPassword}
                onChange={(e) => setSuPassword(e.target.value)}
                placeholder="Create a strong password"
                required
                className="pl-10 pr-10"
              />
              <TogglePasswordButton show={showSuPassword} onToggle={() => setShowSuPassword((v) => !v)} />
            </div>
            <PasswordStrengthBar password={suPassword} />
            <p className="mt-1 text-xs text-gray-400">{PASSWORD_RULES}</p>
          </Field>

          <Field label="Confirm Password" required>
            <div className="relative">
              <LockIcon />
              <Input
                id="su-confirm"
                type={showSuPassword ? 'text' : 'password'}
                value={suConfirm}
                onChange={(e) => setSuConfirm(e.target.value)}
                placeholder="Repeat your password"
                required
                className="pl-10"
              />
            </div>
            {suConfirm && (
              <p className={`mt-1 text-xs ${suPassword === suConfirm ? 'text-green-600' : 'text-red-500'}`}>
                {suPassword === suConfirm ? '✓ Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </Field>

          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="w-full shadow-md hover:shadow-lg transition-all duration-200"
            style={{ backgroundColor: '#57068c' }}
          >
            Create Account
          </Button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <button
              type="button"
              className="text-[#57068c] font-semibold hover:underline"
              onClick={() => { resetSignUp(); setShowLoginModal(true); }}
            >
              Log in
            </button>
          </p>
        </form>
      </Modal>

      {/* ── Login Modal ── */}
      <Modal
        isOpen={showLoginModal}
        onClose={resetLogin}
        title="Welcome Back"
        size="md"
        centerTitle
      >
        <form onSubmit={handleLogin} className="space-y-5">
          {error && <ErrorBanner message={error} />}

          <Field label="Email" required>
            <EmailIcon />
            <Input
              id="li-email"
              type="email"
              value={liEmail}
              onChange={(e) => {
                setLiEmail(e.target.value);
                setLiRoleTouched(false);
              }}
              placeholder="you@example.com"
              required
              className="pl-10"
            />
          </Field>

          <Field label="Login As" required>
            <Select
              id="li-role"
              value={liRole}
              onChange={(e) => {
                setLiRole(e.target.value as 'staff' | 'admin');
                setLiRoleTouched(true);
              }}
              required
              options={[
                { value: '', label: 'Select a role' },
                { value: 'staff', label: 'GEO' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </Field>

          <Field label="Password" required>
            <div className="relative">
              <LockIcon />
              <Input
                id="li-password"
                type={showLiPassword ? 'text' : 'password'}
                value={liPassword}
                onChange={(e) => setLiPassword(e.target.value)}
                placeholder="Your password"
                required
                className="pl-10 pr-10"
              />
              <TogglePasswordButton show={showLiPassword} onToggle={() => setShowLiPassword((v) => !v)} />
            </div>
          </Field>

          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting || !liEmail || !liPassword}
            className="w-full shadow-md hover:shadow-lg transition-all duration-200"
            style={{ backgroundColor: '#57068c' }}
          >
            Log In
          </Button>

          <p className="text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              className="text-[#57068c] font-semibold hover:underline"
              onClick={() => { resetLogin(); setShowSignUpModal(true); }}
            >
              Sign up
            </button>
          </p>
        </form>
      </Modal>
    </div>
  );
}

// ── Small helper components ──

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-50 p-4 border-l-4 border-red-500">
      <div className="flex items-start">
        <svg className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-sm text-red-800 font-medium whitespace-pre-wrap break-words">{message}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-semibold text-gray-700">
        {label}{' '}
        {required && <span className="text-red-500">*</span>}
        {hint && <span className="text-gray-400 text-xs font-normal">({hint})</span>}
      </label>
      <div className="relative">{children}</div>
    </div>
  );
}

function EmailIcon() {
  return (
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
      </svg>
    </div>
  );
}

function PersonIcon() {
  return (
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </div>
  );
}

function LockIcon() {
  return (
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    </div>
  );
}

function TogglePasswordButton({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
      tabIndex={-1}
    >
      {show ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );
}
