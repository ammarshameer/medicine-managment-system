import React, { createContext, useContext, useState, useEffect } from 'react';

export const translations = {
  en: {
    dashboard: 'Dashboard',
    pos: 'POS Counter',
    medicines: 'Medicines',
    orders: 'Orders',
    inventory: 'Inventory',
    prescriptions: 'Prescriptions',
    settings: 'Settings',
    compliance: 'Compliance Logs',
    subtotal: 'Subtotal',
    tax: 'Sales Tax',
    vat: 'VAT (5%)',
    total: 'Total',
    checkout: 'Complete Sale',
    pharmacistInCharge: 'Pharmacist-in-Charge',
    taxRegistrationNumber: 'TRN / Tax ID',
    licenseNumber: 'License Number'
  },
  ar: {
    dashboard: 'لوحة التحكم',
    pos: 'نقطة البيع',
    medicines: 'الأدوية',
    orders: 'الطلبات',
    inventory: 'المخزون',
    prescriptions: 'الوصفات الطبية',
    settings: 'الإعدادات',
    compliance: 'سجلات الامتثال',
    subtotal: 'المجموع الفرعي',
    tax: 'ضريبة المبيعات',
    vat: 'ضريبة القيمة المضافة (5%)',
    total: 'الإجمالي',
    checkout: 'إتمام البيع',
    pharmacistInCharge: 'الصيدلي المسؤول',
    taxRegistrationNumber: 'الرقم الضريبي',
    licenseNumber: 'رقم الترخيص'
  }
};

const I18nContext = createContext();

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState(localStorage.getItem('mms_lang') || 'en');

  useEffect(() => {
    localStorage.setItem('mms_lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key) => {
    return translations[lang]?.[key] || translations.en[key] || key;
  };

  const isRTL = lang === 'ar';

  return (
    <I18nContext.Provider value={{ lang, setLang, t, isRTL }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      lang: 'en',
      setLang: () => {},
      t: (k) => translations.en[k] || k,
      isRTL: false
    };
  }
  return context;
};

export default translations;
