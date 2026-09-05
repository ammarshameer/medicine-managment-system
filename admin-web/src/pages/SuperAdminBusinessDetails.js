import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  Users,
  ShoppingCart,
  Package,
  Edit,
  ArrowLeft,
  CheckCircle,
  XCircle,
  TrendingUp
} from 'lucide-react';

export const SuperAdminBusinessDetails = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const queryClient = useQueryClient();

  const { data: business, isLoading } = useQuery(
    ['business', businessId],
    () => axios.get(`/api/super-admin/businesses/${businessId}`).then(res => res.data.data),
    { enabled: !!businessId }
  );

  const { data: users } = useQuery(
    ['business-users', businessId],
    () => axios.get(`/api/super-admin/businesses/${businessId}/users`).then(res => res.data.data),
    { enabled: !!businessId }
  );

  const { data: analytics } = useQuery(
    ['business-analytics', businessId],
    () => axios.get(`/api/super-admin/businesses/${businessId}/analytics`).then(res => res.data.data),
    { enabled: !!businessId }
  );

  const deleteMutation = useMutation(
    (id) => axios.delete(`/api/super-admin/businesses/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('businesses');
        navigate('/super-admin/businesses');
      }
    }
  );

  const toggleStatusMutation = useMutation(
    ({ id, status }) => axios.patch(`/api/super-admin/businesses/${id}/status`, { status }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['business', businessId]);
      }
    }
  );

  const handleDelete = () => {
    deleteMutation.mutate(businessId);
  };

  const handleToggleStatus = () => {
    const newStatus = business?.Status === 'Active' ? 'Inactive' : 'Active';
    toggleStatusMutation.mutate({ 
      businessId, 
      status: newStatus 
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Business not found</p>
      </div>
    );
  }

  const stats = analytics?.stats || {};

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/super-admin/businesses')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Businesses
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{business.Name}</h1>
            <p className="text-gray-600 mt-2">Business Code: {business.Code}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/super-admin/businesses/${businessId}/edit`)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit Business
            </button>
            <button
              onClick={handleToggleStatus}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                business.Status === 'Active'
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {business.Status === 'Active' ? (
                <>
                  <XCircle className="w-4 h-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Activate
                </>
              )}
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="mb-6">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          business.Status === 'Active' 
            ? 'bg-green-100 text-green-800' 
            : business.Status === 'Pending'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {business.Status}
        </span>
      </div>

      {/* Business Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Business Information</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-800">{business.Email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium text-gray-800">{business.Phone}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium text-gray-800">{business.Address || 'Not provided'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="font-medium text-gray-800">
                  {new Date(business.CreatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            {business.SubscriptionPlan && (
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Subscription Plan</p>
                  <p className="font-medium text-gray-800">{business.SubscriptionPlan}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Market, Currency & Compliance Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Market & Compliance Settings</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Country & Currency</p>
                <p className="font-semibold text-gray-900 mt-0.5">
                  {business.Country || 'United States'} ({business.Currency || 'USD'})
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Tax Engine Status</p>
                <p className="font-semibold text-gray-900 mt-0.5">
                  {business.TaxEnabled ? `Enabled (${((parseFloat(business.TaxRate) || 0) * 100).toFixed(2)}%)` : 'Tax Disabled / Exempt'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">TRN / EIN (Tax ID)</p>
                <p className="font-mono text-sm font-semibold text-gray-900 mt-0.5">
                  {business.TaxRegistrationNumber || 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Pharmacy License #</p>
                <p className="font-mono text-sm font-semibold text-gray-900 mt-0.5">
                  {business.LicenseNumber || 'Not specified'}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Pharmacist-in-Charge (PIC)</p>
              <p className="font-medium text-gray-900 mt-0.5">
                {business.PharmacistInChargeName || 'Not assigned'}
              </p>
              {business.LicenseAuthority && (
                <p className="text-xs text-gray-500 mt-0.5">Authority: {business.LicenseAuthority}</p>
              )}
            </div>
          </div>
        </div>

        {/* Business Analytics */}
        <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Business Analytics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-gray-600">Total Users</p>
              </div>
              <p className="text-2xl font-bold text-gray-800">{stats.totalUsers || 0}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-5 h-5 text-green-600" />
                <p className="text-sm text-gray-600">Total Orders</p>
              </div>
              <p className="text-2xl font-bold text-gray-800">{stats.totalOrders || 0}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5 text-purple-600" />
                <p className="text-sm text-gray-600">Medicines</p>
              </div>
              <p className="text-2xl font-bold text-gray-800">{stats.totalMedicines || 0}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
                <p className="text-sm text-gray-600">Revenue</p>
              </div>
              <p className="text-2xl font-bold text-gray-800">{business.Currency || '$'} {(stats.totalRevenue || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Business Users */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Business Users</h2>
        {users?.users && users.users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.users.map((user) => (
                  <tr key={user.UserId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.Name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.Email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {user.Role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.IsActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.IsActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.CreatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No users found for this business</p>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{business.Name}</strong>? This action cannot be undone and will delete all associated data.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
