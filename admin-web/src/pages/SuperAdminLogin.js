import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n';

export const SuperAdminLogin = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    login,
    logout,
    isAuthenticated,
    user,
    restorePlatformSession,
    forgetPlatformSession,
    getRememberedPlatformEmail
  } = useAuth();

  const [checkingSession, setCheckingSession] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Restore the saved platform session once when the page opens.
  useEffect(() => {
    let active = true;
    const rememberedEmail = getRememberedPlatformEmail();
    if (rememberedEmail) {
      setFormData((previous) => ({ ...previous, email: rememberedEmail }));
      setRemember(true);
    }
    restorePlatformSession().finally(() => {
      if (active) setCheckingSession(false);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={user?.role === 'SUPPORT' ? '/dashboard' : '/super-admin/dashboard'} replace />;
  }

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    const result = await login(formData.email, formData.password, { remember });
    setLoading(false);
    if (!result.success) return;

    if (result.user?.role === 'SUPER_ADMIN') {
      navigate('/super-admin/dashboard', { replace: true });
    } else if (result.user?.role === 'SUPPORT') {
      navigate('/dashboard', { replace: true });
    } else {
      toast.error('This account cannot use the platform login');
      logout();
    }
  };

  const handleForget = () => {
    forgetPlatformSession();
    setRemember(false);
    toast.success('Saved platform session removed');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <Building2 className="h-7 w-7" />
            </div>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">MMS Platform Console</h1>
          <p className="mt-2 text-sm text-gray-600">Super admin sign-in — separate from the pharmacy staff login.</p>
        </div>

        <form className="mt-8 space-y-5 rounded-xl bg-white p-6 shadow-md" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <div>
              <label htmlFor="platform-email" className="block text-sm font-medium text-gray-700">
                {t('Email address')}
              </label>
              <input
                id="platform-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="superadmin@mms.com"
              />
            </div>
            <div>
              <label htmlFor="platform-password" className="block text-sm font-medium text-gray-700">
                {t('Password')}
              </label>
              <div className="relative mt-1">
                <input
                  id="platform-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 pe-10 text-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder={t('Password')}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 end-0 pe-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Remember me on this device
            </label>
            <button type="button" onClick={handleForget} className="text-xs text-blue-600 hover:text-blue-800">
              Forget saved session
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center items-center rounded-md bg-blue-600 py-2 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="me-2 h-4 w-4" />}
            {loading ? t('Signing in...') : 'Sign in to platform'}
          </button>

          <p className="text-center text-xs text-gray-500">
            Only your signed session is saved — never your password.
          </p>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-sm text-gray-600 hover:text-blue-700"
          >
            Pharmacy staff / owner login →
          </button>
        </div>
      </div>
    </div>
  );
};
