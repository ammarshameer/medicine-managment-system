import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Users,
  UserCheck,
  Plus,
  Search,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  CreditCard,
  Printer,
  X,
  Loader2,
  UserPlus,
  Link as LinkIcon,
  FileSpreadsheet
} from 'lucide-react';

export const HRMS = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('employees'); // 'employees' | 'payroll'

  // Employee state
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState('all');
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  // Add employee mode: 'new_user' vs 'link_existing'
  const [addMode, setAddMode] = useState('new_user');

  // Employee form state
  const [empForm, setEmpForm] = useState({
    userId: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'STAFF',
    designation: '',
    department: 'Pharmacy',
    joiningDate: new Date().toISOString().slice(0, 10),
    salary: '',
    employmentStatus: 'Active'
  });

  // Payroll state
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [payrollStatusFilter, setPayrollStatusFilter] = useState('all');

  // Salary modals
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState(null);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  // Single salary form
  const [salaryForm, setSalaryForm] = useState({
    employeeId: '',
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
    basicSalary: '',
    allowances: 0,
    deductions: 0,
    notes: ''
  });

  // Pay form
  const [payForm, setPayForm] = useState({
    paymentMethod: 'Bank Transfer',
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  // Queries
  const { data: employeesData, isLoading: employeesLoading } = useQuery(
    ['hrms-employees', employeeStatusFilter, employeeSearch],
    () => axios.get(`/api/hrms/employees?status=${employeeStatusFilter}&search=${encodeURIComponent(employeeSearch)}`).then(res => res.data.data.employees || [])
  );

  const { data: unlinkedUsersData } = useQuery(
    'hrms-unlinked-users',
    () => axios.get('/api/hrms/unlinked-users').then(res => res.data.data.users || []),
    { enabled: employeeModalOpen && addMode === 'link_existing' }
  );

  const { data: salariesData, isLoading: salariesLoading } = useQuery(
    ['hrms-salaries', selectedMonth, selectedYear, payrollStatusFilter],
    () => axios.get(`/api/hrms/salaries?month=${selectedMonth}&year=${selectedYear}&status=${payrollStatusFilter}`).then(res => res.data.data.salaries || [])
  );

  // Mutations
  const saveEmployeeMutation = useMutation(
    (payload) => {
      if (editingEmployee) {
        return axios.put(`/api/hrms/employees/${editingEmployee.id}`, payload);
      }
      return axios.post('/api/hrms/employees', payload);
    },
    {
      onSuccess: () => {
        toast.success(editingEmployee ? 'Employee updated' : 'Employee created successfully');
        queryClient.invalidateQueries('hrms-employees');
        queryClient.invalidateQueries('hrms-unlinked-users');
        setEmployeeModalOpen(false);
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to save employee');
      }
    }
  );

  const deleteEmployeeMutation = useMutation(
    (id) => axios.delete(`/api/hrms/employees/${id}`),
    {
      onSuccess: () => {
        toast.success('Employee deactivated');
        queryClient.invalidateQueries('hrms-employees');
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to deactivate employee');
      }
    }
  );

  const batchGeneratePayrollMutation = useMutation(
    (payload) => axios.post('/api/hrms/salaries/batch-generate', payload),
    {
      onSuccess: (res) => {
        toast.success(res.data.message || 'Monthly payroll generated');
        queryClient.invalidateQueries('hrms-salaries');
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to generate payroll');
      }
    }
  );

  const saveSalaryMutation = useMutation(
    (payload) => axios.post('/api/hrms/salaries', payload),
    {
      onSuccess: () => {
        toast.success('Salary slip created');
        queryClient.invalidateQueries('hrms-salaries');
        setSalaryModalOpen(false);
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to create salary slip');
      }
    }
  );

  const markAsPaidMutation = useMutation(
    ({ id, payload }) => axios.put(`/api/hrms/salaries/${id}/pay`, payload),
    {
      onSuccess: () => {
        toast.success('Salary marked as paid');
        queryClient.invalidateQueries('hrms-salaries');
        setPayModalOpen(false);
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to mark salary as paid');
      }
    }
  );

  // Employee Handlers
  const openAddEmployeeModal = () => {
    setEditingEmployee(null);
    setAddMode('new_user');
    setEmpForm({
      userId: '',
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'STAFF',
      designation: '',
      department: 'Pharmacy',
      joiningDate: new Date().toISOString().slice(0, 10),
      salary: '',
      employmentStatus: 'Active'
    });
    setEmployeeModalOpen(true);
  };

  const openEditEmployeeModal = (emp) => {
    setEditingEmployee(emp);
    setEmpForm({
      userId: emp.userId,
      name: emp.name,
      email: emp.email,
      password: '',
      phone: emp.phone || '',
      role: emp.role,
      designation: emp.designation,
      department: emp.department || 'Pharmacy',
      joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      salary: emp.salary,
      employmentStatus: emp.employmentStatus
    });
    setEmployeeModalOpen(true);
  };

  const handleEmpSubmit = (e) => {
    e.preventDefault();
    if (!empForm.designation.trim()) {
      toast.error('Designation is required');
      return;
    }

    if (!editingEmployee) {
      if (addMode === 'link_existing') {
        if (!empForm.userId) {
          toast.error('Please select an existing user to link');
          return;
        }
        saveEmployeeMutation.mutate({
          mode: 'link_existing',
          userId: parseInt(empForm.userId, 10),
          designation: empForm.designation,
          department: empForm.department,
          joiningDate: empForm.joiningDate,
          salary: parseFloat(empForm.salary) || 0,
          employmentStatus: empForm.employmentStatus
        });
      } else {
        if (!empForm.name || !empForm.email || !empForm.password) {
          toast.error('Name, email, and password are required for new user');
          return;
        }
        saveEmployeeMutation.mutate({
          mode: 'new_user',
          name: empForm.name,
          email: empForm.email,
          password: empForm.password,
          phone: empForm.phone,
          role: empForm.role,
          designation: empForm.designation,
          department: empForm.department,
          joiningDate: empForm.joiningDate,
          salary: parseFloat(empForm.salary) || 0,
          employmentStatus: empForm.employmentStatus
        });
      }
    } else {
      saveEmployeeMutation.mutate({
        name: empForm.name,
        phone: empForm.phone,
        role: empForm.role,
        designation: empForm.designation,
        department: empForm.department,
        joiningDate: empForm.joiningDate,
        salary: parseFloat(empForm.salary) || 0,
        employmentStatus: empForm.employmentStatus
      });
    }
  };

  const handleSalarySubmit = (e) => {
    e.preventDefault();
    if (!salaryForm.employeeId) {
      toast.error('Please select an employee');
      return;
    }
    saveSalaryMutation.mutate({
      employeeId: parseInt(salaryForm.employeeId, 10),
      month: parseInt(salaryForm.month, 10),
      year: parseInt(salaryForm.year, 10),
      basicSalary: parseFloat(salaryForm.basicSalary) || 0,
      allowances: parseFloat(salaryForm.allowances) || 0,
      deductions: parseFloat(salaryForm.deductions) || 0,
      notes: salaryForm.notes
    });
  };

  const handlePaySubmit = (e) => {
    e.preventDefault();
    if (!selectedSalary) return;
    markAsPaidMutation.mutate({
      id: selectedSalary.id,
      payload: payForm
    });
  };

  const openPayModal = (salary) => {
    setSelectedSalary(salary);
    setPayForm({
      paymentMethod: 'Bank Transfer',
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: ''
    });
    setPayModalOpen(true);
  };

  const openPayslipModal = (salary) => {
    setSelectedPayslip(salary);
    setPayslipModalOpen(true);
  };

  const employees = employeesData || [];
  const salaries = salariesData || [];

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-blue-600" />
            Human Resources & Payroll (HRMS)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Confidential employee directory, designations, and monthly salary disbursement
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'employees'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Users className="w-4 h-4" />
            Employees ({employees.length})
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'payroll'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <DollarSign className="w-4 h-4" />
            Monthly Payroll
          </button>
        </div>
      </div>

      {/* TAB 1: EMPLOYEES DIRECTORY */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          {/* Action bar */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search employee name, role, designation..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={employeeStatusFilter}
                onChange={(e) => setEmployeeStatusFilter(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="On Leave">On Leave</option>
                <option value="Terminated">Terminated</option>
              </select>

              <button
                onClick={openAddEmployeeModal}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Employee
              </button>
            </div>
          </div>

          {/* Employees Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {employeesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : employees.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Users className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="text-base font-semibold">No employees found</p>
                <p className="text-xs text-gray-400 mt-1">Add staff pharmacists and cashiers to manage roles and salaries</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                    <tr>
                      <th className="px-6 py-3">Employee Name</th>
                      <th className="px-6 py-3">Designation & Dept</th>
                      <th className="px-6 py-3">System Role</th>
                      <th className="px-6 py-3">Base Salary</th>
                      <th className="px-6 py-3">Joining Date</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{emp.name}</div>
                          <div className="text-xs text-gray-500">{emp.email} {emp.phone && `• ${emp.phone}`}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-800">{emp.designation}</div>
                          <div className="text-xs text-gray-500">{emp.department}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                            {emp.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900">
                          PKR {emp.salary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600">
                          {emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${emp.employmentStatus === 'Active'
                            ? 'bg-green-100 text-green-800'
                            : emp.employmentStatus === 'On Leave'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                            }`}>
                            {emp.employmentStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => openEditEmployeeModal(emp)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Profile"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {emp.employmentStatus === 'Active' && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Deactivate employee "${emp.name}"?`)) {
                                  deleteEmployeeMutation.mutate(emp.id);
                                }
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Deactivate"
                            >
                              <Trash2 className="w-4 h-4" />
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
        </div>
      )}

      {/* TAB 2: MONTHLY PAYROLL */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Payroll Controls */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700">Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700">Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <select
                value={payrollStatusFilter}
                onChange={(e) => setPayrollStatusFilter(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Payment Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  batchGeneratePayrollMutation.mutate({
                    month: selectedMonth,
                    year: selectedYear
                  });
                }}
                disabled={batchGeneratePayrollMutation.isLoading}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors whitespace-nowrap"
              >
                {batchGeneratePayrollMutation.isLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1.5" />}
                Generate {monthNames[selectedMonth - 1]} Payroll
              </button>

              <button
                onClick={() => {
                  setSalaryForm({
                    employeeId: '',
                    month: selectedMonth,
                    year: selectedYear,
                    basicSalary: '',
                    allowances: 0,
                    deductions: 0,
                    notes: ''
                  });
                  setSalaryModalOpen(true);
                }}
                className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-lg shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Custom Slip
              </button>
            </div>
          </div>

          {/* Payroll Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {salariesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : salaries.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="text-base font-semibold">No payroll records for {monthNames[selectedMonth - 1]} {selectedYear}</p>
                <p className="text-xs text-gray-400 mt-1">Click "Generate Payroll" to automatically create salary slips for all active employees</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                    <tr>
                      <th className="px-6 py-3">Employee</th>
                      <th className="px-6 py-3">Period</th>
                      <th className="px-6 py-3">Basic Salary</th>
                      <th className="px-6 py-3">Allowances / Deductions</th>
                      <th className="px-6 py-3">Net Payable</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {salaries.map((sal) => (
                      <tr key={sal.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{sal.employeeName}</div>
                          <div className="text-xs text-gray-500">{sal.designation} • {sal.department}</div>
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-gray-700">
                          {monthNames[sal.month - 1]} {sal.year}
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-800">
                          PKR {sal.basicSalary.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-xs space-y-0.5">
                          {sal.allowances > 0 && <span className="text-green-600 block">+PKR {sal.allowances.toFixed(2)} (Allow)</span>}
                          {sal.deductions > 0 && <span className="text-red-600 block">-PKR {sal.deductions.toFixed(2)} (Deduct)</span>}
                          {sal.allowances === 0 && sal.deductions === 0 && <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-6 py-4 font-bold font-mono text-blue-900">
                          PKR {sal.netSalary.toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          {sal.paymentStatus === 'Paid' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" />
                              Paid ({sal.paymentMethod})
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => openPayslipModal(sal)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Print Payslip"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {sal.paymentStatus === 'Pending' && (
                            <button
                              onClick={() => openPayModal(sal)}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors inline-flex items-center gap-1 shadow-sm"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              Mark Paid
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
        </div>
      )}

      {/* Add / Edit Employee Modal */}
      {employeeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {editingEmployee ? 'Edit Employee Profile' : 'Add Employee'}
              </h3>
              <button onClick={() => setEmployeeModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode selector when adding new */}
            {!editingEmployee && (
              <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAddMode('new_user')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${addMode === 'new_user' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
                    }`}
                >
                  <UserPlus className="w-4 h-4" />
                  Create New Account
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('link_existing')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${addMode === 'link_existing' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
                    }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  Link Existing User
                </button>
              </div>
            )}

            <form onSubmit={handleEmpSubmit} className="space-y-3 text-xs">
              {/* If Link Existing User Mode */}
              {!editingEmployee && addMode === 'link_existing' ? (
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">
                    Select Registered User <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={empForm.userId}
                    onChange={(e) => setEmpForm({ ...empForm, userId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- Choose User without Employee Profile --</option>
                    {unlinkedUsersData?.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}) - Current Role: {u.role}
                      </option>
                    ))}
                  </select>
                  {unlinkedUsersData?.length === 0 && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      No unlinked users found. Switch to "Create New Account" to register a new employee.
                    </p>
                  )}
                </div>
              ) : (
                /* New User Fields */
                <div className="space-y-3">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Full Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Asim Raza"
                      value={empForm.name}
                      onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {!editingEmployee && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-gray-700 block mb-1">Email <span className="text-red-500">*</span></label>
                        <input
                          type="email"
                          required
                          placeholder="staff@pharmacy.com"
                          value={empForm.email}
                          onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-gray-700 block mb-1">Password <span className="text-red-500">*</span></label>
                        <input
                          type="password"
                          required
                          minLength="6"
                          placeholder="Min 6 characters"
                          value={empForm.password}
                          onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-gray-700 block mb-1">Phone Number</label>
                      <input
                        type="text"
                        placeholder="+92 300 1234567"
                        value={empForm.phone}
                        onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-gray-700 block mb-1">System Role</label>
                      <select
                        value={empForm.role}
                        onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="STAFF">STAFF (Cashier / Pharmacist)</option>
                        <option value="BUSINESS_OWNER">BUSINESS_OWNER</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* HR Details */}
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Job Designation <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Senior Pharmacist"
                      value={empForm.designation}
                      onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Department</label>
                    <input
                      type="text"
                      placeholder="e.g. Pharmacy, Dispensing"
                      value={empForm.department}
                      onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Monthly Base Salary (PKR) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="100"
                      placeholder="e.g. 45000"
                      value={empForm.salary}
                      onChange={(e) => setEmpForm({ ...empForm, salary: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Joining Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      required
                      value={empForm.joiningDate}
                      onChange={(e) => setEmpForm({ ...empForm, joiningDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Employment Status</label>
                  <select
                    value={empForm.employmentStatus}
                    onChange={(e) => setEmpForm({ ...empForm, employmentStatus: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEmployeeModalOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveEmployeeMutation.isLoading}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:bg-gray-400 flex items-center gap-1.5"
                >
                  {saveEmployeeMutation.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingEmployee ? 'Update Profile' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Salary as Paid Modal */}
      {payModalOpen && selectedSalary && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                <CreditCard className="w-5 h-5 text-green-600" />
                Process Salary Payment
              </h3>
              <button onClick={() => setPayModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs">
              <p className="font-bold text-blue-900">{selectedSalary.employeeName}</p>
              <p className="text-blue-700">Period: {monthNames[selectedSalary.month - 1]} {selectedSalary.year}</p>
              <p className="text-base font-black text-blue-900 mt-1">Amount: PKR {selectedSalary.netSalary.toFixed(2)}</p>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Payment Method <span className="text-red-500">*</span></label>
                <select
                  value={payForm.paymentMethod}
                  onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white font-semibold"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="JazzCash">JazzCash</option>
                  <option value="EasyPaisa">EasyPaisa</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Payment Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  value={payForm.paymentDate}
                  onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Transaction Ref / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Txn # 981248 / HBL Transfer"
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={markAsPaidMutation.isLoading}
                  className="px-5 py-2 font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm disabled:bg-gray-400 flex items-center gap-1.5"
                >
                  {markAsPaidMutation.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Payslip Modal */}
      {payslipModalOpen && selectedPayslip && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                Employee Payslip
              </h3>
              <button onClick={() => setPayslipModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs font-mono space-y-3">
              <div className="text-center pb-2 border-b border-gray-300">
                <h2 className="text-sm font-bold uppercase text-gray-900">SALARY SLIP</h2>
                <p className="text-gray-600">{monthNames[selectedPayslip.month - 1]} {selectedPayslip.year}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-gray-500 block">Employee:</span>
                  <span className="font-bold text-gray-900">{selectedPayslip.employeeName}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Designation:</span>
                  <span className="font-bold text-gray-900">{selectedPayslip.designation}</span>
                </div>
              </div>

              <div className="border-t border-b border-gray-300 py-2 space-y-1">
                <div className="flex justify-between">
                  <span>Basic Salary:</span>
                  <span className="font-bold">PKR {selectedPayslip.basicSalary.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-700">
                  <span>Allowances:</span>
                  <span>+ PKR {selectedPayslip.allowances.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-700">
                  <span>Deductions:</span>
                  <span>- PKR {selectedPayslip.deductions.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between font-bold text-sm text-gray-900 pt-1">
                <span>NET SALARY:</span>
                <span>PKR {selectedPayslip.netSalary.toFixed(2)}</span>
              </div>

              <div className="text-[10px] text-gray-500 pt-2 border-t border-gray-200 flex justify-between">
                <span>Status: {selectedPayslip.paymentStatus}</span>
                <span>Method: {selectedPayslip.paymentMethod || 'N/A'}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print Payslip
              </button>
              <button
                onClick={() => setPayslipModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
