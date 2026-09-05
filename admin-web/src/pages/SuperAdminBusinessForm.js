import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  Building2, 
  ArrowLeft,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Globe,
  ShieldCheck,
  FileCheck
} from 'lucide-react';

const COUNTRY_DEFAULTS = {
  'United States': { currency: 'USD', taxEnabled: true, taxRate: 0.0825, locale: 'en-US', timezone: 'America/New_York', licenseAuthority: 'State Board of Pharmacy / DEA' },
  'United Arab Emirates': { currency: 'AED', taxEnabled: true, taxRate: 0.05, locale: 'ar-AE', timezone: 'Asia/Dubai', licenseAuthority: 'MOHAP / DHA / DOH' },
  'Pakistan': { currency: 'PKR', taxEnabled: true, taxRate: 0.16, locale: 'ur-PK', timezone: 'Asia/Karachi', licenseAuthority: 'DRAP' },
  'Saudi Arabia': { currency: 'SAR', taxEnabled: true, taxRate: 0.15, locale: 'ar-SA', timezone: 'Asia/Riyadh', licenseAuthority: 'SFDA' },
  'United Kingdom': { currency: 'GBP', taxEnabled: true, taxRate: 0.20, locale: 'en-GB', timezone: 'Europe/London', licenseAuthority: 'GPhC' }
};

export const SuperAdminBusinessForm = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!businessId;

  const [formData, setFormData] = useState({
    businessName: '',
    businessCode: '',
    ownerName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: 'United States',
    currency: 'USD',
    taxEnabled: true,
    taxRate: 0.0825,
    taxRegistrationNumber: '',
    licenseNumber: '',
    licenseAuthority: 'State Board of Pharmacy / DEA',
    pharmacistInChargeName: '',
    locale: 'en-US',
    timezone: 'America/New_York',
    subscriptionPlan: 'Basic',
    status: 'Active',
    password: ''
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const { isLoading: isLoadingBusiness } = useQuery(
    ['business', businessId],
    () => axios.get(`/api/super-admin/businesses/${businessId}`).then(res => res.data.data),
    { 
      enabled: isEdit,
      onSuccess: (data) => {
        setFormData({
          businessName: data.BusinessName || '',
          businessCode: data.BusinessCode || '',
          ownerName: data.OwnerName || '',
          email: data.Email || '',
          phone: data.Phone || '',
          address: data.Address || '',
          city: data.City || '',
          state: data.State || '',
          country: data.Country || 'United States',
          currency: data.Currency || 'USD',
          taxEnabled: data.TaxEnabled !== false && data.TaxEnabled !== 0,
          taxRate: data.TaxRate !== undefined ? parseFloat(data.TaxRate) : 0.0825,
          taxRegistrationNumber: data.TaxRegistrationNumber || '',
          licenseNumber: data.LicenseNumber || '',
          licenseAuthority: data.LicenseAuthority || '',
          pharmacistInChargeName: data.PharmacistInChargeName || '',
          locale: data.Locale || 'en-US',
          timezone: data.Timezone || 'America/New_York',
          subscriptionPlan: data.SubscriptionPlan || 'Basic',
          status: data.Status || 'Active'
        });
      }
    }
  );

  const createMutation = useMutation(
    (data) => axios.post('/api/super-admin/businesses', data),
    {
      onSuccess: (res) => {
        queryClient.invalidateQueries('businesses');
        const ownerPassword = res?.data?.data?.password;
        toast.success(
          ownerPassword
            ? `Business owner created. Login password: ${ownerPassword}`
            : 'Business owner created',
          { duration: 10000 }
        );
        navigate('/super-admin/businesses');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create business owner');
      }
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => axios.put(`/api/super-admin/businesses/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['business', businessId]);
        queryClient.invalidateQueries('businesses');
        toast.success('Business updated');
        navigate(`/super-admin/businesses/${businessId}`);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update business');
      }
    }
  );

  const validateForm = () => {
    const newErrors = {};

    if (!formData.businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    }

    if (!isEdit && !formData.businessCode.trim()) {
      newErrors.businessCode = 'Business code is required';
    }

    if (!formData.ownerName.trim()) {
      newErrors.ownerName = 'Owner name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (formData.phone.trim().length < 10) {
      newErrors.phone = 'Phone number must be at least 10 characters';
    }

    if (!isEdit && formData.password && formData.password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCountryChange = (e) => {
    const selectedCountry = e.target.value;
    const defaults = COUNTRY_DEFAULTS[selectedCountry] || {};
    setFormData(prev => ({
      ...prev,
      country: selectedCountry,
      ...(defaults.currency && { currency: defaults.currency }),
      ...(defaults.taxEnabled !== undefined && { taxEnabled: defaults.taxEnabled }),
      ...(defaults.taxRate !== undefined && { taxRate: defaults.taxRate }),
      ...(defaults.locale && { locale: defaults.locale }),
      ...(defaults.timezone && { timezone: defaults.timezone }),
      ...(defaults.licenseAuthority && { licenseAuthority: defaults.licenseAuthority })
    }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const payload = {
      businessName: formData.businessName,
      businessCode: formData.businessCode,
      ownerName: formData.ownerName,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      country: formData.country,
      currency: formData.currency,
      taxEnabled: formData.taxEnabled,
      taxRate: parseFloat(formData.taxRate) || 0,
      taxRegistrationNumber: formData.taxRegistrationNumber,
      licenseNumber: formData.licenseNumber,
      licenseAuthority: formData.licenseAuthority,
      pharmacistInChargeName: formData.pharmacistInChargeName,
      locale: formData.locale,
      timezone: formData.timezone,
      subscriptionPlan: formData.subscriptionPlan,
      status: formData.status
    };

    if (!isEdit && formData.password) {
      payload.password = formData.password;
    }

    if (isEdit) {
      updateMutation.mutate({ id: businessId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isLoadingBusiness) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isSubmitting = createMutation.isLoading || updateMutation.isLoading;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => isEdit ? navigate(`/super-admin/businesses/${businessId}`) : navigate('/super-admin/businesses')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 font-semibold text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          {isEdit ? 'Back to Business Details' : 'Back to Businesses'}
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? `Edit Pharmacy Business #${businessId}` : 'Add New Pharmacy Business'}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {isEdit ? 'Update business settings, regional tax, and licensing' : 'Provision a new pharmacy tenant configured for USA, UAE, or International market'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Business Profile */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Pharmacy & Owner Profile
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Business Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Business / Pharmacy Name *
              </label>
              <input
                type="text"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                className={`w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 text-sm ${
                  errors.businessName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g. Apex Health Pharmacy"
              />
              {errors.businessName && <p className="text-red-500 text-xs mt-1">{errors.businessName}</p>}
            </div>

            {/* Business Code */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Business Code * {isEdit && <span className="text-gray-400 font-normal">(Locked)</span>}
              </label>
              <input
                type="text"
                name="businessCode"
                value={formData.businessCode}
                onChange={handleChange}
                disabled={isEdit}
                className={`w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100 uppercase font-mono font-bold ${
                  errors.businessCode ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g. APEX01"
              />
              {errors.businessCode && <p className="text-red-500 text-xs mt-1">{errors.businessCode}</p>}
            </div>

            {/* Owner Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Owner Name *
              </label>
              <input
                type="text"
                name="ownerName"
                value={formData.ownerName}
                onChange={handleChange}
                className={`w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 text-sm ${
                  errors.ownerName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g. Dr. Sarah Jenkins"
              />
              {errors.ownerName && <p className="text-red-500 text-xs mt-1">{errors.ownerName}</p>}
            </div>

            {/* Owner Email */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Owner Email * {isEdit && <span className="text-gray-400 font-normal">(Login identifier)</span>}
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={isEdit}
                className={`w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100 ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="sarah@apexhealth.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Phone Number *
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={`w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 text-sm ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="+1 555-0199 or +971 50 123 4567"
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>

            {/* Password (Create mode only) */}
            {!isEdit && (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Initial Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Leave empty for auto-generated password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Regional, Market & Tax Configuration */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            Market, Currency & Tax Engine Settings
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {/* Country Selector */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Deployment Country *
              </label>
              <select
                name="country"
                value={formData.country}
                onChange={handleCountryChange}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm bg-white font-semibold"
              >
                <option value="United States">United States (USA)</option>
                <option value="United Arab Emirates">United Arab Emirates (UAE)</option>
                <option value="Pakistan">Pakistan</option>
                <option value="Saudi Arabia">Saudi Arabia (KSA)</option>
                <option value="United Kingdom">United Kingdom (UK)</option>
              </select>
            </div>

            {/* Currency Selector */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Operating Currency *
              </label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm bg-white font-bold"
              >
                <option value="USD">USD ($) - US Dollar</option>
                <option value="AED">AED - UAE Dirham</option>
                <option value="PKR">PKR (Rs.) - Pakistani Rupee</option>
                <option value="SAR">SAR - Saudi Riyal</option>
                <option value="GBP">GBP (£) - British Pound</option>
                <option value="EUR">EUR (€) - Euro</option>
              </select>
            </div>

            {/* Master Tax Engine Toggle */}
            <div className="flex flex-col justify-center">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Tax Engine Status
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  name="taxEnabled"
                  checked={formData.taxEnabled}
                  onChange={handleChange}
                  className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-gray-800">
                  {formData.taxEnabled ? 'Tax Engine Enabled' : 'Tax Exempt / Disabled'}
                </span>
              </label>
            </div>

            {/* Tax Rate */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Standard Tax / VAT Rate (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  max="100"
                  value={((parseFloat(formData.taxRate) || 0) * 100).toFixed(4).replace(/\.?0+$/, '')}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setFormData(prev => ({ ...prev, taxRate: val / 100 }));
                  }}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-bold pr-8"
                  placeholder="e.g. 8.25 or 5.0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Decimal: {formData.taxRate}</p>
            </div>

            {/* Tax Registration Number */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Tax ID / TRN / EIN
              </label>
              <input
                type="text"
                name="taxRegistrationNumber"
                value={formData.taxRegistrationNumber}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                placeholder="e.g. 100-2345-6789 (UAE TRN) or 12-3456789 (US EIN)"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Pharmacy Compliance & Licensing */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            Regulatory Compliance & Pharmacy Credentials
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Pharmacist-in-Charge */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Pharmacist-In-Charge (PIC)
              </label>
              <input
                type="text"
                name="pharmacistInChargeName"
                value={formData.pharmacistInChargeName}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="e.g. Pharm. Robert Smith, RPh"
              />
            </div>

            {/* Pharmacy License Number */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Pharmacy License #
              </label>
              <input
                type="text"
                name="licenseNumber"
                value={formData.licenseNumber}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                placeholder="e.g. PH-99238-US or DHA-PH-4412"
              />
            </div>

            {/* Licensing Authority */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Licensing Authority
              </label>
              <input
                type="text"
                name="licenseAuthority"
                value={formData.licenseAuthority}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="e.g. State Board of Pharmacy, DEA, DHA, MOHAP"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Physical Address & System Defaults */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-gray-600" />
            Address & Subscription Plan
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Address */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Street Address
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="123 Medical Center Blvd, Suite 100"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                City
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="e.g. Houston or Dubai"
              />
            </div>

            {/* State */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                State / Emirate / Province
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="e.g. Texas or Dubai"
              />
            </div>

            {/* Subscription Plan */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Subscription Plan
              </label>
              <select
                name="subscriptionPlan"
                value={formData.subscriptionPlan}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm bg-white font-semibold"
              >
                <option value="Free">Free</option>
                <option value="Basic">Basic</option>
                <option value="Premium">Premium (Enterprise)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={() => isEdit ? navigate(`/super-admin/businesses/${businessId}`) : navigate('/super-admin/businesses')}
            className="px-6 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm font-bold shadow-md transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEdit ? 'Update Business' : 'Provision Pharmacy'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
