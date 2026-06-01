import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Medicines } from './pages/Medicines';
import { Orders } from './pages/Orders';
import { Users } from './pages/Users';
import { Categories } from './pages/Categories';
import { Prescriptions } from './pages/Prescriptions';
import { Inventory } from './pages/Inventory';
import { Reports } from './pages/Reports';
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
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      {/* Business Owner Routes */}
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/medicines" element={<Medicines />} />
                      <Route path="/orders" element={<Orders />} />
                      <Route path="/users" element={<Users />} />
                      <Route path="/categories" element={<Categories />} />
                      <Route path="/prescriptions" element={<Prescriptions />} />
                      <Route path="/inventory" element={<Inventory />} />
                      <Route path="/reports" element={<Reports />} />
                      {/* Super Admin Routes */}
                      <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
                      <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
                      <Route path="/super-admin/businesses" element={<SuperAdminBusinesses />} />
                      <Route path="/super-admin/businesses/create" element={<SuperAdminBusinessForm />} />
                      <Route path="/super-admin/businesses/:businessId" element={<SuperAdminBusinessDetails />} />
                      <Route path="/super-admin/businesses/:businessId/edit" element={<SuperAdminBusinessForm />} />
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
