import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
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
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const Users = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const { data: usersData, isLoading } = useQuery(
    ['users', page, limit, searchQuery],
    () => {
      const params = new URLSearchParams({
        page,
        limit,
        ...(searchQuery && { search: searchQuery })
      });
      return axios.get(`/api/users?${params}`).then(res => res.data.data);
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
        </div>
        <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4 mr-2" />
          Add New User
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setPage(1);
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Clear
          </button>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Registered Users</h3>
        </div>
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
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className={`hover:bg-gray-50 ${
                      selectedUser?.id === user.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {user.imagePath ? (
                          <img
                            src={user.imagePath}
                            alt={user.name}
                            className="h-8 w-8 rounded-full mr-3"
                          />
                        ) : (
                          <div className="h-8 w-8 bg-gray-200 rounded-full mr-3 flex items-center justify-center">
                            <UserIcon className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          {user.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.phone || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeClass(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="bg-white px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(page * limit, pagination.total)}</span> of{' '}
                  <span className="font-medium">{pagination.total}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    const pageNum = Math.max(1, page - 2) + i;
                    if (pageNum > pagination.pages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          page === pageNum
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">User Details</h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <Ban className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="text-center mb-6">
                {selectedUser.imagePath ? (
                  <img
                    src={selectedUser.imagePath}
                    alt={selectedUser.name}
                    className="h-20 w-20 rounded-full mx-auto mb-4"
                  />
                ) : (
                  <div className="h-20 w-20 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <UserIcon className="h-10 w-10 text-gray-400" />
                  </div>
                )}
                <h4 className="text-lg font-medium text-gray-900">{selectedUser.name}</h4>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-2 ${getRoleBadgeClass(selectedUser.role)}`}>
                  {selectedUser.role}
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="text-sm text-gray-900">{selectedUser.email}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Phone className="h-4 w-4 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="text-sm text-gray-900">{selectedUser.phone || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <UserIcon className="h-4 w-4 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      selectedUser.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedUser.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center">
                  <Calendar className="h-4 w-4 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Member Since</p>
                    <p className="text-sm text-gray-900">{new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={() => console.log('Edit profile:', selectedUser.name)}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </button>
                <button
                  onClick={() => console.log('Reset password:', selectedUser.name)}
                  className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  <Key className="h-4 w-4 mr-2" />
                  Reset Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
