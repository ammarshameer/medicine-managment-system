import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  ClipboardList,
  Plus,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  Ban,
  PackageCheck,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
  FileSpreadsheet
} from 'lucide-react';

export const PurchaseOrders = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState(null);

  // Form state for creating PO
  const [formData, setFormData] = useState({
    vendorId: '',
    orderDate: new Date().toISOString().slice(0, 10),
    status: 'Ordered',
    notes: '',
    items: [{ medicineId: '', quantity: 1, unitCost: 0 }]
  });

  // Fetch purchase orders
  const { data: posData, isLoading: posLoading } = useQuery(
    ['purchase-orders', statusFilter, searchTerm],
    () => axios.get(`/api/purchase-orders?status=${statusFilter}&search=${encodeURIComponent(searchTerm)}`).then(res => res.data.data)
  );

  // Fetch vendors for dropdown
  const { data: vendorsData } = useQuery(
    'po-vendors-list',
    () => axios.get('/api/vendors?status=active&limit=100').then(res => res.data.data.vendors || []),
    { enabled: createModalOpen }
  );

  // Fetch medicines for item selector
  const { data: medicinesData } = useQuery(
    'po-medicines-list',
    () => axios.get('/api/medicines?limit=200').then(res => res.data.data.medicines || []),
    { enabled: createModalOpen }
  );

  // Fetch single PO details
  const { data: poDetailsData, isLoading: detailsLoading } = useQuery(
    ['po-details', selectedPOId],
    () => axios.get(`/api/purchase-orders/${selectedPOId}`).then(res => res.data.data.purchaseOrder),
    { enabled: Boolean(selectedPOId && detailsModalOpen) }
  );

  // Create PO Mutation
  const createMutation = useMutation(
    (payload) => axios.post('/api/purchase-orders', payload),
    {
      onSuccess: () => {
        toast.success('Purchase order created successfully');
        queryClient.invalidateQueries('purchase-orders');
        setCreateModalOpen(false);
        resetForm();
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to create purchase order');
      }
    }
  );

  // Receive PO Mutation
  const receiveMutation = useMutation(
    (id) => axios.post(`/api/purchase-orders/${id}/receive`),
    {
      onSuccess: (res) => {
        toast.success(res.data.message || 'PO received! Stock & weighted costs updated.');
        queryClient.invalidateQueries('purchase-orders');
        queryClient.invalidateQueries(['po-details', selectedPOId]);
        queryClient.invalidateQueries('medicines');
        queryClient.invalidateQueries('pos-medicines');
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to receive purchase order');
      }
    }
  );

  // Cancel PO Mutation
  const cancelMutation = useMutation(
    (id) => axios.put(`/api/purchase-orders/${id}/cancel`),
    {
      onSuccess: () => {
        toast.success('Purchase order cancelled');
        queryClient.invalidateQueries('purchase-orders');
        queryClient.invalidateQueries(['po-details', selectedPOId]);
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to cancel purchase order');
      }
    }
  );

  const resetForm = () => {
    setFormData({
      vendorId: '',
      orderDate: new Date().toISOString().slice(0, 10),
      status: 'Ordered',
      notes: '',
      items: [{ medicineId: '', quantity: 1, unitCost: 0 }]
    });
  };

  // Line item handlers
  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    // If medicine is picked, auto-populate current average cost or price as default unitCost
    if (field === 'medicineId') {
      const selectedMed = medicinesData?.find(m => m.id === parseInt(value, 10));
      if (selectedMed) {
        newItems[index].unitCost = selectedMed.averageCost > 0 ? selectedMed.averageCost : selectedMed.price;
      }
    }

    setFormData({ ...formData, items: newItems });
  };

  const addItemRow = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { medicineId: '', quantity: 1, unitCost: 0 }]
    });
  };

  const removeItemRow = (index) => {
    if (formData.items.length === 1) {
      toast.error('Purchase order must have at least one line item');
      return;
    }
    setFormData({
      ...formData,
      items: formData.items.filter((_, idx) => idx !== index)
    });
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!formData.vendorId) {
      toast.error('Please select a vendor');
      return;
    }

    for (const item of formData.items) {
      if (!item.medicineId) {
        toast.error('Please select a medicine for each row');
        return;
      }
      if (item.quantity <= 0) {
        toast.error('Quantity must be greater than 0');
        return;
      }
      if (item.unitCost <= 0) {
        toast.error('Unit cost must be greater than 0');
        return;
      }
    }

    createMutation.mutate({
      vendorId: parseInt(formData.vendorId, 10),
      orderDate: formData.orderDate,
      status: formData.status,
      notes: formData.notes,
      items: formData.items.map(i => ({
        medicineId: parseInt(i.medicineId, 10),
        quantity: parseInt(i.quantity, 10),
        unitCost: parseFloat(i.unitCost)
      }))
    });
  };

  const openDetailsModal = (id) => {
    setSelectedPOId(id);
    setDetailsModalOpen(true);
  };

  const handleReceivePO = (po) => {
    if (window.confirm(`Are you sure you want to receive Purchase Order #${po.orderNumber}? This will atomically add stock to your inventory and update each medicine's weighted average cost.`)) {
      receiveMutation.mutate(po.id);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Received':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" />
            Received
          </span>
        );
      case 'Ordered':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <Clock className="w-3.5 h-3.5 mr-1 text-blue-600" />
            Ordered
          </span>
        );
      case 'Draft':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <ClipboardList className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Draft
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <Ban className="w-3.5 h-3.5 mr-1 text-red-600" />
            Cancelled
          </span>
        );
      default:
        return status;
    }
  };

  const purchaseOrders = posData?.purchaseOrders || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-blue-600" />
            Purchase Orders & Stock In
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create vendor procurement orders, track deliveries, and atomically receive inventory with weighted cost averaging
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create Purchase Order
        </button>
      </div>

      {/* Filters and search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search PO number or vendor..."
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
            <option value="all">All Statuses</option>
            <option value="Ordered">Ordered</option>
            <option value="Draft">Draft</option>
            <option value="Received">Received</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Purchase Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {posLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : purchaseOrders.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p className="text-base font-semibold">No purchase orders found</p>
            <p className="text-xs text-gray-400 mt-1">Create a purchase order to restock your pharmacy catalog</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-6 py-3">PO Number</th>
                  <th className="px-6 py-3">Vendor / Supplier</th>
                  <th className="px-6 py-3">Order Date</th>
                  <th className="px-6 py-3">Total Amount</th>
                  <th className="px-6 py-3">Items</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-blue-700">
                      {po.orderNumber}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{po.vendorName || 'Vendor #' + po.vendorId}</div>
                      {po.vendorPhone && <div className="text-xs text-gray-500">{po.vendorPhone}</div>}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      {new Date(po.orderDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      PKR {po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      {po.itemCount} items
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(po.status)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openDetailsModal(po.id)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {po.status !== 'Received' && po.status !== 'Cancelled' && (
                        <button
                          onClick={() => handleReceivePO(po)}
                          disabled={receiveMutation.isLoading}
                          className="px-2.5 py-1 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors inline-flex items-center gap-1 shadow-sm"
                          title="Receive Stock"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          Receive
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

      {/* Create Purchase Order Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Create Purchase Order
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Select Vendor <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.vendorId}
                    onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- Choose Vendor --</option>
                    {vendorsData?.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Order Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.orderDate}
                    onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Initial Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Ordered">Ordered</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
              </div>

              {/* Line Items Builder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Order Items (Procurement Lines)
                  </label>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Another Medicine
                  </button>
                </div>

                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2.5">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1">
                        <select
                          required
                          value={item.medicineId}
                          onChange={(e) => handleItemChange(idx, 'medicineId', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">-- Select Medicine --</option>
                          {medicinesData?.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} (Cur Stock: {m.stock})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg text-center outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                        />
                      </div>

                      <div className="w-32">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">PKR</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            placeholder="UnitCost"
                            value={item.unitCost}
                            onChange={(e) => handleItemChange(idx, 'unitCost', e.target.value)}
                            className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-right"
                          />
                        </div>
                      </div>

                      <div className="w-24 text-right text-xs font-bold text-gray-800">
                        PKR {((item.quantity || 0) * (item.unitCost || 0)).toFixed(2)}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        className="p-1.5 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end p-2 bg-blue-50 rounded-lg text-xs font-bold text-blue-950">
                  <span>Total Procurement Amount: PKR {formData.items.reduce((sum, i) => sum + ((i.quantity || 0) * (i.unitCost || 0)), 0).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Procurement Notes</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Expected delivery by Tuesday, batch # required on invoice..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isLoading}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:bg-gray-400 flex items-center gap-1.5"
                >
                  {createMutation.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Details Modal */}
      {detailsModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-xs font-mono font-bold text-blue-700 block">{poDetailsData?.orderNumber}</span>
                <h3 className="text-lg font-bold text-gray-900">Purchase Order Details</h3>
              </div>
              <button onClick={() => setDetailsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailsLoading || !poDetailsData ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Meta info grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
                  <div>
                    <span className="text-gray-500 block">Vendor:</span>
                    <span className="font-bold text-gray-900">{poDetailsData.vendorName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Order Date:</span>
                    <span className="font-bold text-gray-900">{new Date(poDetailsData.orderDate).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Status:</span>
                    <div className="mt-0.5">{getStatusBadge(poDetailsData.status)}</div>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Created By:</span>
                    <span className="font-bold text-gray-900">{poDetailsData.creatorName || 'Owner'}</span>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                    <thead className="bg-gray-50 font-semibold uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-2.5">Medicine</th>
                        <th className="px-4 py-2.5 text-center">Ordered Qty</th>
                        <th className="px-4 py-2.5 text-right">Vendor Unit Cost</th>
                        <th className="px-4 py-2.5 text-right">Line Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {poDetailsData.items?.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{item.medicineName}</td>
                          <td className="px-4 py-3 text-center">{item.quantity}</td>
                          <td className="px-4 py-3 text-right font-mono">PKR {item.unitCost.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                            PKR {item.subtotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
                      <tr>
                        <td colSpan="3" className="px-4 py-2.5 text-right uppercase">Total Purchase Amount:</td>
                        <td className="px-4 py-2.5 text-right text-blue-900">
                          PKR {poDetailsData.totalAmount.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {poDetailsData.notes && (
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                    <span className="font-bold text-gray-700 block mb-0.5">Notes:</span>
                    <p className="text-gray-600">{poDetailsData.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div>
                    {poDetailsData.status !== 'Received' && poDetailsData.status !== 'Cancelled' && (
                      <button
                        onClick={() => {
                          if (window.confirm('Cancel this purchase order?')) {
                            cancelMutation.mutate(poDetailsData.id);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {poDetailsData.status !== 'Received' && poDetailsData.status !== 'Cancelled' && (
                      <button
                        onClick={() => handleReceivePO(poDetailsData)}
                        disabled={receiveMutation.isLoading}
                        className="px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm flex items-center gap-1.5"
                      >
                        {receiveMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                        Receive Order into Inventory
                      </button>
                    )}
                    <button
                      onClick={() => setDetailsModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
