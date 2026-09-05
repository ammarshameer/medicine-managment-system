import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  FileText,
  Package,
  Calculator,
  Loader2,
  ArrowUpRight,
  Percent,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../utils/formatCurrency';

export const Dashboard = () => {
  const { user } = useAuth();
  const { format, currency } = useCurrency();
  const isStaff = user?.role === 'STAFF';

  // Period selector for Business Owner analytics
  const [period, setPeriod] = useState('month'); // 'month' | 'quarter' | 'year'
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());

  // Fetch Dashboard Stats (role-branched)
  const { data: statsData, isLoading: statsLoading } = useQuery(
    'dashboard-stats',
    () => axios.get('/api/admin/dashboard').then(res => res.data.data)
  );

  // Fetch Low Stock Medicines
  const { data: lowStockData, isLoading: lowStockLoading } = useQuery(
    'dashboard-low-stock',
    () => axios.get('/api/medicines?sortBy=stock&sortOrder=asc&limit=10').then(res => res.data.data.medicines || [])
  );

  // Fetch Financial Analytics Trend (Business Owner only)
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery(
    ['dashboard-analytics', period, targetYear],
    () => axios.get(`/api/admin/dashboard/analytics?period=${period}&year=${targetYear}`).then(res => res.data.data),
    { enabled: !isStaff }
  );

  if (statsLoading || lowStockLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const stats = statsData || {};
  const lowStockItems = lowStockData?.filter(m => m.stock < 10).slice(0, 5) || [];
  const recentOrders = stats.recentOrders || [];
  const topMedicines = stats.topMedicines || [];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name}!
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isStaff
              ? 'Operational overview & counter register station'
              : 'Pharmacy financial performance, inventory status, and sales metrics'}
          </p>
        </div>

        {/* Quick POS Launch Button */}
        <Link
          to="/pos"
          className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-all gap-2"
        >
          <Calculator className="w-4 h-4" />
          Open POS Counter
        </Link>
      </div>

      {/* FINANCIAL METRICS (BUSINESS OWNER ONLY) */}
      {!isStaff && (
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Financial & Profit Overview ({currency})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Revenue */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Revenue</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-gray-900 font-mono">
                  {format(stats.totalRevenue || 0)}
                </span>
                <p className="text-xs text-gray-500 mt-1">Net revenue (excluding sales tax)</p>
              </div>
            </div>

            {/* Total Cost */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cost of Goods (COGS)</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-gray-900 font-mono">
                  {format(stats.totalCost || 0)}
                </span>
                <p className="text-xs text-gray-500 mt-1">Weighted procurement cost</p>
              </div>
            </div>

            {/* Net Profit */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-700 p-5 rounded-2xl text-white shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-green-100 uppercase tracking-wider">Net Gross Profit</span>
                <div className="w-9 h-9 rounded-xl bg-white bg-opacity-20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black font-mono">
                  {format(stats.totalProfit || 0)}
                </span>
                <p className="text-xs text-green-100 mt-1 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Revenue minus procurement cost
                </p>
              </div>
            </div>

            {/* Profit Margin */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Profit Margin</span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Percent className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-gray-900 font-mono">
                  {stats.profitMargin || 0}%
                </span>
                <p className="text-xs text-gray-500 mt-1">Gross return on sales</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OPERATIONAL METRICS */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Operational Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Orders */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500">
              <span>Total Orders</span>
              <ShoppingCart className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-black text-gray-900 mt-2">{stats.totalOrders || 0}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Online & Counter POS</p>
          </div>

          {/* Pending Orders */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500">
              <span>Pending Orders</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-black text-amber-700 mt-2">{stats.pendingOrders || 0}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Requires dispatch</p>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500">
              <span>Low Stock Alerts</span>
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-2xl font-black text-red-600 mt-2">{stats.lowStockMedicines || 0}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">&lt; 10 units in stock</p>
          </div>

          {/* Pending Prescriptions */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500">
              <span>Pending Prescriptions</span>
              <FileText className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-indigo-700 mt-2">{stats.pendingPrescriptions || 0}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Awaiting pharmacist review</p>
          </div>
        </div>
      </div>

      {/* INTERACTIVE FINANCIAL TREND CHART (BUSINESS OWNER ONLY) */}
      {!isStaff && (
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900">Revenue, Cost & Profit Trends</h3>
              <p className="text-xs text-gray-500">Interactive financial performance series</p>
            </div>

            {/* Timeframe & Period Selector */}
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs font-bold">
                <button
                  onClick={() => setPeriod('month')}
                  className={`px-3 py-1 rounded-md transition-all ${period === 'month' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
                    }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setPeriod('quarter')}
                  className={`px-3 py-1 rounded-md transition-all ${period === 'quarter' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
                    }`}
                >
                  Quarterly
                </button>
                <button
                  onClick={() => setPeriod('year')}
                  className={`px-3 py-1 rounded-md transition-all ${period === 'year' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
                    }`}
                >
                  5-Year
                </button>
              </div>

              {period !== 'year' && (
                <select
                  value={targetYear}
                  onChange={(e) => setTargetYear(parseInt(e.target.value, 10))}
                  className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-bold"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="h-72 w-full pt-2">
            {analyticsLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : analyticsData?.series?.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No financial data recorded for this timeframe
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={analyticsData?.series || []}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [format(Number(value)), undefined]}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    name="Cost of Goods"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCost)"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="Net Profit"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorProfit)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Grid: Low Stock Alert & Recent Orders / Top Medicines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Low Stock Warnings
            </h3>
            <Link to="/inventory" className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center">
              View Inventory <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-xs font-medium">
              <CheckCircle2 className="w-8 h-8 mx-auto text-green-500 mb-1" />
              All medicines have healthy stock levels (&gt;= 10 units)
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {lowStockItems.map(med => (
                <div key={med.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{med.name}</h4>
                    <p className="text-[11px] text-gray-500">{med.manufacturer || med.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                      {med.stock} left
                    </span>
                    {!isStaff && (
                      <Link
                        to="/purchase-orders"
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                      >
                        Reorder
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Selling Products (Business Owner) or Recent Orders (Staff) */}
        {!isStaff ? (
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Top Selling Medicines
              </h3>
              <Link to="/reports" className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center">
                Detailed Report <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {topMedicines.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs font-medium">
                No sales recorded yet
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {topMedicines.map(med => (
                  <div key={med.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">{med.name}</h4>
                      <p className="text-[11px] text-gray-500">{med.sold} units sold</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-gray-900 block font-mono">
                        {format(med.revenue)}
                      </span>
                      <span className="text-[11px] text-green-600 font-semibold block font-mono">
                        +{format(med.profit)} profit
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                Recent Orders
              </h3>
              <Link to="/orders" className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center">
                All Orders <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-gray-100">
              {recentOrders.map(order => (
                <div key={order.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">
                      Order #{order.id} ({order.source})
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {order.customer} • {order.itemCount} items
                    </span>
                  </div>
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${order.status === 'Delivered'
                      ? 'bg-green-100 text-green-800'
                      : order.status === 'Dispatched'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                      }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
