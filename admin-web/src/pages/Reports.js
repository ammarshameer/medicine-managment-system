import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import {
  BarChart3,
  DollarSign,
  ShoppingCart,
  Loader2
} from 'lucide-react';
import { useCurrency } from '../utils/formatCurrency';

const isoStart = (d) => `${d}T00:00:00`;
const isoEnd = (d) => `${d}T23:59:59`;

const defaultStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};
const defaultEnd = () => new Date().toISOString().slice(0, 10);

export const Reports = () => {
  const { format, currency } = useCurrency();
  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(defaultEnd());
  const [range, setRange] = useState({ start: defaultStart(), end: defaultEnd() });

  const { data, isLoading, isError } = useQuery(
    ['sales-report', range.start, range.end],
    () => {
      const params = new URLSearchParams({
        startDate: isoStart(range.start),
        endDate: isoEnd(range.end)
      });
      return axios.get(`/api/admin/reports/sales?${params}`).then(res => res.data.data);
    }
  );

  const applyRange = (e) => {
    e.preventDefault();
    setRange({ start: startDate, end: endDate });
  };

  const salesByDate = data?.salesByDate || [];
  const topMedicines = data?.topMedicines || [];
  const salesByCategory = data?.salesByCategory || [];
  const totalRevenue = salesByDate.reduce((sum, d) => sum + (d.revenue || 0), 0);
  const totalOrders = salesByDate.reduce((sum, d) => sum + (d.orders || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-600">Sales analytics for delivered orders ({currency})</p>
      </div>

      <form onSubmit={applyRange} className="bg-white shadow rounded-lg p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Apply
        </button>
      </form>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : isError ? (
        <div className="bg-white shadow rounded-lg p-6 text-center text-red-600">
          Failed to load report. Please adjust the date range and try again.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Net Revenue</p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">{format(totalRevenue)}</p>
              </div>
              <div className="p-3 bg-yellow-500 rounded-full">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">{totalOrders}</p>
              </div>
              <div className="p-3 bg-green-500 rounded-full">
                <ShoppingCart className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Top Selling Medicines</h3>
            {topMedicines.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No sales in this period.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Units Sold</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topMedicines.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{m.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{m.sold}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{format(m.revenue || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Sales by Category</h3>
            {salesByCategory.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No category sales in this period.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {salesByCategory.map((c) => (
                    <tr key={c.category}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{c.category}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{c.items}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{format(c.revenue || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {salesByDate.length === 0 && (
            <div className="bg-white shadow rounded-lg p-6 flex items-center justify-center text-gray-500">
              <BarChart3 className="h-5 w-5 mr-2" /> No delivered orders in the selected period.
            </div>
          )}
        </>
      )}
    </div>
  );
};
