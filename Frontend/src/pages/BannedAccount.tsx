import { AlertTriangle, LogOut } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const BannedAccount: React.FC = () => {
  const { banReason, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">{t('banned.title')}</h1>
          <p className="text-gray-500">{t('banned.description')}</p>
        </div>

        {banReason && (
          <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-left">
            <p className="text-sm font-medium text-red-800">{t('banned.reason')}</p>
            <p className="text-sm text-red-700 mt-1">{banReason}</p>
          </div>
        )}

        <div className="pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500 mb-6">{t('banned.contact')}</p>

          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('banned.signOut')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BannedAccount;
