import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  ShieldAlert,
  User,
  Pill,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useTranslation } from '../i18n';

export const Compliance = () => {
  const { t } = useTranslation();
const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 15,
        ...(actionFilter && { action: actionFilter }),
        ...(startDate && endDate && { startDate, endDate })
      };
      const res = await axios.get('/api/admin/compliance/controlled-logs', { params });
      if (res.data.success) {
        setLogs(res.data.data.logs || []);
        setTotalPages(res.data.data.pagination?.pages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch controlled logs:', error);
      toast.error('Failed to load compliance audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadgeClass = (action) => {
    switch (action) {
      case 'Dispensed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Received':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Adjusted':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Destroyed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('Controlled Substances Audit Log')}</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {t('Regulatory Strict')}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {t('Complete chain-of-custody audit trail for Schedule II-V (US DEA) and Controlled/Narcotic (UAE MOHAP) medicines.')}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('Action Type')}</label>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="rounded-lg border-gray-300 text-xs py-1.5 focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">{t('All Actions')}</option>
              <option value="Dispensed">{t('Dispensed (POS / Online)')}</option>
              <option value="Received">{t('Received (Purchase Order)')}</option>
              <option value="Adjusted">{t('Adjusted (Inventory)')}</option>
              <option value="Destroyed">{t('Destroyed / Expired')}</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('Start Date')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border-gray-300 text-xs py-1.5 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('End Date')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border-gray-300 text-xs py-1.5 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {(actionFilter || startDate || endDate) && (
            <button
              onClick={() => { setActionFilter(''); setStartDate(''); setEndDate(''); setPage(1); }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium self-end mb-1"
            >
              {t('Clear Filters')}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <ShieldAlert className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">{t('No compliance logs found')}</h3>
            <p className="mt-1 text-xs text-gray-500">
              {t('Controlled substance dispensation and adjustments will be automatically recorded here.')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-start text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Timestamp')}</th>
                  <th className="px-6 py-3 text-start text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Medicine & Classification')}</th>
                  <th className="px-6 py-3 text-start text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Action')}</th>
                  <th className="px-6 py-3 text-start text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Qty')}</th>
                  <th className="px-6 py-3 text-start text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Authorized Performer')}</th>
                  <th className="px-6 py-3 text-start text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Reference / Notes')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Pill className="w-4 h-4 text-gray-400" />
                        <div>
                          <span className="text-sm font-bold text-gray-900 block">{log.medicineName}</span>
                          <div className="flex gap-1 mt-0.5">
                            {log.deaSchedule && log.deaSchedule !== 'None' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                                {t('DEA Sched')} {log.deaSchedule}
                              </span>
                            )}
                            {log.uaeClassification && log.uaeClassification !== 'OTC' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                {t('UAE')} {log.uaeClassification}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getActionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {log.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-semibold text-gray-900">{log.performedBy?.name}</span>
                        <span className="text-gray-400 text-[11px]">({log.performedBy?.role})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 max-w-xs truncate">
                      {log.orderId && <span className="font-semibold text-blue-600 me-2">{t('Order #')}{log.orderId}</span>}
                      {log.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {t('Page')} {page} {t('of')} {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded border border-gray-300 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded border border-gray-300 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Compliance;
