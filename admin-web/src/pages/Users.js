import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus,
  Search,
  Edit,
  Key,
  Ban,
  User as UserIcon,
  Calendar,
  Mail,
  Phone,
  Loader2,
  X,
  UserCheck,
  Users as UsersIcon
} from 'lucide-react';
import { useTranslation } from '../i18n';

// Add User / Customer Modal
const AddUserModal = ({ isStaff, onClose }) => {
  const { t } = useTranslation();
const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'CUSTOMER',
    emiratesId: '',
    nationalIdLast4: ''
  });

  const addUserMutation = useMutation(
    (payload) => axios.post('/api/admin/users', payload),
    {
      onSuccess: (res) => {
        toast.success(res.data.message || 'User created successfully');
        queryClient.invalidateQueries('users');
        onClose();
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to create user');
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (formData.password.length < 4) {
      toast.error('Password must be at least 4 characters or digits');
      return;
    }
    addUserMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              {isStaff ? t('Add New Customer') : t('Add New User / Customer')}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isStaff ? t('Register a new customer account in your pharmacy') : t('Register customer or staff account in your business')}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
          {!isStaff && (
            <div>
              <label className="font-semibold text-gray-700 block mb-1">
                {t('Account Role')} <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
              >
                <option value="CUSTOMER">{t('Customer (Online / Regular buyer)')}</option>
                <option value="STAFF">{t('Staff (POS & Counter Operator)')}</option>
                <option value="BUSINESS_OWNER">{t('Business Owner (Full Access)')}</option>
              </select>
            </div>
          )}

          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              {t('Full Name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={t('e.g. Asim Raza')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              {t('Email Address')} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder={t('user@example.com')}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">
                {t('Phone Number')}
              </label>
              <input
                type="text"
                placeholder={t('e.g. +971 50 1234567')}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700 block mb-1">
                {t('Emirates ID (UAE)')}
              </label>
              <input
                type="text"
                placeholder="784-1990-1234567-1"
                value={formData.emiratesId}
                onChange={(e) => setFormData({ ...formData, emiratesId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              {t('National ID / SSN Last 4 (USA/General)')}
            </label>
            <input
              type="text"
              maxLength="4"
              placeholder={t('e.g. 1234')}
              value={formData.nationalIdLast4}
              onChange={(e) => setFormData({ ...formData, nationalIdLast4: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              {t('Password / PIN')} <span className="text-red-500">*</span> {t('(Min 4 digits)')}
            </label>
            <input
              type="password"
              required
              minLength="4"
              placeholder={t('e.g. 1234 or secure password')}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">{t('4-digit PINs like 1234 or passwords are fully supported.')}</p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 font-semibold rounded-lg"
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              disabled={addUserMutation.isLoading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-lg shadow-sm inline-flex items-center gap-1.5"
            >
              {addUserMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {addUserMutation.isLoading ? t('Saving...') : t('Add Account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit User Profile Modal
const EditUserModal = ({ user, isStaff, onClose }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: user.name,
    phone: user.phone || '',
    role: user.role
  });

  const editUserMutation = useMutation(
    (payload) => axios.put(`/api/admin/users/${user.id}`, payload),
    {
      onSuccess: () => {
        toast.success('User profile updated');
        queryClient.invalidateQueries('users');
        onClose();
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to update user');
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    editUserMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">
            {isStaff ? t('Edit Customer') : t('Edit User')}: {user.name}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {!isStaff && (
            <div>
              <label className="font-semibold text-gray-700 block mb-1">{t('Role')}</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
              >
                <option value="CUSTOMER">{t('Customer')}</option>
                <option value="STAFF">{t('Staff')}</option>
                <option value="BUSINESS_OWNER">{t('Business Owner')}</option>
              </select>
            </div>
          )}

          <div>
            <label className="font-semibold text-gray-700 block mb-1">{t('Full Name')}</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="font-semibold text-gray-700 block mb-1">{t('Phone Number')}</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 font-semibold rounded-lg"
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              disabled={editUserMutation.isLoading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-lg shadow-sm inline-flex items-center gap-1.5"
            >
              {editUserMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Reset Password Modal
const ResetPasswordModal = ({ user, onClose }) => {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState('');

  const resetMutation = useMutation(
    (payload) => axios.put(`/api/admin/users/${user.id}/password`, payload),
    {
      onSuccess: () => {
        toast.success(`Password for ${user.name} has been updated`);
        onClose();
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to update password');
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      toast.error('Password must be at least 4 characters or digits');
      return;
    }
    resetMutation.mutate({ newPassword });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              {t('Reset Password')}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{user.name} ({user.email})</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              {t('New Password / 4-Digit PIN')} <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              minLength="4"
              placeholder={t('Enter new 4+ digit PIN / password')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 font-semibold rounded-lg"
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              disabled={resetMutation.isLoading || newPassword.length < 4}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-lg shadow-sm"
            >
              {resetMutation.isLoading ? t('Updating...') : t('Set Password')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const Users = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const isStaff = currentUser?.role === 'STAFF';

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState(isStaff ? 'CUSTOMER' : 'all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const { data: usersData, isLoading } = useQuery(
    ['users', page, limit, searchQuery, roleFilter],
    () => {
      const params = new URLSearchParams({
        page,
        limit,
        ...(searchQuery && { search: searchQuery }),
        ...(roleFilter !== 'all' && { role: roleFilter })
      });
      return axios.get(`/api/admin/users?${params}`).then(res => res.data.data);
    }
  );

  const toggleStatusMutation = useMutation(
    ({ userId, isActive }) => axios.patch(`/api/admin/users/${userId}/status?isActive=${isActive}`),
    {
      onSuccess: () => {
        toast.success('User status updated');
        queryClient.invalidateQueries('users');
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to update user status');
      }
    }
  );

  const users = usersData?.users || [];
  const pagination = usersData?.pagination || { total: 0, pages: 0 };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800';
      case 'BUSINESS_OWNER':
        return 'bg-blue-100 text-blue-800';
      case 'STAFF':
        return 'bg-green-100 text-green-800';
      case 'CUSTOMER':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
  };

  const roleTabs = isStaff
    ? [{ id: 'CUSTOMER', label: 'Customers' }, { id: 'all', label: 'All Users' }]
    : [
        { id: 'all', label: 'All Roles' },
        { id: 'CUSTOMER', label: 'Customers' },
        { id: 'STAFF', label: 'Staff' },
        { id: 'BUSINESS_OWNER', label: 'Owners' }
      ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UsersIcon className="w-7 h-7 text-blue-600" />
            {isStaff ? t('Customer Directory') : t('User & Customer Directory')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isStaff
              ? t('View registered pharmacy customers, search accounts, and register new customers')
              : t('Manage customer accounts, pharmacy staff, credentials, and access permissions')}
          </p>
        </div>
        <button
          onClick={() => setAddUserModalOpen(true)}
          className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors gap-1.5"
        >
          <Plus className="h-4 w-4" />
          {isStaff ? t('Add New Customer') : t('Add User / Customer')}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-3 justify-between items-center">
        {/* Role Filter Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold w-full md:w-auto">
          {roleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setRoleFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                roleFilter === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-80">
          <div className="flex-1 relative">
            <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('Search by name, email, phone...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9 pe-4 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
          >
            {t('Search')}
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <UserIcon className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p className="text-base font-semibold">{t('No users found')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('Click "Add User / Customer" to register your first customer or staff member')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3">{t('User')}</th>
                  <th className="px-6 py-3">{t('Role')}</th>
                  <th className="px-6 py-3">{t('Phone')}</th>
                  <th className="px-6 py-3">{t('Status')}</th>
                  <th className="px-6 py-3">{t('Joined Date')}</th>
                  <th className="px-6 py-3 text-end">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-9 w-9 bg-blue-100 text-blue-700 font-bold rounded-full flex items-center justify-center me-3 text-sm">
                          {user.name?.charAt(0)?.toUpperCase() || t('U')}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${getRoleBadgeClass(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-600">
                      {user.phone || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? t('Active') : t('Deactivated')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-end gap-2">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        {t('View')}
                      </button>
                      {(!isStaff || user.role === 'CUSTOMER') && (
                        <>
                          <button
                            onClick={() => setEditUser(user)}
                            className="px-2.5 py-1 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            {t('Edit')}
                          </button>
                          <button
                            onClick={() => setPasswordUser(user)}
                            className="px-2.5 py-1 text-xs font-bold text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title={t('Reset Password / 4-digit PIN')}
                          >
                            {t('Reset PIN')}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-white px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="text-xs text-gray-500">
              {t('Showing')} <span className="font-bold">{(page - 1) * limit + 1}</span> {t('to')}{' '}
              <span className="font-bold">{Math.min(page * limit, pagination.total)}</span> {t('of')}{' '}
              <span className="font-bold">{pagination.total}</span> {t('users')}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                {t('Previous')}
              </button>
              <span className="px-3 text-xs font-bold text-gray-700">{t('Page')} {page} {t('of')} {pagination.pages}</span>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="px-3 py-1 border border-gray-300 rounded-md text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                {t('Next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{t('User Profile')}</h3>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="h-16 w-16 bg-blue-100 text-blue-700 font-bold rounded-full mx-auto mb-3 flex items-center justify-center text-2xl">
                  {selectedUser.name?.charAt(0)?.toUpperCase() || t('U')}
                </div>
                <h4 className="text-lg font-bold text-gray-900">{selectedUser.name}</h4>
                <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full mt-1 ${getRoleBadgeClass(selectedUser.role)}`}>
                  {selectedUser.role}
                </span>
              </div>

              <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 text-gray-400 me-3" />
                  <div>
                    <p className="text-gray-400">{t('Email Address')}</p>
                    <p className="font-semibold text-gray-900">{selectedUser.email}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Phone className="h-4 w-4 text-gray-400 me-3" />
                  <div>
                    <p className="text-gray-400">{t('Phone')}</p>
                    <p className="font-semibold text-gray-900">{selectedUser.phone || t('N/A')}</p>
                  </div>
                </div>

                {selectedUser.emiratesId && (
                  <div className="flex items-center">
                    <UserCheck className="h-4 w-4 text-gray-400 me-3" />
                    <div>
                      <p className="text-gray-400">{t('Emirates ID (UAE)')}</p>
                      <p className="font-semibold text-gray-900 font-mono">{selectedUser.emiratesId}</p>
                    </div>
                  </div>
                )}

                {selectedUser.nationalIdLast4 && (
                  <div className="flex items-center">
                    <UserCheck className="h-4 w-4 text-gray-400 me-3" />
                    <div>
                      <p className="text-gray-400">{t('National ID / SSN (Last 4)')}</p>
                      <p className="font-semibold text-gray-900 font-mono">***-**-{selectedUser.nationalIdLast4}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center">
                  <Calendar className="h-4 w-4 text-gray-400 me-3" />
                  <div>
                    <p className="text-gray-400">{t('Registered On')}</p>
                    <p className="font-semibold text-gray-900">{new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {(!isStaff || selectedUser.role === 'CUSTOMER') && (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => {
                        const u = selectedUser;
                        setSelectedUser(null);
                        setEditUser(u);
                      }}
                      className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                    >
                      <Edit className="h-4 w-4 me-1.5" />
                      {t('Edit Profile')}
                    </button>
                    <button
                      onClick={() => {
                        const u = selectedUser;
                        setSelectedUser(null);
                        setPasswordUser(u);
                      }}
                      className="flex items-center justify-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold"
                    >
                      <Key className="h-4 w-4 me-1.5" />
                      {t('Reset PIN')}
                    </button>
                  </div>

                  <div className="mt-2">
                    <button
                      onClick={() => {
                        toggleStatusMutation.mutate({
                          userId: selectedUser.id,
                          isActive: !selectedUser.isActive
                        });
                        setSelectedUser(null);
                      }}
                      className={`w-full flex items-center justify-center px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                        selectedUser.isActive
                          ? 'bg-red-50 text-red-700 hover:bg-red-100'
                          : 'bg-green-50 text-green-700 hover:bg-green-100'
                      }`}
                    >
                      <Ban className="h-4 w-4 me-1.5" />
                      {selectedUser.isActive ? t('Deactivate Account') : t('Activate Account')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {addUserModalOpen && (
        <AddUserModal isStaff={isStaff} onClose={() => setAddUserModalOpen(false)} />
      )}

      {/* Edit User Modal */}
      {editUser && (
        <EditUserModal user={editUser} isStaff={isStaff} onClose={() => setEditUser(null)} />
      )}

      {/* Reset Password Modal */}
      {passwordUser && (
        <ResetPasswordModal user={passwordUser} onClose={() => setPasswordUser(null)} />
      )}
    </div>
  );
};
