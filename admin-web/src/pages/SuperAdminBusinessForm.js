import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { 
  Building2, 
  ArrowLeft,
  Save,
  Loader2
} from 'lucide-react';

export const SuperAdminBusinessForm = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!businessId;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Pakistan',
    subscriptionPlan: 'Basic',
    status: 'Pending'
  });

  const [errors, setErrors] = useState({});

  const { data: business, isLoading: isLoadingBusiness } = useQuery(
    ['business', businessId],
    () => axios.get(`/api/super-admin/businesses/${businessId}`).then(res => res.data.data),
    { 
      enabled: isEdit,
      onSuccess: (data) => {
        setFormData({
          name: data.Name || '',
          email: data.Email || '',
          phone: data.Phone || '',
          address: data.Address || '',
          city: data.City || '',
          state: data.State || '',
          postalCode: data.PostalCode || '',
          country: data.Country || 'Pakistan',
          subscriptionPlan: data.SubscriptionPlan || 'Basic',
          status: data.Status || 'Pending'
        });
      }
    }
  );

  const createMutation = useMutation(
    (data) => axios.post('/api/super-admin/businesses', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('businesses');
        navigate('/super-admin/businesses');
      }
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => axios.put(`/api/super-admin/businesses/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['business', businessId]);
        queryClient.invalidateQueries('businesses');
        navigate(`/super-admin/businesses/${businessId}`);
      }
    }
  );

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Business name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }

    if (!formData.postalCode.trim()) {
      newErrors.postalCode = 'Postal code is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const payload = {
      Name: formData.name,
      Email: formData.email,
      Phone: formData.phone,
      Address: formData.address,
      City: formData.city,
      State: formData.state,
      PostalCode: formData.postalCode,
      Country: formData.country,
      SubscriptionPlan: formData.subscriptionPlan,
      Status: formData.status
    };

    if (isEdit) {
      updateMutation.mutate({ id: businessId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
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
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => isEdit ? navigate(`/super-admin/businesses/${businessId}`) : navigate('/super-admin/businesses')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {isEdit ? 'Back to Business Details' : 'Back to Businesses'}
        </button>
        <h1 className="text-3xl font-bold text-gray-800">
          {isEdit ? 'Edit Business' : 'Add New Business'}
        </h1>
        <p className="text-gray-600 mt-2">
          {isEdit ? 'Update business information' : 'Register a new business on the platform'}
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Business Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter business name"
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="business@example.com"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="+92 300 1234567"
              />
              {errors.phone && (
                <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
              )}
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="2"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter full address"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City *
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.city ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Karachi"
              />
              {errors.city && (
                <p className="text-red-500 text-sm mt-1">{errors.city}</p>
              )}
            </div>

            {/* State */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State/Province *
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.state ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Sindh"
              />
              {errors.state && (
                <p className="text-red-500 text-sm mt-1">{errors.state}</p>
              )}
            </div>

            {/* Postal Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Postal Code *
              </label>
              <input
                type="text"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.postalCode ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="74000"
              />
              {errors.postalCode && (
                <p className="text-red-500 text-sm mt-1">{errors.postalCode}</p>
              )}
            </div>

            {/* Country */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country
              </label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Pakistan"
              />
            </div>

            {/* Subscription Plan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subscription Plan
              </label>
              <select
                name="subscriptionPlan"
                value={formData.subscriptionPlan}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Basic">Basic</option>
                <option value="Standard">Standard</option>
                <option value="Premium">Premium</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Pending">Pending</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => isEdit ? navigate(`/super-admin/businesses/${businessId}`) : navigate('/super-admin/businesses')}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEdit ? 'Update Business' : 'Create Business'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
