import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  ShoppingCart,
  X,
  Calendar,
  User,
  DollarSign,
  FileText,
  Search,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calculator,
  Globe,
  Phone,
  CheckCircle2,
  Clock,
  Printer,
  Plus,
  Trash2
} from 'lucide-react';
import { useCurrency, formatCurrency } from '../utils/formatCurrency';

const CreateOrderModal = ({ onClose }) => {
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const [customerMode, setCustomerMode] = useState('walkin'); // 'walkin' | 'registered'
  const [selectedUserId, setSelectedUserId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('Counter / Direct Order');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ medicineId: '', quantity: 1, price: 0, maxStock: 0, name: '' }]);

  // Fetch registered customers
  const { data: customersData } = useQuery(
    'order-customers-list',
    () => axios.get('/api/admin/users?role=CUSTOMER&limit=100').then(res => res.data.data.users || [])
  );

  // Fetch medicines list
  const { data: medicinesData } = useQuery(
    'order-medicines-list',
    () => axios.get('/api/medicines?limit=150').then(res => res.data.data.medicines || [])
  );

  const medicines = medicinesData || [];
  const customers = customersData || [];

  const handleMedicineChange = (index, medicineId) => {
    const med = medicines.find(m => m.id === parseInt(medicineId, 10));
    const newItems = [...items];
    if (med) {
      newItems[index] = {
        medicineId: med.id,
        name: med.name,
        price: med.price,
        maxStock: med.stock,
        quantity: 1
      };
    } else {
      newItems[index] = { medicineId: '', name: '', price: 0, maxStock: 0, quantity: 1 };
    }
    setItems(newItems);
  };

  const handleQtyChange = (index, qty) => {
    const newItems = [...items];
    const val = Math.max(1, parseInt(qty, 10) || 1);
    newItems[index].quantity = val;
    setItems(newItems);
  };

  const addItemRow = () => {
    setItems([...items, { medicineId: '', quantity: 1, price: 0, maxStock: 0, name: '' }]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) {
      toast.error('Order must have at least one item');
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

  const grandTotal = items.reduce((sum, item) => sum + (parseFloat(item.price || 0) * (item.quantity || 1)), 0);

  const createOrderMutation = useMutation(
    (payload) => axios.post('/api/orders', payload),
    {
      onSuccess: () => {
        toast.success('Order created successfully!');
        queryClient.invalidateQueries('orders');
        onClose();
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to create order');
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();

    const validItems = items.filter(i => i.medicineId && i.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one valid medicine item');
      return;
    }

    // Check stock limits
    for (const it of validItems) {
      if (it.quantity > it.maxStock) {
        toast.error(`Quantity for "${it.name}" exceeds available stock (${it.maxStock})`);
        return;
      }
    }

    let finalName = customerName;
    let finalPhone = customerPhone;
    let finalUserId = null;

    if (customerMode === 'registered') {
      if (!selectedUserId) {
        toast.error('Please select a registered customer');
        return;
      }
      const cust = customers.find(c => c.id === parseInt(selectedUserId, 10));
      finalUserId = cust?.id;
      finalName = cust?.name;
      finalPhone = cust?.phone;
    } else {
      if (!customerName.trim()) {
        toast.error('Please provide customer name');
        return;
      }
    }

    createOrderMutation.mutate({
      userId: finalUserId,
      customerName: finalName,
      customerPhone: finalPhone,
      deliveryAddress,
      paymentMethod,
      notes,
      items: validItems.map(i => ({ medicineId: i.medicineId, quantity: i.quantity }))
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Create Direct / Manual Order
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Place an order with customer details and line items</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {/* Customer Mode Switcher */}
          <div>
            <label className="font-bold text-gray-700 block mb-1.5">Customer Type</label>
            <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl font-bold text-xs">
              <button
                type="button"
                onClick={() => setCustomerMode('walkin')}
                className={`py-2 rounded-lg transition-all ${customerMode === 'walkin' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}
              >
                Walk-in / Custom Customer
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode('registered')}
                className={`py-2 rounded-lg transition-all ${customerMode === 'registered' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}
              >
                Registered Customer ({customers.length})
              </button>
            </div>
          </div>

          {/* Customer Details */}
          {customerMode === 'registered' ? (
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Select Customer <span className="text-red-500">*</span></label>
              <select
                required
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Choose Registered Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email}) {c.phone ? `- ${c.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Customer Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariq Mehmood"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Customer Phone</label>
                <input
                  type="text"
                  placeholder="03001234567"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Medicine Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-gray-800">Order Items (Medicines) <span className="text-red-500">*</span></label>
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-bold gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Medicine
              </button>
            </div>

            <div className="space-y-2 border border-gray-200 p-3 rounded-xl bg-gray-50 max-h-56 overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <select
                      required
                      value={item.medicineId}
                      onChange={(e) => handleMedicineChange(idx, e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                    >
                      <option value="">-- Choose Medicine --</option>
                      {medicines.map(m => (
                        <option key={m.id} value={m.id} disabled={m.stock <= 0}>
                          {m.name} — {format(m.price)} (Stock: {m.stock})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-20">
                    <input
                      type="number"
                      min="1"
                      max={item.maxStock || 999}
                      value={item.quantity}
                      onChange={(e) => handleQtyChange(idx, e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs text-center font-bold outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Qty"
                    />
                  </div>

                  <div className="w-24 text-right font-mono font-bold text-gray-900">
                    {format(parseFloat(item.price || 0) * (item.quantity || 1))}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Total Row */}
            <div className="flex justify-between items-center mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <span className="font-bold text-blue-900 uppercase">Estimated Grand Total:</span>
              <span className="font-bold text-base font-mono text-blue-900">{format(grandTotal)}</span>
            </div>
          </div>

          {/* Delivery and Payment Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Delivery Address / Destination</label>
              <input
                type="text"
                placeholder="Direct Pickup or Delivery Address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Cash">Cash</option>
                <option value="Cash on Delivery">Cash on Delivery</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="JazzCash">JazzCash</option>
                <option value="EasyPaisa">EasyPaisa</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-gray-700 block mb-1">Order Notes / Instructions (Optional)</label>
            <textarea
              rows="2"
              placeholder="e.g. Special dosage requests or packaging notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createOrderMutation.isLoading || items.length === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-lg shadow-sm transition-all inline-flex items-center gap-1.5"
            >
              {createOrderMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {createOrderMutation.isLoading ? 'Creating Order...' : 'Submit Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const OrderDetailsModal = ({ order, onClose }) => {
  const [status, setStatus] = useState(order.status);
  const queryClient = useQueryClient();

  const { data: fullOrderData } = useQuery(
    ['order-full-details', order.id],
    () => axios.get(`/api/orders/${order.id}`).then(res => res.data.data)
  );

  const updateStatusMutation = useMutation(
    ({ orderId, status }) => axios.patch(`/api/orders/${orderId}/status`, { status }),
    {
      onSuccess: () => {
        toast.success('Order status updated');
        queryClient.invalidateQueries('orders');
        onClose();
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to update order status');
      }
    }
  );

  const handleUpdateStatus = () => {
    updateStatusMutation.mutate({ orderId: order.id, status });
  };

  const fullOrder = fullOrderData || order;
  const orderCurrency = fullOrder.currency || 'USD';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">Order #{fullOrder.id}</h2>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                fullOrder.source === 'POS' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {fullOrder.source === 'POS' ? <Calculator className="w-3 h-3 mr-1" /> : <Globe className="w-3 h-3 mr-1" />}
                {fullOrder.source || 'Online'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Placed on {new Date(fullOrder.orderDate).toLocaleString()}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Order Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
            <div>
              <span className="text-gray-500 font-semibold block">Customer Information</span>
              <span className="font-bold text-gray-900 text-sm block mt-0.5">
                {fullOrder.customerName || fullOrder.user?.name || 'Walk-in Customer'}
              </span>
              {fullOrder.customerPhone && (
                <span className="text-gray-600 block mt-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-gray-400" />
                  {fullOrder.customerPhone}
                </span>
              )}
              {fullOrder.user?.email && <span className="text-gray-500 block">{fullOrder.user.email}</span>}
            </div>

            <div>
              <span className="text-gray-500 font-semibold block">Fulfillment / Cashier</span>
              <span className="font-semibold text-gray-800 block mt-0.5">
                {fullOrder.source === 'POS' ? `Cashier: ${fullOrder.creatorName || 'Counter Staff'}` : 'Delivery / Online'}
              </span>
              <span className="text-gray-500 block mt-0.5">Address: {fullOrder.deliveryAddress || 'Counter Pickup'}</span>
            </div>

            <div>
              <span className="text-gray-500 font-semibold block">Payment Info</span>
              <span className="font-bold text-gray-900 block mt-0.5">{fullOrder.paymentMethod}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                fullOrder.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {fullOrder.paymentStatus}
              </span>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-2">Order Line Items</h3>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                <thead className="bg-gray-50 font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5">Medicine</th>
                    <th className="px-4 py-2.5 text-center">Quantity</th>
                    <th className="px-4 py-2.5 text-right">Unit Price</th>
                    <th className="px-4 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fullOrder.items?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {item.name || item.medicine?.name || `Medicine #${item.medicineId}`}
                      </td>
                      <td className="px-4 py-3 text-center">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.price, orderCurrency)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {formatCurrency(item.subtotal, orderCurrency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-bold border-t border-gray-200 divide-y divide-gray-200">
                  <tr>
                    <td colSpan="3" className="px-4 py-2 text-right uppercase text-gray-600">Subtotal:</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {formatCurrency(fullOrder.subtotal || fullOrder.totalAmount, orderCurrency)}
                    </td>
                  </tr>
                  {parseFloat(fullOrder.taxAmount) > 0 && (
                    <tr>
                      <td colSpan="3" className="px-4 py-2 text-right uppercase text-gray-600">
                        Tax ({((parseFloat(fullOrder.taxRate) || 0) * 100).toFixed(2)}%):
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {formatCurrency(fullOrder.taxAmount, orderCurrency)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan="3" className="px-4 py-3 text-right uppercase text-gray-900">Grand Total:</td>
                    <td className="px-4 py-3 text-right text-blue-900 text-sm font-black">
                      {formatCurrency(fullOrder.totalAmount, orderCurrency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Status Update Control */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">Update Order Status:</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 bg-white font-semibold outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Dispatched">Dispatched</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <button
              onClick={handleUpdateStatus}
              disabled={status === order.status || updateStatusMutation.isLoading}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold text-xs rounded-lg shadow-sm transition-all"
            >
              {updateStatusMutation.isLoading ? 'Saving...' : 'Save Status'}
            </button>
          </div>
        </div>

        <div className="flex justify-end p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
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
  const [limit] = useState(15);
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data: ordersData, isLoading } = useQuery(
    ['orders', page, limit, status, source, searchTerm],
    () => {
      const params = new URLSearchParams({
        page,
        limit,
        ...(status !== 'all' && { status }),
        ...(source !== 'all' && { source }),
        ...(searchTerm && { search: searchTerm })
      });
      return axios.get(`/api/orders/admin/all?${params}`).then(res => res.data.data);
    }
  );

  const orders = ordersData?.orders || [];
  const pagination = ordersData?.pagination || { total: 0, pages: 0 };

  const getStatusBadge = (st) => {
    switch (st) {
      case 'Delivered':
        return <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-800">Delivered</span>;
      case 'Dispatched':
        return <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">Dispatched</span>;
      case 'Approved':
        return <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800">Approved</span>;
      case 'Pending':
        return <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">Pending</span>;
      case 'Cancelled':
        return <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800">Cancelled</span>;
      default:
        return st;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-blue-600" />
            Orders Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor online customer orders, POS counter sales, and fulfillment status
          </p>
        </div>

        {/* Action Buttons: POS & Direct Order */}
        <div className="flex items-center gap-3">
          <Link
            to="/pos"
            className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all gap-1.5"
          >
            <Calculator className="w-4 h-4" />
            Open POS Counter
          </Link>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create Direct Order
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-3 justify-between items-center">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Order ID, Customer name, Phone..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Source and Status filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Source filter tabs */}
          <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs font-bold">
            <button
              onClick={() => { setSource('all'); setPage(1); }}
              className={`px-3 py-1.5 rounded-md transition-all ${
                source === 'all' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
              }`}
            >
              All Channels
            </button>
            <button
              onClick={() => { setSource('POS'); setPage(1); }}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1 ${
                source === 'POS' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
              }`}
            >
              <Calculator className="w-3 h-3" />
              POS Counter
            </button>
            <button
              onClick={() => { setSource('Online'); setPage(1); }}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1 ${
                source === 'Online' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
              }`}
            >
              <Globe className="w-3 h-3" />
              Online Orders
            </button>
          </div>

          {/* Status filter dropdown */}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white font-semibold outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p className="text-base font-semibold">No orders found</p>
            <p className="text-xs text-gray-400 mt-1">Orders placed online or via POS counter will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-6 py-3">Order ID</th>
                  <th className="px-6 py-3">Channel</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Total Amount</th>
                  <th className="px-6 py-3">Payment</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-gray-900">
                      #{order.id}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                        order.source === 'POS' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {order.source === 'POS' ? <Calculator className="w-3 h-3 mr-1" /> : <Globe className="w-3 h-3 mr-1" />}
                        {order.source || 'Online'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{order.customerName}</div>
                      {order.customerPhone && (
                        <div className="text-xs text-gray-500">{order.customerPhone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      {new Date(order.orderDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-gray-900">
                      {formatCurrency(order.totalAmount, order.currency)}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <span className="font-medium text-gray-700">{order.paymentMethod}</span>
                      <span className="block text-[10px] text-gray-400 font-semibold">{order.paymentStatus}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="px-3 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        View Details
                      </button>
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
              <span className="font-bold">{pagination.total}</span> orders
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

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {/* Create Order Modal */}
      {createModalOpen && (
        <CreateOrderModal
          onClose={() => setCreateModalOpen(false)}
        />
      )}
    </div>
  );
};
