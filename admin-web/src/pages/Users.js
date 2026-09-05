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
  CheckCircle2,
  User as UserIcon,
  Calendar,
  Mail,
  Phone,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  UserCheck,
  Users as UsersIcon
} from 'lucide-react';

// Add User / Customer Modal
const AddUserModal = ({ isStaff, onClose }) => {
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
              {isStaff ? 'Add New Customer' : 'Add New User / Customer'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isStaff ? 'Register a new customer account in your pharmacy' : 'Register customer or staff account in your business'}
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
                Account Role <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
              >
                <option value="CUSTOMER">Customer (Online / Regular buyer)</option>
                <option value="STAFF">Staff (POS & Counter Operator)</option>
                <option value="BUSINESS_OWNER">Business Owner (Full Access)</option>
              </select>
            </div>
          )}

          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Asim Raza"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="user@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="e.g. +971 50 1234567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700 block mb-1">
                Emirates ID (UAE)
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
              National ID / SSN Last 4 (USA/General)
            </label>
            <input
              type="text"
              maxLength="4"
              placeholder="e.g. 1234"
              value={formData.nationalIdLast4}
              onChange={(e) => setFormData({ ...formData, nationalIdLast4: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              Password / PIN <span className="text-red-500">*</span> (Min 4 digits)
            </label>
            <input
              type="password"
              required
              minLength="4"
              placeholder="e.g. 1234 or secure password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">4-digit PINs like 1234 or passwords are fully supported.</p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addUserMutation.isLoading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-lg shadow-sm inline-flex items-center gap-1.5"
            >
              {addUserMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {addUserMutation.isLoading ? 'Saving...' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit User Profile Modal
const EditUserModal = ({ user, isStaff, onClose }) => {
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
            {isStaff ? 'Edit Customer' : 'Edit User'}: {user.name}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {!isStaff && (
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
              >
                <option value="CUSTOMER">Customer</option>
                <option value="STAFF">Staff</option>
                <option value="BUSINESS_OWNER">Business Owner</option>
              </select>
            </div>
          )}

          <div>
            <label className="font-semibold text-gray-700 block mb-1">Full Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="font-semibold text-gray-700 block mb-1">Phone Number</label>
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={editUserMutation.isLoading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-lg shadow-sm inline-flex items-center gap-1.5"
            >
              {editUserMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Reset Password Modal
const ResetPasswordModal = ({ user, onClose }) => {
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
              Reset Password
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
              New Password / 4-Digit PIN <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              minLength="4"
              placeholder="Enter new 4+ digit PIN / password"
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetMutation.isLoading || newPassword.length < 4}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-lg shadow-sm"
            >
              {resetMutation.isLoading ? 'Updating...' : 'Set Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const Users = () => {
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
            {isStaff ? 'Customer Directory' : 'User & Customer Directory'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isStaff
              ? 'View registered pharmacy customers, search accounts, and register new customers'
              : 'Manage customer accounts, pharmacy staff, credentials, and access permissions'}
          </p>
        </div>
        <button
          onClick={() => setAddUserModalOpen(true)}
          className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors gap-1.5"
        >
          <Plus className="h-4 w-4" />
          {isStaff ? 'Add New Customer' : 'Add User / Customer'}
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
          >
            Search
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
            <p className="text-base font-semibold">No users found</p>
            <p className="text-xs text-gray-400 mt-1">Click "Add User / Customer" to register your first customer or staff member</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Phone</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Joined Date</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-9 w-9 bg-blue-100 text-blue-700 font-bold rounded-full flex items-center justify-center mr-3 text-sm">
                          {user.name?.charAt(0)?.toUpperCase() || 'U'}
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
                        {user.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        View
                      </button>
                      {(!isStaff || user.role === 'CUSTOMER') && (
                        <>
                          <button
                            onClick={() => setEditUser(user)}
                            className="px-2.5 py-1 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setPasswordUser(user)}
                            className="px-2.5 py-1 text-xs font-bold text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Reset Password / 4-digit PIN"
                          >
                            Reset PIN
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
              Showing <span className="font-bold">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-bold">{Math.min(page * limit, pagination.total)}</span> of{' '}
              <span className="font-bold">{pagination.total}</span> users
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-3 text-xs font-bold text-gray-700">Page {page} of {pagination.pages}</span>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="px-3 py-1 border border-gray-300 rounded-md text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
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
              <h3 className="text-lg font-bold text-gray-900">User Profile</h3>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="h-16 w-16 bg-blue-100 text-blue-700 font-bold rounded-full mx-auto mb-3 flex items-center justify-center text-2xl">
                  {selectedUser.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <h4 className="text-lg font-bold text-gray-900">{selectedUser.name}</h4>
                <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full mt-1 ${getRoleBadgeClass(selectedUser.role)}`}>
                  {selectedUser.role}
                </span>
              </div>

              <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 text-gray-400 mr-3" />
                  <div>
                    <p className="text-gray-400">Email Address</p>
                    <p className="font-semibold text-gray-900">{selectedUser.email}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Phone className="h-4 w-4 text-gray-400 mr-3" />
                  <div>
                    <p className="text-gray-400">Phone</p>
                    <p className="font-semibold text-gray-900">{selectedUser.phone || 'N/A'}</p>
                  </div>
                </div>

                {selectedUser.emiratesId && (
                  <div className="flex items-center">
                    <UserCheck className="h-4 w-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-gray-400">Emirates ID (UAE)</p>
                      <p className="font-semibold text-gray-900 font-mono">{selectedUser.emiratesId}</p>
                    </div>
                  </div>
                )}

                {selectedUser.nationalIdLast4 && (
                  <div className="flex items-center">
                    <UserCheck className="h-4 w-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-gray-400">National ID / SSN (Last 4)</p>
                      <p className="font-semibold text-gray-900 font-mono">***-**-{selectedUser.nationalIdLast4}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center">
                  <Calendar className="h-4 w-4 text-gray-400 mr-3" />
                  <div>
                    <p className="text-gray-400">Registered On</p>
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
                      <Edit className="h-4 w-4 mr-1.5" />
                      Edit Profile
                    </button>
                    <button
                      onClick={() => {
                        const u = selectedUser;
                        setSelectedUser(null);
                        setPasswordUser(u);
                      }}
                      className="flex items-center justify-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold"
                    >
                      <Key className="h-4 w-4 mr-1.5" />
                      Reset PIN
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
                      <Ban className="h-4 w-4 mr-1.5" />
                      {selectedUser.isActive ? 'Deactivate Account' : 'Activate Account'}
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
