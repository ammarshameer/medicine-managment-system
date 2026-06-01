import React from 'react';
import { Package } from 'lucide-react';

export const Inventory = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage stock levels and inventory transactions
        </p>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Inventory Management</h3>
            <p className="text-sm text-gray-500">
              Inventory management page will be implemented with stock tracking
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
