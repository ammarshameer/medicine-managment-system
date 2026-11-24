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
import { useCurrency } from '../utils/formatCurrency';
import { useTranslation } from '../i18n';

export const HRMS = () => {
  const { t } = useTranslation();
const { currency, format } = useCurrency();
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
  // eslint-disable-next-line no-unused-vars
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
        ...(empForm.password ? { password: empForm.password } : {}),
        designation: empForm.designation,
        department: empForm.department,
        joiningDate: empForm.joiningDate,
        salary: parseFloat(empForm.salary) || 0,
        employmentStatus: empForm.employmentStatus
      });
    }
  };

  // eslint-disable-next-line no-unused-vars
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
            {t('Human Resources & Payroll (HRMS)')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Confidential employee directory, designations, and monthly salary disbursement')}
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
            {t('Employees (')}{employees.length})
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'payroll'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <DollarSign className="w-4 h-4" />
            {t('Monthly Payroll')}
          </button>
        </div>
      </div>

      {/* TAB 1: EMPLOYEES DIRECTORY */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          {/* Action bar */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('Search employee name, role, designation...')}
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="w-full ps-9 pe-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={employeeStatusFilter}
                onChange={(e) => setEmployeeStatusFilter(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t('All Statuses')}</option>
                <option value="Active">{t('Active')}</option>
                <option value="Inactive">{t('Inactive')}</option>
                <option value="On Leave">{t('On Leave')}</option>
                <option value="Terminated">{t('Terminated')}</option>
              </select>

              <button
                onClick={openAddEmployeeModal}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4 me-1.5" />
                {t('Add Employee')}
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
                <p className="text-base font-semibold">{t('No employees found')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('Add staff pharmacists and cashiers to manage roles and salaries')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-start text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                    <tr>
                      <th className="px-6 py-3">{t('Employee Name')}</th>
                      <th className="px-6 py-3">{t('Designation & Dept')}</th>
                      <th className="px-6 py-3">{t('System Role')}</th>
                      <th className="px-6 py-3">{t('Base Salary')}</th>
                      <th className="px-6 py-3">{t('Joining Date')}</th>
                      <th className="px-6 py-3">{t('Status')}</th>
                      <th className="px-6 py-3 text-end">{t('Actions')}</th>
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
                          {format(emp.salary)}
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
                        <td className="px-6 py-4 text-end gap-2">
                          <button
                            onClick={() => openEditEmployeeModal(emp)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t('Edit Profile')}
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
                              title={t('Deactivate')}
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
                <span className="text-xs font-bold text-gray-700">{t('Month:')}</span>
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
                <span className="text-xs font-bold text-gray-700">{t('Year:')}</span>
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
                <option value="all">{t('All Payment Statuses')}</option>
                <option value="Pending">{t('Pending')}</option>
                <option value="Paid">{t('Paid')}</option>
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
                {batchGeneratePayrollMutation.isLoading ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 me-1.5" />}
                {t('Generate')} {monthNames[selectedMonth - 1]} {t('Payroll')}
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
                <Plus className="w-3.5 h-3.5 me-1" />
                {t('Custom Slip')}
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
                <p className="text-base font-semibold">{t('No payroll records for')} {monthNames[selectedMonth - 1]} {selectedYear}</p>
                <p className="text-xs text-gray-400 mt-1">{t('Click "Generate Payroll" to automatically create salary slips for all active employees')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-start text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                    <tr>
                      <th className="px-6 py-3">{t('Employee')}</th>
                      <th className="px-6 py-3">{t('Period')}</th>
                      <th className="px-6 py-3">{t('Basic Salary')}</th>
                      <th className="px-6 py-3">{t('Allowances / Deductions')}</th>
                      <th className="px-6 py-3">{t('Net Payable')}</th>
                      <th className="px-6 py-3">{t('Status')}</th>
                      <th className="px-6 py-3 text-end">{t('Actions')}</th>
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
                          {format(sal.basicSalary)}
                        </td>
                        <td className="px-6 py-4 text-xs space-y-0.5">
                          {sal.allowances > 0 && <span className="text-green-600 block">+{format(sal.allowances)} {t('(Allow)')}</span>}
                          {sal.deductions > 0 && <span className="text-red-600 block">-{format(sal.deductions)} {t('(Deduct)')}</span>}
                          {sal.allowances === 0 && sal.deductions === 0 && <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-6 py-4 font-bold font-mono text-blue-900">
                          {format(sal.netSalary)}
                        </td>
                        <td className="px-6 py-4">
                          {sal.paymentStatus === 'Paid' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              <CheckCircle2 className="w-3.5 h-3.5 me-1 text-green-600" />
                              {t('Paid (')}{sal.paymentMethod})
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              <Clock className="w-3.5 h-3.5 me-1 text-amber-600" />
                              {t('Pending')}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-end gap-2">
                          <button
                            onClick={() => openPayslipModal(sal)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t('Print Payslip')}
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {sal.paymentStatus === 'Pending' && (
                            <button
                              onClick={() => openPayModal(sal)}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors inline-flex items-center gap-1 shadow-sm"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              {t('Mark Paid')}
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
                {editingEmployee ? t('Edit Employee Profile') : t('Add Employee')}
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
                  {t('Create New Account')}
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('link_existing')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${addMode === 'link_existing' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
                    }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  {t('Link Existing User')}
                </button>
              </div>
            )}

            <form onSubmit={handleEmpSubmit} className="space-y-3 text-xs">
              {/* If Link Existing User Mode */}
              {!editingEmployee && addMode === 'link_existing' ? (
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">
                    {t('Select Registered User')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={empForm.userId}
                    onChange={(e) => setEmpForm({ ...empForm, userId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">{t('-- Choose User without Employee Profile --')}</option>
                    {unlinkedUsersData?.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}{t(') - Current Role:')} {u.role}
                      </option>
                    ))}
                  </select>
                  {unlinkedUsersData?.length === 0 && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      {t('No unlinked users found. Switch to "Create New Account" to register a new employee.')}
                    </p>
                  )}
                </div>
              ) : (
                /* New User Fields */
                <div className="space-y-3">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">{t('Full Name')} <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder={t('e.g. Asim Raza')}
                      value={empForm.name}
                      onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {!editingEmployee ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-gray-700 block mb-1">{t('Email')} <span className="text-red-500">*</span></label>
                        <input
                          type="email"
                          required
                          placeholder={t('staff@pharmacy.com')}
                          value={empForm.email}
                          onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-gray-700 block mb-1">{t('Password / PIN')} <span className="text-red-500">*</span></label>
                        <input
                          type="password"
                          required
                          minLength="4"
                          placeholder={t('Min 4 digits / PIN')}
                          value={empForm.password}
                          onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="font-semibold text-gray-700 block mb-1">
                        {t('Reset Password / 4-Digit PIN')} <span className="text-gray-400 font-normal">{t('(Leave blank to keep unchanged)')}</span>
                      </label>
                      <input
                        type="password"
                        minLength="4"
                        placeholder={t('Enter new 4+ digit PIN / password')}
                        value={empForm.password}
                        onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-gray-700 block mb-1">{t('Phone Number')}</label>
                      <input
                        type="text"
                        placeholder="+92 300 1234567"
                        value={empForm.phone}
                        onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-gray-700 block mb-1">{t('System Role')}</label>
                      <select
                        value={empForm.role}
                        onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="STAFF">{t('STAFF (Cashier / Pharmacist)')}</option>
                        <option value="BUSINESS_OWNER">{t('BUSINESS_OWNER')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* HR Details */}
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">{t('Job Designation')} <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder={t('e.g. Senior Pharmacist')}
                      value={empForm.designation}
                      onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">{t('Department')}</label>
                    <input
                      type="text"
                      placeholder={t('e.g. Pharmacy, Dispensing')}
                      value={empForm.department}
                      onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">{t('Monthly Base Salary (')}{currency}) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      placeholder={t('e.g. 5000')}
                      value={empForm.salary}
                      onChange={(e) => setEmpForm({ ...empForm, salary: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">{t('Joining Date')} <span className="text-red-500">*</span></label>
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
                  <label className="font-semibold text-gray-700 block mb-1">{t('Employment Status')}</label>
                  <select
                    value={empForm.employmentStatus}
                    onChange={(e) => setEmpForm({ ...empForm, employmentStatus: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Active">{t('Active')}</option>
                    <option value="On Leave">{t('On Leave')}</option>
                    <option value="Inactive">{t('Inactive')}</option>
                    <option value="Terminated">{t('Terminated')}</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEmployeeModalOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saveEmployeeMutation.isLoading}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:bg-gray-400 flex items-center gap-1.5"
                >
                  {saveEmployeeMutation.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingEmployee ? t('Update Profile') : t('Save Employee')}
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
                {t('Process Salary Payment')}
              </h3>
              <button onClick={() => setPayModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs">
              <p className="font-bold text-blue-900">{selectedSalary.employeeName}</p>
              <p className="text-blue-700">{t('Period:')} {monthNames[selectedSalary.month - 1]} {selectedSalary.year}</p>
              <p className="text-base font-black text-blue-900 mt-1">{t('Amount:')} {format(selectedSalary.netSalary)}</p>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">{t('Payment Method')} <span className="text-red-500">*</span></label>
                <select
                  value={payForm.paymentMethod}
                  onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white font-semibold"
                >
                  <option value="Bank Transfer">{t('Bank Transfer')}</option>
                  <option value="Cash">{t('Cash')}</option>
                  <option value="Cheque">{t('Cheque')}</option>
                  <option value="JazzCash">{t('JazzCash')}</option>
                  <option value="EasyPaisa">{t('EasyPaisa')}</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">{t('Payment Date')} <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  value={payForm.paymentDate}
                  onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">{t('Transaction Ref / Notes')}</label>
                <input
                  type="text"
                  placeholder={t('e.g. Txn # 981248 / Bank Transfer')}
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
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={markAsPaidMutation.isLoading}
                  className="px-5 py-2 font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm disabled:bg-gray-400 flex items-center gap-1.5"
                >
                  {markAsPaidMutation.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('Confirm Payment')}
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
                {t('Employee Payslip')}
              </h3>
              <button onClick={() => setPayslipModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs font-mono space-y-3">
              <div className="text-center pb-2 border-b border-gray-300">
                <h2 className="text-sm font-bold uppercase text-gray-900">{t('SALARY SLIP')}</h2>
                <p className="text-gray-600">{monthNames[selectedPayslip.month - 1]} {selectedPayslip.year}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-gray-500 block">{t('Employee:')}</span>
                  <span className="font-bold text-gray-900">{selectedPayslip.employeeName}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t('Designation:')}</span>
                  <span className="font-bold text-gray-900">{selectedPayslip.designation}</span>
                </div>
              </div>

              <div className="border-t border-b border-gray-300 py-2 space-y-1">
                <div className="flex justify-between">
                  <span>{t('Basic Salary:')}</span>
                  <span className="font-bold">{format(selectedPayslip.basicSalary)}</span>
                </div>
                <div className="flex justify-between text-green-700">
                  <span>{t('Allowances:')}</span>
                  <span>+ {format(selectedPayslip.allowances)}</span>
                </div>
                <div className="flex justify-between text-red-700">
                  <span>{t('Deductions:')}</span>
                  <span>- {format(selectedPayslip.deductions)}</span>
                </div>
              </div>

              <div className="flex justify-between font-bold text-sm text-gray-900 pt-1">
                <span>{t('NET SALARY:')}</span>
                <span>{format(selectedPayslip.netSalary)}</span>
              </div>

              <div className="text-[10px] text-gray-500 pt-2 border-t border-gray-200 flex justify-between">
                <span>{t('Status:')} {selectedPayslip.paymentStatus}</span>
                <span>{t('Method:')} {selectedPayslip.paymentMethod || t('N/A')}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                {t('Print Payslip')}
              </button>
              <button
                onClick={() => setPayslipModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-xs"
              >
                {t('Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
