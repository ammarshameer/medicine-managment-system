import React, { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { 
  Users, 
  Building2, 
  ShoppingCart, 
  DollarSign, 
  TrendingUp,
  Package,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, color }) => (
  <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-500 text-sm font-medium">{title}</p>
        <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
        {trend && (
          <p className={`text-sm mt-2 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? '+' : ''}{trend}% from last month
          </p>
        )}
      </div>
      <div className={`p-3 rounded-full ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

const RecentBusinessCard = ({ business, onViewDetails }) => (
  <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold text-gray-800">{business.BusinessName}</h3>
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        business.Status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {business.Status}
      </span>
    </div>
    <div className="space-y-2 text-sm text-gray-600">
      <p><span className="font-medium">Email:</span> {business.Email}</p>
      <p><span className="font-medium">Phone:</span> {business.Phone}</p>
      <p><span className="font-medium">Users:</span> {business.totalUsers || 0}</p>
      <p><span className="font-medium">Orders:</span> {business.orderCount || 0}</p>
    </div>
    <button
      onClick={() => onViewDetails(business.BusinessId)}
      className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
    >
      View Details
    </button>
  </div>
);

export const SuperAdminDashboard = () => {
  const { data: analytics, isLoading: analyticsLoading } = useQuery(
    'super-admin-analytics',
    () => axios.get('/api/super-admin/analytics').then(res => res.data.data),
    { enabled: true }
  );

  const { data: businesses, isLoading: businessesLoading } = useQuery(
    'recent-businesses',
    () => axios.get('/api/super-admin/businesses?page=1&limit=5').then(res => res.data.data),
    { enabled: true }
  );

  const handleViewDetails = (businessId) => {
    // Navigate to business details page
    window.location.href = `/super-admin/businesses/${businessId}`;
  };

  if (analyticsLoading || businessesLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const stats = analytics?.overview || {};

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Super Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Platform-wide analytics and business management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Businesses"
          value={stats.totalBusinesses || 0}
          icon={Building2}
          trend={stats.businessGrowth || 0}
          color="bg-blue-500"
        />
        <StatCard
          title="Total Users"
          value={stats.totalUsers || 0}
          icon={Users}
          trend={stats.userGrowth || 0}
          color="bg-green-500"
        />
        <StatCard
          title="Total Orders"
          value={stats.totalOrders || 0}
          icon={ShoppingCart}
          trend={stats.orderGrowth || 0}
          color="bg-purple-500"
        />
        <StatCard
          title="Total Revenue"
          value={`$${(stats.totalRevenue || 0).toLocaleString()}`}
          icon={DollarSign}
          trend={stats.revenueGrowth || 0}
          color="bg-yellow-500"
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Active Medicines"
          value={stats.totalMedicines || 0}
          icon={Package}
          color="bg-indigo-500"
        />
        <StatCard
          title="Pending Prescriptions"
          value={stats.pendingPrescriptions || 0}
          icon={Clock}
          color="bg-orange-500"
        />
        <StatCard
          title="Completed Orders"
          value={stats.completedOrders || 0}
          icon={CheckCircle}
          color="bg-teal-500"
        />
      </div>

      {/* Recent Businesses */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">Recent Businesses</h2>
          <button
            onClick={() => window.location.href = '/super-admin/businesses'}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            View All
          </button>
        </div>
        
        {businesses?.businesses && businesses.businesses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {businesses.businesses.map((business) => (
              <RecentBusinessCard
                key={business.BusinessId}
                business={business}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No businesses registered yet</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => window.location.href = '/super-admin/businesses/create'}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Building2 className="w-5 h-5" />
            Add New Business
          </button>
          <button
            onClick={() => window.location.href = '/super-admin/businesses'}
            className="flex items-center justify-center gap-2 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Users className="w-5 h-5" />
            Manage Businesses
          </button>
          <button
            onClick={() => window.location.href = '/super-admin/reports'}
            className="flex items-center justify-center gap-2 bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <TrendingUp className="w-5 h-5" />
            View Reports
          </button>
        </div>
      </div>
    </div>
  );
};
