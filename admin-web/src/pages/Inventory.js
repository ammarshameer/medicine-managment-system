import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Package,
  Plus,
  Minus,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

export const Inventory = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [direction, setDirection] = useState('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery(
    ['inventory', page, limit],
    () => {
      const params = new URLSearchParams({ page, limit });
      return axios.get(`/api/admin/inventory?${params}`).then(res => res.data.data);
    }
  );

  const adjustMutation = useMutation(
    ({ medicineId, signedQuantity, reason }) => {
      const params = new URLSearchParams({
        medicineId,
        quantity: signedQuantity,
        reason
      });
      return axios.post(`/api/admin/inventory/adjust?${params}`);
    },
    {
      onSuccess: (res) => {
        queryClient.invalidateQueries('inventory');
        toast.success(`Stock updated to ${res.data.data.newStock}`);
        closeAdjustModal();
      },
      onError: (err) => {
        toast.error(err?.response?.data?.message || 'Failed to adjust stock');
      }
    }
  );

  const openAdjustModal = (medicine) => {
    setAdjustTarget(medicine);
    setDirection('in');
    setQuantity('');
    setReason('');
  };

  const closeAdjustModal = () => {
    setAdjustTarget(null);
  };

  const handleAdjustSubmit = (e) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Enter a quantity greater than 0');
      return;
    }
    if (!reason.trim()) {
      toast.error('Reason is required');
      return;
    }
    const signedQuantity = direction === 'in' ? qty : -qty;
    adjustMutation.mutate({ medicineId: adjustTarget.id, signedQuantity, reason: reason.trim() });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const medicines = data?.medicines || [];
  const pagination = data?.pagination || { total: 0, pages: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>
        <p className="mt-1 text-sm text-gray-600">Track and adjust medicine stock levels</p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {medicines.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No inventory items</h3>
              <p className="text-sm text-gray-500">Add medicines to start tracking stock.</p>
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adjust</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {medicines.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{m.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.category || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${m.stock < 10 ? 'text-red-600' : 'text-gray-900'}`}>
                      {m.stock}
                      {m.stock < 10 && (
                        <span className="ml-1 inline-flex items-center text-xs text-red-600">
                          <AlertTriangle className="h-3 w-3 mr-0.5" /> Low
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => openAdjustModal(m)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Adjust Stock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {pagination.pages > 1 && (
          <div className="bg-white px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <p className="text-sm text-gray-700">
              Page <span className="font-medium">{page}</span> of <span className="font-medium">{pagination.pages}</span>
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Adjust Stock Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">Adjust Stock — {adjustTarget.name}</h3>
              <button onClick={closeAdjustModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Current stock: <span className="font-medium">{adjustTarget.stock}</span></p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('in')}
                  className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md border ${direction === 'in' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-700'}`}
                >
                  <Plus className="h-4 w-4 mr-1" /> Stock In
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('out')}
                  className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md border ${direction === 'out' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-700'}`}
                >
                  <Minus className="h-4 w-4 mr-1" /> Stock Out
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. New shipment, Damaged stock"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAdjustModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustMutation.isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {adjustMutation.isLoading ? 'Saving...' : 'Apply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
