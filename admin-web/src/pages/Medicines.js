import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  AlertTriangle,
  Package,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

import { useCurrency } from '../utils/formatCurrency';
import { useTranslation } from '../i18n';

const emptyForm = {
  name: '',
  categoryId: '',
  description: '',
  price: '',
  stock: '',
  expiryDate: '',
  manufacturer: '',
  requiresPrescription: false,
  deaSchedule: 'None',
  uaeClassification: 'OTC',
  isTaxable: true,
  priceIncludesTax: false
};

export const Medicines = () => {
  const { t } = useTranslation();
const { format } = useCurrency();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const queryClient = useQueryClient();

  const { data: medicinesData, isLoading } = useQuery(
    ['medicines', page, limit, search, category],
    () => {
      const params = new URLSearchParams({
        page,
        limit,
        ...(search && { search }),
        ...(category && category !== 'All Categories' && { category })
      });
      return axios.get(`/api/medicines?${params}`).then(res => res.data.data);
    }
  );

  const { data: categoriesData } = useQuery(
    'categories',
    () => axios.get('/api/categories').then(res => res.data.data.categories),
    { enabled: true }
  );

  const deleteMutation = useMutation(
    (medicineId) => axios.delete(`/api/medicines/${medicineId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('medicines');
        setShowDeleteModal(false);
        setSelectedMedicine(null);
      }
    }
  );

  const saveMutation = useMutation(
    (payload) => {
      const body = {
        name: payload.name.trim(),
        price: parseFloat(payload.price),
        stock: parseInt(payload.stock, 10),
        requiresPrescription: !!payload.requiresPrescription,
        deaSchedule: payload.deaSchedule || 'None',
        uaeClassification: payload.uaeClassification || 'OTC',
        isTaxable: payload.isTaxable !== false,
        priceIncludesTax: Boolean(payload.priceIncludesTax),
        ...(payload.description && { description: payload.description }),
        ...(payload.manufacturer && { manufacturer: payload.manufacturer }),
        ...(payload.categoryId && { categoryId: parseInt(payload.categoryId, 10) }),
        ...(payload.expiryDate && { expiryDate: new Date(payload.expiryDate).toISOString() })
      };
      return editingMedicine
        ? axios.put(`/api/medicines/${editingMedicine.id}`, body)
        : axios.post('/api/medicines', body);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('medicines');
        toast.success(editingMedicine ? 'Medicine updated' : 'Medicine created');
        closeFormModal();
      },
      onError: (err) => {
        toast.error(err?.response?.data?.message || 'Failed to save medicine');
      }
    }
  );

  const handleDelete = () => {
    if (selectedMedicine) {
      deleteMutation.mutate(selectedMedicine.id);
    }
  };

  const openAddModal = () => {
    setEditingMedicine(null);
    setFormData(emptyForm);
    setShowFormModal(true);
  };

  const openEditModal = (medicine) => {
    setEditingMedicine(medicine);
    setFormData({
      name: medicine.name || '',
      categoryId: medicine.category?.id ? String(medicine.category.id) : '',
      description: medicine.description || '',
      price: medicine.price != null ? String(medicine.price) : '',
      stock: medicine.stock != null ? String(medicine.stock) : '',
      expiryDate: medicine.expiryDate ? medicine.expiryDate.slice(0, 10) : '',
      manufacturer: medicine.manufacturer || '',
      requiresPrescription: !!medicine.requiresPrescription,
      deaSchedule: medicine.deaSchedule || 'None',
      uaeClassification: medicine.uaeClassification || 'OTC',
      isTaxable: medicine.isTaxable !== false,
      priceIncludesTax: Boolean(medicine.priceIncludesTax)
    });
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingMedicine(null);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || formData.name.trim().length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }
    if (formData.price === '' || isNaN(parseFloat(formData.price)) || parseFloat(formData.price) < 0) {
      toast.error('Enter a valid price');
      return;
    }
    if (formData.stock === '' || isNaN(parseInt(formData.stock, 10)) || parseInt(formData.stock, 10) < 0) {
      toast.error('Enter a valid stock quantity');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const medicines = medicinesData?.medicines || [];
  const pagination = medicinesData?.pagination || { total: 0, pages: 0 };
  const categoryOptions = categoriesData || [];
  const categories = ['All Categories', ...categoryOptions.map(c => c.name)];
  const lowStockCount = medicines.filter(m => m.stock < 10).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('Medicine Management')}</h1>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 me-2" />
          {t('Add New Medicine')}
        </button>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white shadow rounded-lg p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('Search medicines...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-10 pe-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All Categories' ? t('Filter by Category') : cat}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {t('Search')}
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategory('');
              setPage(1);
            }}
            className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            {t('Clear')}
          </button>
          <button
            type="button"
            onClick={() => setCategory('')}
            className="flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
          >
            <AlertTriangle className="h-4 w-4 me-2" />
            {t('Low Stock (')}{lowStockCount})
          </button>
        </form>
      </div>

      {/* Medicine List Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('Image')}
                </th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('Name')}
                </th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('Category')}
                </th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('Price')}
                </th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('Stock')}
                </th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('Expiry Date')}
                </th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {medicines.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    {t('No medicines found')}
                  </td>
                </tr>
              ) : (
                medicines.map((medicine) => (
                  <tr key={medicine.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {medicine.imagePath ? (
                        <img
                          src={medicine.imagePath}
                          alt={medicine.name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center">
                          <Package className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{medicine.name}</div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {medicine.deaSchedule && medicine.deaSchedule !== 'None' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                            {t('DEA Sched')} {medicine.deaSchedule}
                          </span>
                        )}
                        {medicine.uaeClassification && medicine.uaeClassification !== 'OTC' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            {t('UAE')} {medicine.uaeClassification}
                          </span>
                        )}
                        {medicine.isTaxable === false && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800">
                            {t('Exempt')}
                          </span>
                        )}
                        {medicine.priceIncludesTax && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                            {t('Tax-Inclusive')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {medicine.category?.name || t('N/A')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {format(medicine.price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        medicine.stock < 10 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {medicine.stock}
                        {medicine.stock < 10 && t('(Low)')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {medicine.expiryDate ? new Date(medicine.expiryDate).toLocaleDateString() : t('N/A')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEditModal(medicine)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedMedicine(medicine);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-white px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {t('Previous')}
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="ms-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {t('Next')}
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  {t('Showing')} <span className="font-medium">{(page - 1) * limit + 1}</span> {t('to')}{' '}
                  <span className="font-medium">{Math.min(page * limit, pagination.total)}</span> {t('of')}{' '}
                  <span className="font-medium">{pagination.total}</span> {t('results')}
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm gap-0">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-s-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
const pageNum = Math.max(1, page - 2) + i;
                    if (pageNum > pagination.pages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          page === pageNum
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="relative inline-flex items-center px-2 py-2 rounded-e-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Medicine Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">
                {editingMedicine ? t('Edit Medicine') : t('Add New Medicine')}
              </h3>
              <button onClick={closeFormModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Name *')}</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('e.g. Paracetamol 500mg')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Category')}</label>
                <select
                  name="categoryId"
                  value={formData.categoryId}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('Select category')}</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Manufacturer')}</label>
                <input
                  type="text"
                  name="manufacturer"
                  value={formData.manufacturer}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('e.g. MediLab')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Price *')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="price"
                  value={formData.price}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Stock *')}</label>
                <input
                  type="number"
                  min="0"
                  name="stock"
                  value={formData.stock}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Expiry Date')}</label>
                <input
                  type="date"
                  name="expiryDate"
                  value={formData.expiryDate}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Regulatory Classifications */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('US DEA Schedule')}</label>
                <select
                  name="deaSchedule"
                  value={formData.deaSchedule}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="None">{t('None (Unscheduled / OTC / Non-Controlled)')}</option>
                  <option value="I">{t('Schedule I')}</option>
                  <option value="II">{t('Schedule II (e.g. Oxycodone, Adderall)')}</option>
                  <option value="III">{t('Schedule III (e.g. Ketamine, Suboxone)')}</option>
                  <option value="IV">{t('Schedule IV (e.g. Xanax, Valium)')}</option>
                  <option value="V">{t('Schedule V (e.g. Lyrica, Robitussin AC)')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('UAE Classification')}</label>
                <select
                  name="uaeClassification"
                  value={formData.uaeClassification}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="OTC">{t('OTC (Over the Counter)')}</option>
                  <option value="Pharmacist-Only">{t('Pharmacist-Only (Behind the counter)')}</option>
                  <option value="POM">{t('POM (Prescription Only Medicine)')}</option>
                  <option value="Controlled">{t('Controlled (e.g. Morphine, Fentanyl)')}</option>
                  <option value="Semi-Controlled">{t('Semi-Controlled (e.g. Pregabalin)')}</option>
                  <option value="Narcotic">{t('Narcotic')}</option>
                </select>
              </div>

              {/* Tax Settings */}
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isTaxable"
                    checked={formData.isTaxable}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    id="isTaxable"
                  />
                  <label htmlFor="isTaxable" className="ms-2 text-xs font-semibold text-gray-700">
                    {t('Taxable Product')}
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="priceIncludesTax"
                    checked={formData.priceIncludesTax}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    id="priceIncludesTax"
                  />
                  <label htmlFor="priceIncludesTax" className="ms-2 text-xs font-semibold text-gray-700">
                    {t('Price Includes Tax (VAT)')}
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="requiresPrescription"
                    checked={formData.requiresPrescription}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    id="requiresPrescription"
                  />
                  <label htmlFor="requiresPrescription" className="ms-2 text-xs font-semibold text-gray-700">
                    {t('Requires Prescription')}
                  </label>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Description')}</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('Optional description')}
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saveMutation.isLoading ? t('Saving...') : (editingMedicine ? t('Update Medicine') : t('Create Medicine'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedMedicine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{t('Confirm Delete')}</h3>
            <p className="text-gray-600 mb-6">
              {t('Are you sure you want to delete')} <strong>{selectedMedicine.name}</strong>{t('? This action cannot be undone.')}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedMedicine(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                {t('Cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isLoading ? t('Deleting...') : t('Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
