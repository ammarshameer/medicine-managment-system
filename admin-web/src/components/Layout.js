import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Calculator,
  Pill,
  ShoppingCart,
  Users,
  Tag,
  FileText,
  Package,
  Truck,
  ClipboardList,
  UserCheck,
  BarChart3,
  Building2,
  Menu,
  X,
  LogOut,
  User,
  UserPlus,
  ChevronDown,
  ShieldAlert
} from 'lucide-react';

export const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Navigation for Business Owners (Full features)
  const businessOwnerNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'POS Counter', href: '/pos', icon: Calculator, badge: 'Active' },
    { name: 'Medicines', href: '/medicines', icon: Pill },
    { name: 'Orders', href: '/orders', icon: ShoppingCart },
    { name: 'Prescriptions', href: '/prescriptions', icon: FileText },
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Vendors', href: '/vendors', icon: Truck },
    { name: 'Purchase Orders', href: '/purchase-orders', icon: ClipboardList },
    { name: 'HRMS & Payroll', href: '/hrms', icon: UserCheck },
    { name: 'Staff & Users', href: '/users', icon: Users },
    { name: 'Categories', href: '/categories', icon: Tag },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
  ];

  // Navigation for Staff (Operational only - no financial/salary data)
  const staffNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'POS Counter', href: '/pos', icon: Calculator, badge: 'Active' },
    { name: 'Medicines', href: '/medicines', icon: Pill },
    { name: 'Orders', href: '/orders', icon: ShoppingCart },
    { name: 'Customers', href: '/users', icon: Users },
    { name: 'Prescriptions', href: '/prescriptions', icon: FileText },
    { name: 'Inventory', href: '/inventory', icon: Package },
  ];

  // Navigation for Super Admin
  const superAdminNavigation = [
    { name: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
    { name: 'Businesses', href: '/super-admin/businesses', icon: Building2 },
  ];

  let navigation = businessOwnerNavigation;
  if (user?.role === 'SUPER_ADMIN') {
    navigation = superAdminNavigation;
  } else if (user?.role === 'STAFF') {
    navigation = staffNavigation;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        <div 
          className={`fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setSidebarOpen(false)}
        />
        <div className={`fixed inset-y-0 left-0 flex w-64 flex-col bg-white transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                M
              </div>
              <span className="text-lg font-bold text-gray-900">MMS Platform</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-2 text-gray-400 hover:bg-gray-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="px-4 py-2 border-b bg-blue-50 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-800">
              Role: {user?.role?.replace('_', ' ')}
            </span>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <div className="flex items-center">
                    <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    {item.name}
                  </div>
                  {item.badge && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-6 border-b">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                M
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">MMS Portal</h1>
                <p className="text-xs text-gray-500">{user?.role?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || (item.href !== '/dashboard' && item.href !== '/super-admin/dashboard' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <item.icon className={`mr-3 h-5 w-5 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    {item.name}
                  </div>
                  {item.badge && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          {user?.role === 'STAFF' && (
            <div className="p-3 m-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center text-amber-800 text-xs font-medium">
                <ShieldAlert className="w-4 h-4 mr-1 text-amber-600" />
                Staff Operational Mode
              </div>
              <p className="text-[11px] text-amber-700 mt-1">
                Financial reports & vendor purchasing are restricted.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main content wrapper */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 items-center justify-between bg-white px-4 shadow-sm border-b border-gray-200 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 hidden sm:inline">
              Pharmacy System
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Quick POS link button */}
            {user?.role !== 'SUPER_ADMIN' && (
              <Link
                to="/pos"
                className="hidden sm:inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-semibold rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <Calculator className="w-3.5 h-3.5 mr-1.5" />
                Open POS Register
              </Link>
            )}

            {/* User profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-3 rounded-lg p-1.5 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <span className="text-xs font-semibold block text-gray-900 leading-tight">{user?.name}</span>
                  <span className="text-[10px] text-gray-500 block leading-tight">{user?.role?.replace('_', ' ')}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>

              {userMenuOpen && (
                <div 
                  className="absolute right-0 mt-2 w-56 rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 z-50 divide-y divide-gray-100"
                  onMouseLeave={() => setUserMenuOpen(false)}
                >
                  <div className="px-4 py-3">
                    <p className="text-xs font-medium text-gray-500">Signed in as</p>
                    <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    {user?.role === 'SUPER_ADMIN' && (
                      <Link
                        to="/super-admin/businesses/create"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <UserPlus className="mr-3 h-4 w-4 text-gray-400" />
                        Add Pharmacy Business
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="mr-3 h-4 w-4 text-red-500" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-6 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};
