import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Medicines } from './pages/Medicines';
import { Orders } from './pages/Orders';
import { Users } from './pages/Users';
import { Categories } from './pages/Categories';
import { Prescriptions } from './pages/Prescriptions';
import { Inventory } from './pages/Inventory';
import { Reports } from './pages/Reports';
import { Vendors } from './pages/Vendors';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { HRMS } from './pages/HRMS';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { SuperAdminBusinesses } from './pages/SuperAdminBusinesses';
import { SuperAdminBusinessDetails } from './pages/SuperAdminBusinessDetails';
import { SuperAdminBusinessForm } from './pages/SuperAdminBusinessForm';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const HomeRedirect = () => {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'SUPER_ADMIN' ? '/super-admin/dashboard' : '/dashboard'} replace />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<HomeRedirect />} />

                      {/* Routes accessible to both BUSINESS_OWNER and STAFF */}
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/pos" element={<POS />} />
                      <Route path="/medicines" element={<Medicines />} />
                      <Route path="/orders" element={<Orders />} />
                      <Route path="/prescriptions" element={<Prescriptions />} />
                      <Route path="/inventory" element={<Inventory />} />

                      {/* Routes restricted strictly to BUSINESS_OWNER (Staff redirected) */}
                      <Route
                        path="/vendors"
                        element={
                          <ProtectedRoute allowedRoles={['BUSINESS_OWNER']}>
                            <Vendors />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/purchase-orders"
                        element={
                          <ProtectedRoute allowedRoles={['BUSINESS_OWNER']}>
                            <PurchaseOrders />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/hrms"
                        element={
                          <ProtectedRoute allowedRoles={['BUSINESS_OWNER']}>
                            <HRMS />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/users"
                        element={
                          <ProtectedRoute allowedRoles={['BUSINESS_OWNER']}>
                            <Users />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/categories"
                        element={
                          <ProtectedRoute allowedRoles={['BUSINESS_OWNER']}>
                            <Categories />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/reports"
                        element={
                          <ProtectedRoute allowedRoles={['BUSINESS_OWNER']}>
                            <Reports />
                          </ProtectedRoute>
                        }
                      />

                      {/* Super Admin Routes */}
                      <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
                      <Route
                        path="/super-admin/dashboard"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                            <SuperAdminDashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/super-admin/businesses"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                            <SuperAdminBusinesses />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/super-admin/businesses/create"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                            <SuperAdminBusinessForm />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/super-admin/businesses/:businessId"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                            <SuperAdminBusinessDetails />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/super-admin/businesses/:businessId/edit"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                            <SuperAdminBusinessForm />
                          </ProtectedRoute>
                        }
                      />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
