import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Building2,
  FileCheck,
  Percent,
  Save
} from 'lucide-react';
import { useTranslation } from '../i18n';

export const Settings = () => {
  const { t } = useTranslation();
const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    legalName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
    currency: 'USD',
    taxEnabled: true,
    taxRate: 0.08,
    taxRegistrationNumber: '',
    licenseNumber: '',
    licenseAuthority: '',
    pharmacistInChargeName: '',
    locale: 'en-US',
    timezone: 'America/New_York'
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/settings');
      if (res.data.success && res.data.data) {
        const d = res.data.data;
        setFormData({
          businessName: d.businessName || '',
          legalName: d.legalName || '',
          phone: d.phone || '',
          email: d.email || '',
          address: d.address || '',
          city: d.city || '',
          state: d.state || '',
          zipCode: d.zipCode || '',
          country: d.country || 'United States',
          currency: d.currency || 'USD',
          taxEnabled: d.taxEnabled !== false,
          taxRate: d.taxRate !== undefined ? d.taxRate : 0.00,
          taxRegistrationNumber: d.taxRegistrationNumber || '',
          licenseNumber: d.licenseNumber || '',
          licenseAuthority: d.licenseAuthority || '',
          pharmacistInChargeName: d.pharmacistInChargeName || '',
          locale: d.locale || 'en-US',
          timezone: d.timezone || 'America/New_York'
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load business settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleTaxRatePercentChange = (e) => {
    const percentVal = parseFloat(e.target.value) || 0;
    setFormData((prev) => ({
      ...prev,
      taxRate: percentVal / 100
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await axios.put('/api/admin/settings', {
        ...formData,
        taxRate: parseFloat(formData.taxRate) || 0
      });
      if (res.data.success) {
        toast.success('Business settings updated successfully');
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast.error(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('Pharmacy & Business Settings')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Manage multi-country regional setup, taxation rules, compliance credentials, and pharmacy profile.')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4 me-2" />
          {saving ? t('Saving...') : t('Save Changes')}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Regional & Financial Tax Engine */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Percent className="w-5 h-5 text-blue-600" />
              <div>
                <h2 className="text-base font-bold text-gray-900">{t('Tax Engine & Currency Configuration')}</h2>
                <p className="text-xs text-gray-500">{t('Configure sales tax / VAT and POS calculation behavior')}</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
              {t('Tax Engine v2')}
            </span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Currency Selector */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('Operating Currency')}
              </label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5"
              >
                <option value="USD">{t('USD ($) - United States Dollar')}</option>
                <option value="AED">{t('AED (AED) - United Arab Emirates Dirham')}</option>
                <option value="PKR">{t('PKR (Rs.) - Pakistani Rupee')}</option>
                <option value="SAR">{t('SAR (SAR) - Saudi Riyal')}</option>
                <option value="EUR">{t('EUR (€) - Euro')}</option>
                <option value="GBP">{t('GBP (£) - British Pound')}</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {t('Currency is snapshotted at time of sale on every receipt and transaction.')}
              </p>
            </div>

            {/* Tax Enable Toggle */}
            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="taxEnabled"
                  checked={formData.taxEnabled}
                  onChange={handleChange}
                  className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-bold text-gray-900 block">{t('Enable Tax Calculation')}</span>
                  <span className="text-xs text-gray-500 block">
                    {t('When enabled, tax is calculated per product taxability settings.')}
                  </span>
                </div>
              </label>
            </div>

            {/* Tax Rate */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('Default Store Tax Rate (%)')}
              </label>
              <div className="relative rounded-md shadow-sm">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max="100"
                  disabled={!formData.taxEnabled}
                  value={((parseFloat(formData.taxRate) || 0) * 100).toFixed(3)}
                  onChange={handleTaxRatePercentChange}
                  className="w-full rounded-lg border-gray-300 pe-10 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5 disabled:bg-gray-100"
                  placeholder={t('e.g. 8.875 for NYC, 5.0 for UAE')}
                />
                <div className="absolute inset-y-0 end-0 pe-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 text-xs font-bold">%</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t('Decimal rate stored:')} {(parseFloat(formData.taxRate) || 0).toFixed(5)} {t('(supports exact municipal precision).')}
              </p>
            </div>

            {/* Tax Registration / TRN */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('Tax Registration Number (TRN / EIN / NTN)')}
              </label>
              <input
                type="text"
                name="taxRegistrationNumber"
                value={formData.taxRegistrationNumber}
                onChange={handleChange}
                placeholder={t('e.g. 100-XXXX-XXXXX-0003 (UAE TRN) or 12-3456789 (US EIN)')}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('Printed on customer POS receipts and invoices for tax compliance.')}
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Regulatory Credentials & Pharmacy License */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-200 flex items-center gap-3">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-bold text-gray-900">{t('Regulatory Credentials & Pharmacist-in-Charge')}</h2>
              <p className="text-xs text-gray-500">{t('Official licensing information required by state boards and health authorities')}</p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('Pharmacy License Number')}
              </label>
              <input
                type="text"
                name="licenseNumber"
                value={formData.licenseNumber}
                onChange={handleChange}
                placeholder={t('e.g. PH-2024-9871')}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('Licensing Authority')}
              </label>
              <input
                type="text"
                name="licenseAuthority"
                value={formData.licenseAuthority}
                onChange={handleChange}
                placeholder={t('e.g. DHA / MOHAP / NYS Board of Pharmacy')}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('Pharmacist-in-Charge (PIC)')}
              </label>
              <input
                type="text"
                name="pharmacistInChargeName"
                value={formData.pharmacistInChargeName}
                onChange={handleChange}
                placeholder={t('e.g. Dr. Sarah Jenkins, PharmD')}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Business Information & Physical Address */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
            <Building2 className="w-5 h-5 text-gray-700" />
            <div>
              <h2 className="text-base font-bold text-gray-900">{t('Business Profile & Address')}</h2>
              <p className="text-xs text-gray-500">{t('Contact information displayed on store receipts and headers')}</p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('Display Trade Name')}
              </label>
              <input
                type="text"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                required
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('Legal Registered Entity Name')}
              </label>
              <input
                type="text"
                name="legalName"
                value={formData.legalName}
                onChange={handleChange}
                placeholder={t('e.g. HealthCare Pharmacy LLC')}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('Primary Phone')}
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('Contact Email')}
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('Street Address')}
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('City / Emirate')}
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('State / Province')}
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4 me-2" />
            {saving ? t('Saving Changes...') : t('Save Settings')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
