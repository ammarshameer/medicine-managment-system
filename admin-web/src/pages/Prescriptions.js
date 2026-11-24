import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  FileText,
  Check,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Mail
} from 'lucide-react';
import { useTranslation } from '../i18n';

const statusBadgeClass = (status) => {
  switch (status) {
    case 'Approved':
      return 'bg-green-100 text-green-800';
    case 'Rejected':
      return 'bg-red-100 text-red-800';
    case 'Pending':
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
};

export const Prescriptions = () => {
  const { t } = useTranslation();
const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const { data, isLoading } = useQuery(
    ['prescriptions', page, limit, statusFilter],
    () => {
      const params = new URLSearchParams({
        page,
        limit,
        ...(statusFilter && { status: statusFilter })
      });
      return axios.get(`/api/prescriptions/admin/all?${params}`).then(res => res.data.data);
    }
  );

  const statusMutation = useMutation(
    ({ id, status }) => axios.patch(`/api/prescriptions/${id}/status`, { status }),
    {
      onSuccess: (_res, variables) => {
        queryClient.invalidateQueries('prescriptions');
        toast.success(`Prescription ${variables.status.toLowerCase()}`);
      },
      onError: (err) => {
        toast.error(err?.response?.data?.message || 'Failed to update prescription');
      }
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const prescriptions = data?.prescriptions || [];
  const pagination = data?.pagination || { total: 0, pages: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('Prescriptions')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('Review and approve customer prescriptions')}</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('All statuses')}</option>
          <option value="Pending">{t('Pending')}</option>
          <option value="Approved">{t('Approved')}</option>
          <option value="Rejected">{t('Rejected')}</option>
        </select>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {prescriptions.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('No prescriptions found')}</h3>
              <p className="text-sm text-gray-500">{t('Customer prescription uploads will appear here.')}</p>
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('ID')}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Customer')}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Submitted')}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Status')}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {prescriptions.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{p.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{p.user?.name || t('Unknown')}</div>
                    <div className="text-xs text-gray-500 flex items-center">
                      <Mail className="h-3 w-3 me-1" />{p.user?.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : t('N/A')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {p.status === 'Pending' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => statusMutation.mutate({ id: p.id, status: 'Approved' })}
                          disabled={statusMutation.isLoading}
                          className="flex items-center px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                        >
                          <Check className="h-4 w-4 me-1" /> {t('Approve')}
                        </button>
                        <button
                          onClick={() => statusMutation.mutate({ id: p.id, status: 'Rejected' })}
                          disabled={statusMutation.isLoading}
                          className="flex items-center px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                        >
                          <X className="h-4 w-4 me-1" /> {t('Reject')}
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400">{p.approvedBy ? `by ${p.approvedBy}` : '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {pagination.pages > 1 && (
          <div className="bg-white px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <p className="text-sm text-gray-700">
              {t('Page')} <span className="font-medium">{page}</span> {t('of')} <span className="font-medium">{pagination.pages}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" /> {t('Prev')}
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {t('Next')} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
