import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  XCircle,
  Loader2,
  X
} from 'lucide-react';

export const Vendors = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: ''
  });

  // Fetch vendors
  const { data: vendorsData, isLoading } = useQuery(
    ['vendors', statusFilter, searchTerm],
    () => axios.get(`/api/vendors?status=${statusFilter}&search=${encodeURIComponent(searchTerm)}`).then(res => res.data.data)
  );

  // Save mutation (create or update)
  const saveMutation = useMutation(
    (payload) => {
      if (editingVendor) {
        return axios.put(`/api/vendors/${editingVendor.id}`, payload);
      }
      return axios.post('/api/vendors', payload);
    },
    {
      onSuccess: () => {
        toast.success(editingVendor ? 'Vendor updated successfully' : 'Vendor created successfully');
        queryClient.invalidateQueries('vendors');
        closeModal();
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to save vendor');
      }
    }
  );

  // Deactivate mutation
  const deleteMutation = useMutation(
    (id) => axios.delete(`/api/vendors/${id}`),
    {
      onSuccess: () => {
        toast.success('Vendor deactivated');
        queryClient.invalidateQueries('vendors');
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to deactivate vendor');
      }
    }
  );

  const openAddModal = () => {
    setEditingVendor(null);
    setFormData({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      contactPerson: vendor.contactPerson || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || ''
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingVendor(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Vendor name is required');
      return;
    }
    saveMutation.mutate(formData);
  };

  const vendors = vendorsData?.vendors || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-blue-600" />
            Vendor Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage pharmaceutical suppliers, contacts, and procurement channels
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Vendor
        </button>
      </div>

      {/* Filters and search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search vendor name, contact, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-gray-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Active Vendors</option>
            <option value="inactive">Inactive Vendors</option>
            <option value="all">All Vendors</option>
          </select>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Truck className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p className="text-base font-semibold">No vendors found</p>
            <p className="text-xs text-gray-400 mt-1">Get started by adding your first supplier</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-6 py-3">Vendor / Company</th>
                  <th className="px-6 py-3">Contact Person</th>
                  <th className="px-6 py-3">Phone & Email</th>
                  <th className="px-6 py-3">Address</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {vendor.name}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {vendor.contactPerson || '—'}
                    </td>
                    <td className="px-6 py-4 space-y-0.5">
                      {vendor.phone && (
                        <div className="flex items-center text-xs text-gray-600">
                          <Phone className="w-3 h-3 mr-1 text-gray-400" />
                          {vendor.phone}
                        </div>
                      )}
                      {vendor.email && (
                        <div className="flex items-center text-xs text-gray-600">
                          <Mail className="w-3 h-3 mr-1 text-gray-400" />
                          {vendor.email}
                        </div>
                      )}
                      {!vendor.phone && !vendor.email && <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate">
                      {vendor.address || '—'}
                    </td>
                    <td className="px-6 py-4">
                      {vendor.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-green-600" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                          <XCircle className="w-3 h-3 mr-1 text-gray-500" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(vendor)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Vendor"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {vendor.isActive && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Deactivate vendor "${vendor.name}"?`)) {
                              deleteMutation.mutate(vendor.id);
                            }
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Deactivate Vendor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {editingVendor ? 'Edit Supplier / Vendor' : 'Add New Supplier / Vendor'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Vendor / Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pfizer Distribution Ltd"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tariq Mehmood"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+92 300 1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="sales@vendor.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Address / Warehouse</label>
                <textarea
                  rows="2"
                  placeholder="Plot # 12, Industrial Area, Karachi"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isLoading}
                  className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:bg-gray-400 flex items-center gap-1.5"
                >
                  {saveMutation.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingVendor ? 'Update Vendor' : 'Create Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
