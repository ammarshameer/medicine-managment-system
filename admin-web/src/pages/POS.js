import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle,
  User,
  CreditCard,
  Banknote,
  Smartphone,
  RefreshCw,
  X,
  FileText,
  ShieldCheck,
  Percent
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency, formatCurrency } from '../utils/formatCurrency';

export const POS = () => {
  const { user } = useAuth();
  const { currency, format } = useCurrency();
  const queryClient = useQueryClient();
  const receiptRef = useRef();

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Cart state
  const [cart, setCart] = useState([]);
  const [customerType, setCustomerType] = useState('walkin_guest'); // 'walkin_guest', 'walkin_details', 'registered'
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [notes, setNotes] = useState('');

  // Real-time tax preview state from backend
  const [taxPreview, setTaxPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Receipt modal state
  const [completedOrder, setCompletedOrder] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Fetch medicines catalog
  const { data: medicinesData, isLoading: medicinesLoading, refetch: refetchMedicines } = useQuery(
    'pos-medicines',
    () => axios.get('/api/medicines?limit=100').then(res => res.data.data.medicines || [])
  );

  // Fetch categories
  const { data: categoriesData } = useQuery(
    'pos-categories',
    () => axios.get('/api/categories').then(res => res.data.data.categories || [])
  );

  // Fetch registered users/customers
  const { data: usersData } = useQuery(
    'pos-users',
    () => axios.get('/api/users?role=CUSTOMER').then(res => res.data.data.users || []),
    { enabled: customerType === 'registered' }
  );

  // Live tax preview effect whenever cart items change
  useEffect(() => {
    if (cart.length === 0) {
      setTaxPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const res = await axios.post('/api/orders/preview-tax', {
          items: cart.map(i => ({ medicineId: i.id, quantity: i.quantity }))
        });
        if (res.data.success) {
          setTaxPreview(res.data.data);
        }
      } catch (err) {
        console.error('Tax preview error:', err);
      } finally {
        setPreviewLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [cart]);

  // Filtered medicines
  const filteredMedicines = useMemo(() => {
    if (!medicinesData) return [];
    return medicinesData.filter(med => {
      const matchesSearch = med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (med.manufacturer && med.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'ALL' || med.category === selectedCategory || med.categoryId === selectedCategory;
      return matchesSearch && matchesCategory && med.isActive;
    });
  }, [medicinesData, searchTerm, selectedCategory]);

  // Cart fallback calculations
  const rawSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [cart]);

  const grandTotal = taxPreview ? taxPreview.totalAmount : rawSubtotal;
  const subtotalAmount = taxPreview ? taxPreview.subtotal : rawSubtotal;
  const taxAmount = taxPreview ? taxPreview.taxAmount : 0;
  const taxRate = taxPreview ? taxPreview.taxRate : 0;

  const changeDue = useMemo(() => {
    const tendered = parseFloat(amountTendered) || 0;
    return Math.max(0, tendered - grandTotal);
  }, [amountTendered, grandTotal]);

  // Cart handlers
  const addToCart = (med) => {
    if (med.stock <= 0) {
      toast.error(`${med.name} is out of stock`);
      return;
    }

    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === med.id);
      if (existing) {
        if (existing.quantity >= med.stock) {
          toast.error(`Cannot add more than available stock (${med.stock})`);
          return prevCart;
        }
        return prevCart.map(item =>
          item.id === med.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prevCart, {
          id: med.id,
          name: med.name,
          price: parseFloat(med.price),
          stock: med.stock,
          quantity: 1,
          isTaxable: med.isTaxable !== false,
          priceIncludesTax: Boolean(med.priceIncludesTax),
          deaSchedule: med.deaSchedule,
          uaeClassification: med.uaeClassification,
          requiresPrescription: med.requiresPrescription
        }];
      }
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.stock) {
            toast.error(`Only ${item.stock} units available in stock`);
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const setDirectQuantity = (id, qtyStr) => {
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) return;

    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === id) {
          if (qty > item.stock) {
            toast.error(`Only ${item.stock} units available`);
            return { ...item, quantity: item.stock };
          }
          return { ...item, quantity: qty };
        }
        return item;
      });
    });
  };

  const removeFromCart = (id) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setAmountTendered('');
    setNotes('');
    setTaxPreview(null);
  };

  // Checkout Mutation
  const checkoutMutation = useMutation(
    (orderPayload) => axios.post('/api/orders/pos', orderPayload),
    {
      onSuccess: (res) => {
        const orderData = res.data.data;
        setCompletedOrder(orderData);
        setReceiptModalOpen(true);
        toast.success('Sale completed successfully!');
        clearCart();
        queryClient.invalidateQueries('pos-medicines');
        queryClient.invalidateQueries('recent-orders');
        queryClient.invalidateQueries('business-analytics');
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to complete sale');
      }
    }
  );

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    let finalCustomerName = 'Walk-in Guest';
    let finalCustomerPhone = null;
    let finalUserId = null;

    if (customerType === 'walkin_details') {
      finalCustomerName = customerName.trim() || 'Walk-in Customer';
      finalCustomerPhone = customerPhone.trim() || null;
    } else if (customerType === 'registered') {
      const selectedUser = usersData?.find(u => u.id === parseInt(selectedUserId, 10));
      if (!selectedUser) {
        toast.error('Please select a registered customer');
        return;
      }
      finalUserId = selectedUser.id;
      finalCustomerName = selectedUser.name;
      finalCustomerPhone = selectedUser.phone;
    }

    const payload = {
      items: cart.map(item => ({
        medicineId: item.id,
        quantity: item.quantity
      })),
      paymentMethod,
      customerName: finalCustomerName,
      customerPhone: finalCustomerPhone,
      userId: finalUserId,
      notes: notes.trim() || null
    };

    checkoutMutation.mutate(payload);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            Point of Sale (POS) Counter
          </h1>
          <p className="text-xs text-gray-500">
            Cashier: <span className="font-semibold text-gray-700">{user?.name}</span> | Currency: <span className="font-bold text-blue-700">{currency}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchMedicines()}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh Catalog
          </button>
        </div>
      </div>

      {/* Main Grid: Left side catalog, Right side cart */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 pt-4 overflow-hidden">
        {/* Left Side: Medicine Catalog (7 columns on desktop) */}
        <div className="lg:col-span-7 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Search and Category filters */}
          <div className="p-3 border-b border-gray-100 bg-gray-50 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search medicine name, manufacturer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${selectedCategory === 'ALL'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                  }`}
              >
                All Items
              </button>
              {categoriesData?.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${selectedCategory === cat.name
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Medicines Grid */}
          <div className="flex-1 p-3 overflow-y-auto">
            {medicinesLoading ? (
              <div className="flex items-center justify-center h-48">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : filteredMedicines.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium">No medicines match your search</p>
                <p className="text-xs text-gray-400 mt-1">Try a different name or category</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3">
                {filteredMedicines.map(med => {
                  const isOutOfStock = med.stock <= 0;
                  const isLowStock = med.stock > 0 && med.stock < 10;
                  const inCartItem = cart.find(i => i.id === med.id);

                  return (
                    <div
                      key={med.id}
                      onClick={() => !isOutOfStock && addToCart(med)}
                      className={`relative flex flex-col justify-between p-3 rounded-xl border text-left transition-all ${isOutOfStock
                          ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                          : 'bg-white border-gray-200 hover:border-blue-500 hover:shadow-md cursor-pointer group'
                        }`}
                    >
                      {inCartItem && (
                        <span className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-md">
                          {inCartItem.quantity}
                        </span>
                      )}

                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="text-xs font-bold text-gray-900 line-clamp-2 group-hover:text-blue-600">
                            {med.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className="text-[10px] text-gray-500">{med.category || 'General'}</span>
                          {med.isTaxable === false && (
                            <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-green-50 text-green-700 border border-green-200">
                              Exempt
                            </span>
                          )}
                          {med.priceIncludesTax && (
                            <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Incl. Tax
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-blue-700">{format(med.price)}</span>
                        </div>
                        <div>
                          {isOutOfStock ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">
                              Out
                            </span>
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${isLowStock ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                              }`}>
                              {med.stock} in stock
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Active Cart & Checkout (5 columns on desktop) */}
        <div className="lg:col-span-5 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Cart Header */}
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-gray-900 text-sm">Active Cart</span>
              <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 rounded-full">
                {cart.reduce((s, i) => s + i.quantity, 0)} items
              </span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Customer Selection Tabs */}
          <div className="p-2 border-b border-gray-100 bg-white">
            <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg text-xs font-medium">
              <button
                onClick={() => setCustomerType('walkin_guest')}
                className={`py-1 rounded-md transition-colors ${customerType === 'walkin_guest' ? 'bg-white text-blue-700 font-bold shadow-sm' : 'text-gray-600'
                  }`}
              >
                Guest
              </button>
              <button
                onClick={() => setCustomerType('walkin_details')}
                className={`py-1 rounded-md transition-colors ${customerType === 'walkin_details' ? 'bg-white text-blue-700 font-bold shadow-sm' : 'text-gray-600'
                  }`}
              >
                Walk-in Details
              </button>
              <button
                onClick={() => setCustomerType('registered')}
                className={`py-1 rounded-md transition-colors ${customerType === 'registered' ? 'bg-white text-blue-700 font-bold shadow-sm' : 'text-gray-600'
                  }`}
              >
                Registered
              </button>
            </div>

            {/* Customer Inputs */}
            {customerType === 'walkin_details' && (
              <div className="grid grid-cols-2 gap-2 mt-2 pt-1">
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-gray-300 rounded-md outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Phone Number"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-gray-300 rounded-md outline-none focus:border-blue-500"
                />
              </div>
            )}

            {customerType === 'registered' && (
              <div className="mt-2 pt-1">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-md outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">-- Select Customer --</option>
                  {usersData?.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.phone || u.email})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 p-3 overflow-y-auto divide-y divide-gray-100">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-8">
                <ShoppingCart className="w-10 h-10 text-gray-200 mb-2" />
                <p className="text-sm font-medium text-gray-500">Cart is empty</p>
                <p className="text-xs text-gray-400">Click on items from catalog to add</p>
              </div>
            ) : (
              cart.map(item => {
                const previewItem = taxPreview?.items?.find(pi => pi.medicineId === item.id);
                const isTaxable = previewItem ? previewItem.isTaxable : item.isTaxable;

                return (
                  <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-semibold text-gray-900 truncate">{item.name}</h4>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${isTaxable ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {isTaxable ? '[T]' : '[E]'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        {format(item.price)} × {item.quantity} = <span className="font-bold text-gray-800">{format(item.price * item.quantity)}</span>
                      </p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 font-bold"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.stock}
                        value={item.quantity}
                        onChange={(e) => setDirectQuantity(item.id, e.target.value)}
                        className="w-10 text-center text-xs py-0.5 font-bold border border-gray-200 rounded"
                      />
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 font-bold"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 text-red-500 hover:text-red-700 ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Checkout & Payment Area */}
          <div className="p-3 border-t border-gray-200 bg-gray-50 space-y-3">
            {/* Payment Method Selector */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                Payment Method
              </label>
              <div className="grid grid-cols-4 gap-1.5 text-xs">
                {[
                  { id: 'Cash', label: 'Cash', icon: Banknote },
                  { id: 'Credit Card', label: 'Card', icon: CreditCard },
                  { id: 'Debit Card', label: 'Debit', icon: CreditCard },
                  { id: 'JazzCash', label: 'JazzCash', icon: Smartphone }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`py-1.5 px-1 rounded-lg border text-center font-medium flex flex-col items-center justify-center gap-1 transition-colors ${paymentMethod === m.id
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    <m.icon className="w-3.5 h-3.5" />
                    <span className="text-[10px]">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cash Tendered & Change */}
            {paymentMethod === 'Cash' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-gray-600 block">Amount Tendered</label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-md outline-none focus:border-blue-500 bg-white font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-600 block">Change Due</label>
                  <div className="px-2.5 py-1 text-xs bg-gray-200 border border-gray-300 rounded-md font-bold text-gray-800">
                    {format(changeDue)}
                  </div>
                </div>
              </div>
            )}

            {/* Total breakdown */}
            <div className="bg-white p-2.5 rounded-lg border border-gray-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span className="font-semibold">{format(subtotalAmount)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax ({((taxRate) * 100).toFixed(2)}%):</span>
                  <span className="font-semibold">{format(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5 border-t border-gray-100">
                <span className="text-sm font-bold text-gray-900">Payable Total:</span>
                <span className="text-base font-black text-blue-700">{format(grandTotal)}</span>
              </div>
            </div>

            {/* Complete Sale Button */}
            <button
              disabled={cart.length === 0 || checkoutMutation.isLoading || previewLoading}
              onClick={handleCheckout}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold text-sm rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
            >
              {checkoutMutation.isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing Sale...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Complete Sale ({format(grandTotal)})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {receiptModalOpen && completedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-green-600 font-bold">
                <CheckCircle className="w-5 h-5" />
                <span>Transaction Successful</span>
              </div>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Receipt Area */}
            <div ref={receiptRef} className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-xs text-gray-800 font-mono space-y-3 print:p-0 print:border-none print:bg-white">
              <div className="text-center space-y-1">
                <h2 className="font-bold text-base uppercase text-gray-900">{completedOrder.business?.name || 'MMS Pharmacy'}</h2>
                {completedOrder.business?.legalName && (
                  <p className="text-[10px] text-gray-500 font-semibold">{completedOrder.business?.legalName}</p>
                )}
                <p className="text-[11px] text-gray-600">{completedOrder.business?.address}</p>
                <p className="text-[11px] text-gray-600">Tel: {completedOrder.business?.phone || 'N/A'}</p>

                {/* Compliance Credentials */}
                {completedOrder.business?.taxRegistrationNumber && (
                  <p className="text-[10px] text-gray-700 font-bold">TRN / Tax ID: {completedOrder.business?.taxRegistrationNumber}</p>
                )}
                {completedOrder.business?.licenseNumber && (
                  <p className="text-[10px] text-gray-700">Lic #: {completedOrder.business?.licenseNumber}</p>
                )}
                {completedOrder.business?.pharmacistInChargeName && (
                  <p className="text-[10px] text-gray-700">PIC: {completedOrder.business?.pharmacistInChargeName}</p>
                )}

                <div className="border-b border-gray-300 my-2"></div>
                <p className="font-bold text-xs">OFFICIAL SALES RECEIPT</p>
                <p className="text-[11px]">Invoice: #{completedOrder.orderId} | {new Date(completedOrder.orderDate).toLocaleString()}</p>
                <p className="text-[11px]">Cashier: {completedOrder.cashier?.name} | Cust: {completedOrder.customer?.name}</p>
              </div>

              <div className="border-b border-gray-300 my-2"></div>

              {/* Items Table */}
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-300 text-[10px] uppercase font-bold">
                    <th className="pb-1">Item</th>
                    <th className="pb-1 text-center">Qty</th>
                    <th className="pb-1 text-right">Price</th>
                    <th className="pb-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {completedOrder.items?.map((item, idx) => (
                    <tr key={idx} className="py-1">
                      <td className="py-1 font-semibold truncate max-w-[120px]">
                        {item.name} {item.isTaxable === false ? '[E]' : '[T]'}
                      </td>
                      <td className="py-1 text-center">{item.quantity}</td>
                      <td className="py-1 text-right">{formatCurrency(item.price, completedOrder.currency)}</td>
                      <td className="py-1 text-right font-bold">{formatCurrency(item.subtotal, completedOrder.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-b border-gray-300 my-2"></div>

              {/* Totals */}
              <div className="space-y-1 text-right">
                <div className="flex justify-between text-[11px] text-gray-700">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(completedOrder.subtotal, completedOrder.currency)}</span>
                </div>
                {parseFloat(completedOrder.taxAmount) > 0 && (
                  <div className="flex justify-between text-[11px] text-gray-700">
                    <span>Tax ({((parseFloat(completedOrder.taxRate) || 0) * 100).toFixed(2)}%):</span>
                    <span>{formatCurrency(completedOrder.taxAmount, completedOrder.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-gray-900 pt-1 border-t border-gray-200">
                  <span>GRAND TOTAL:</span>
                  <span>{formatCurrency(completedOrder.totalAmount, completedOrder.currency)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-600 pt-1">
                  <span>Payment Method:</span>
                  <span>{completedOrder.paymentMethod}</span>
                </div>
              </div>

              <div className="border-t border-gray-300 pt-3 text-center text-[10px] text-gray-500">
                <p>Thank you for choosing {completedOrder.business?.name}!</p>
                <p className="mt-0.5">Medicines sold are non-refundable once unsealed.</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-bold text-xs"
              >
                Close & Next Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;

