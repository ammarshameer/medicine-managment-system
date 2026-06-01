import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { ShoppingCart, X, Calendar, User, DollarSign, FileText, Search, Filter, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const OrderDetailsModal = ({ order, onClose, onUpdateStatus }) => {
  const [status, setStatus] = useState(order.status);

  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation(
    ({ orderId, status }) => axios.patch(`/api/orders/${orderId}/status`, { status }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('orders');
        onClose();
      }
    }
  );

  const handleUpdateStatus = () => {
    updateStatusMutation.mutate({ orderId: order.id, status });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Order Details - #{order.id}</h2>
            <p className="text-sm text-gray-600 mt-1">Review and manage the details for this order</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Order Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-500 w-24">Order ID:</span>
                    <span className="text-sm text-gray-900">#{order.id}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-500 w-24">Customer:</span>
                    <span className="text-sm text-gray-900">{order.user?.name || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-500 w-24">Date:</span>
                    <span className="text-sm text-gray-900">{new Date(order.orderDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-500 w-24">Total:</span>
                    <span className="text-sm text-gray-900">${order.totalAmount?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-500 w-24">Status:</span>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      order.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'Approved' ? 'bg-green-100 text-green-800' :
                      order.status === 'Dispatched' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'Delivered' ? 'bg-teal-100 text-teal-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-500 w-24">Payment:</span>
                    <span className="text-sm text-gray-900">{order.paymentMethod || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {order.prescription && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Prescription
                  </h3>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <div className="text-center text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-2" />
                      <p>Prescription attached</p>
                      <p className="text-xs">Status: {order.prescription.status}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Order Items</h3>
                <div className="space-y-2">
                  {order.items?.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.medicine.name}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity} × ${item.price?.toFixed(2)}</p>
                      </div>
                      <span className="text-sm font-medium text-gray-900">${item.subtotal?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Update Order Status</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Dispatched">Dispatched</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Address</h3>
                <p className="text-sm text-gray-600">{order.deliveryAddress || 'N/A'}</p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Actions</h3>
                <button
                  onClick={handleUpdateStatus}
                  disabled={updateStatusMutation.isLoading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  {updateStatusMutation.isLoading ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export const Orders = () => {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [status, setStatus] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const queryClient = useQueryClient();

  const { data: ordersData, isLoading } = useQuery(
    ['orders', page, limit, status],
    () => {
      const params = new URLSearchParams({
        page,
        limit,
        ...(status && { status })
      });
      return axios.get(`/api/orders/admin/all?${params}`).then(res => res.data.data);
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const orders = ordersData?.orders || [];
  const pagination = ordersData?.pagination || { total: 0, pages: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage customer orders and fulfillment
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <button
            onClick={() => {
              setStatus('');
              setPage(1);
            }}
            className="flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Clear Filter
          </button>
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Orders</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
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
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{order.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.user?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.orderDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${order.totalAmount?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'Approved' ? 'bg-green-100 text-green-800' :
                        order.status === 'Dispatched' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'Delivered' ? 'bg-teal-100 text-teal-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => setSelectedOrder(order)}
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

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={() => {}}
        />
      )}
    </div>
  );
};
