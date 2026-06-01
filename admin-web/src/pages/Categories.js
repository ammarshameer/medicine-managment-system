import React from 'react';
import { Tag } from 'lucide-react';

export const Categories = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Categories</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage medicine categories
        </p>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Tag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Category Management</h3>
            <p className="text-sm text-gray-500">
              Category management page will be implemented with full CRUD functionality
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
