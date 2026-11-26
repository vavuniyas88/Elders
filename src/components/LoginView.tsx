import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  HelpCircle,
  LockKeyhole,
  UserCheck,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { auth, googleProvider } from '../firebase';
import { resolveLoginIdentifier } from '../utils/calculations';

export function LoginView({ onBackToPublic }: { onBackToPublic: () => void }) {
  const { lang, setLang, t } = useLanguage();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showProviderSetupTip, setShowProviderSetupTip] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setShowProviderSetupTip(false);

    if (!identifier.trim() || !password) {
      setErrorMsg('Please enter both your username (or email) and password.');
      return;
    }

    setLoading(true);
    try {
      const resolvedEmail = resolveLoginIdentifier(identifier);
      await signInWithEmailAndPassword(auth, resolvedEmail, password);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/admin-restricted-operation'
      ) {
        setShowProviderSetupTip(true);
        setErrorMsg(
          lang === 'ta'
            ? 'Firebase Authentication-இல் Email/Password உள்நுழைவு இன்னும் செயல்படுத்தப்படவில்லை. கீழே உள்ள வழிகாட்டியைப் பின்பற்றவும் அல்லது Google மூலம் உள்நுழையவும்.'
            : 'Email/Password sign-in is not enabled in Firebase Authentication yet. Follow the setup guide below or sign in using Google.'
        );
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setShowProviderSetupTip(true);
        setErrorMsg(
          lang === 'ta'
            ? 'தவறான பயனர்பெயர்/கடவுச்சொல் அல்லது கணக்கு இன்னும் உருவாக்கப்படவில்லை. முதலில் Google (vavuniyas88@gmail.com) மூலம் உள்நுழைந்து Administration -> User Management-இல் பயனர் கணக்கை உருவாக்கவும்.'
            : 'Invalid username/password, or this username account has not been created yet. If setting up "admin" for the first time, sign in with Google below and create it under Administration -> User Management.'
        );
      } else if (code === 'auth/too-many-requests') {
        setErrorMsg('Too many failed attempts. Please wait a moment and try again.');
      } else {
        setErrorMsg(
          err instanceof Error ? err.message : 'Unable to sign in. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setShowProviderSetupTip(false);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code !== 'auth/popup-closed-by-user') {
        setErrorMsg(
          err instanceof Error ? err.message : 'Google sign-in failed. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Institutional Panel */}
      <div className="lg:w-5/12 bg-slate-900 text-white relative overflow-hidden flex flex-col justify-between p-8 lg:p-12">
        <img
          src="/src/assets/images/manthai_civic_banner_1795709684664.jpg"
          alt="Manthai West Divisional Secretariat"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-slate-900/70" />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackToPublic}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('backToPublic')}
          </button>

          <div className="inline-flex items-center p-0.5 bg-slate-800/80 rounded border border-slate-700">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 text-xs font-medium rounded ${
                lang === 'en' ? 'bg-blue-700 text-white' : 'text-slate-300'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('ta')}
              className={`px-2.5 py-1 text-xs font-medium rounded ${
                lang === 'ta' ? 'bg-blue-700 text-white' : 'text-slate-300'
              }`}
            >
              தமிழ்
            </button>
          </div>
        </div>

        <div className="relative z-10 my-10 lg:my-0 space-y-4">
          <img
            src="/assets/aistudio/IMG-20261121-WA0000_9601a62d.jpg"
            alt="Manthai West Divisional Secretariat Logo"
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-lg object-contain bg-white border border-white/20 p-1"
          />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
            {t('appTitle')}
          </h1>
          <p className="text-base text-blue-200 font-medium">{t('appSubtitle')}</p>
          <p className="text-sm text-slate-300 leading-relaxed max-w-md">
            Authorized portal for the Elderly Development Officer and Division Staff to
            register citizens, track 60+ and 70+ welfare allowances, and generate official
            divisional reports.
          </p>
        </div>

        <div className="relative z-10 text-xs text-slate-400">
          Mannar District · Northern Province · Sri Lanka
        </div>
      </div>

      {/* Right Authentication Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-7 sm:p-8 space-y-6">
          <div>
            <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold">
              <LockKeyhole className="w-4 h-4" />
              <span>{t('staffSignIn')}</span>
            </div>
            <h2 className="mt-1.5 text-xl font-bold text-slate-900">
              Sign in to Staff Workspace
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Use your assigned officer username and password, or sign in with your
              authorized Google account.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-md flex items-start gap-2.5 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {showProviderSetupTip && (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4" />
                <span>
                  {lang === 'ta'
                    ? 'Username / Password உள்நுழைவை அமைக்கும் முறை:'
                    : 'How to enable & create Username / Password login:'}
                </span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>
                  Firebase Console (<strong>vavuniyasouth-775b2</strong>) &rarr;{' '}
                  <strong>Authentication &rarr; Sign-in method &rarr; Email/Password</strong>{' '}
                  (Enable &amp; Save).
                </li>
                <li>
                  Click <strong>Sign In with Google</strong> below using{' '}
                  <strong>vavuniyas88@gmail.com</strong>.
                </li>
                <li>
                  Open <strong>Administration &rarr; User Management &rarr; Setup &quot;admin&quot; Username Login</strong>{' '}
                  to set your chosen password.
                </li>
              </ol>
            </div>
          )}

          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Username or Email
              </label>
              <input
                id="login-identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. admin or edo_officer"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3.5 py-2.5 pr-10 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-md transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In with Credentials'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2.5 text-slate-400">or</span>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="w-full py-2.5 px-4 text-sm font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-md transition-colors inline-flex items-center justify-center gap-2.5"
          >
            <UserCheck className="w-4 h-4 text-blue-700" />
            <span>Sign In with Google (Admin / Staff)</span>
          </button>

          <p className="text-xs text-slate-500 text-center">
            Public visitors can view anonymous divisional statistics on the{' '}
            <button
              type="button"
              onClick={onBackToPublic}
              className="text-blue-700 hover:underline font-medium"
            >
              {t('navPublicPreview')}
            </button>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
