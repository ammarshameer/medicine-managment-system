import React from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import {
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Plus,
  FileText,
  Package,
  Loader2
} from 'lucide-react';

export const Dashboard = () => {
  const { data: stats, isLoading: statsLoading } = useQuery(
    'business-analytics',
    () => axios.get('/api/admin/analytics').then(res => res.data.data),
    { enabled: true }
  );

  const { data: lowStockMedicines, isLoading: lowStockLoading } = useQuery(
    'low-stock-medicines',
    () => axios.get('/api/medicines?sortBy=stock&sortOrder=asc&limit=10').then(res => res.data.data.medicines),
    { enabled: true }
  );

  const { data: recentOrders, isLoading: ordersLoading } = useQuery(
    'recent-orders',
    () => axios.get('/api/orders/admin/all?limit=5').then(res => res.data.data.orders),
    { enabled: true }
  );

  if (statsLoading || lowStockLoading || ordersLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const analytics = stats?.stats || {};
  const lowStockItems = lowStockMedicines?.filter(m => m.stock < 10).slice(0, 5) || [];
  const orders = recentOrders || [];

  const dashboardStats = [
    {
      title: 'Total Users',
      value: analytics.totalUsers || 0,
      change: analytics.userGrowth || 0,
      icon: Users,
      color: 'bg-blue-500'
    },
    {
      title: 'Total Orders',
      value: analytics.totalOrders || 0,
      change: analytics.orderGrowth || 0,
      icon: ShoppingCart,
      color: 'bg-green-500'
    },
    {
      title: 'Total Revenue',
      value: `$${(analytics.totalRevenue || 0).toLocaleString()}`,
      change: analytics.revenueGrowth || 0,
      icon: DollarSign,
      color: 'bg-yellow-500'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back! Here's an overview of your medicine management system.
        </p>
      </div>

      {/* Dashboard Overview - Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dashboardStats.map((stat) => (
          <div key={stat.title} className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">{stat.value}</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600 font-medium">{stat.change > 0 ? '+' : ''}{stat.change}%</span>
                  <span className="text-sm text-gray-500 ml-1">from last month</span>
                </div>
              </div>
              <div className={`p-3 ${stat.color} rounded-full`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Revenue Chart */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Revenue</h3>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="h-32 w-64 bg-gradient-to-r from-blue-100 to-blue-200 rounded-lg mb-4"></div>
            <p className="text-sm text-gray-500">Revenue chart placeholder</p>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Low Stock Alerts</h3>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div className="space-y-3">
            {lowStockItems.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No low stock items</p>
            ) : (
              lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center">
                    <Package className="h-4 w-4 text-red-500 mr-3" />
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                  </div>
                  <span className="text-sm text-red-600 font-medium">{item.stock} units</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button 
              onClick={() => window.location.href = '/medicines'}
              className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add New Medicine
            </button>
            <button 
              onClick={() => window.location.href = '/reports'}
              className="w-full flex items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <FileText className="h-5 w-5 mr-2" />
              View All Reports
            </button>
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
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
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${order.totalAmount?.toFixed(2) || '0.00'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
