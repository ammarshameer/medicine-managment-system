import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = 'mmsLanguage';
const DEFAULT_LANGUAGE = 'en';

const translations = {
  en: {
    hello: 'Hello',
    howCanWeHelp: 'How can we help you today?',
    searchMedicines: 'Search medicines...',
    categories: 'Categories',
    featuredMedicines: 'Featured Medicines',
    seeAll: 'See All',
    uploadPrescription: 'Upload Prescription',
    prescriptionSubtitle: 'Get medicines prescribed by your doctor',
    medicines: 'Medicines',
    allMedicines: 'All Medicines',
    categoryItems: 'Category Items',
    all: 'All',
    search: 'Search',
    loading: 'Loading...',
    loadingMedicines: 'Loading medicines...',
    loadFailed: 'Unable to load medicines. Please try again.',
    retry: 'Retry',
    noMedicines: 'No medicines found',
    noMedicinesHint: 'Try a different search or category.',
    inStock: 'In Stock',
    lowStock: 'Low Stock',
    outOfStock: 'Out of Stock',
    stock: 'Stock',
    addToCart: 'Add to Cart',
    medicineDetails: 'Medicine Details',
    description: 'Description',
    productDetails: 'Product Details',
    manufacturer: 'Manufacturer',
    category: 'Category',
    quantity: 'Quantity',
    requiresPrescription: 'Requires a prescription',
    prescriptionRequired: 'Prescription required',
    deaSchedule: 'DEA Schedule',
    uaeClassification: 'UAE Classification',
    taxable: 'Taxable',
    taxIncluded: 'Price includes tax',
    notAvailable: 'Not available',
    success: 'Success',
    addedToCart: 'Added to cart!',
    orderHistory: 'Order History',
    prescriptions: 'Prescriptions',
    helpSupport: 'Help & Support',
    logout: 'Log Out',
    logoutConfirm: 'Are you sure you want to logout?',
    cancel: 'Cancel',
    language: 'Language',
    languageNote: 'Layout direction updated. A full app restart may be needed to apply RTL changes.',
    languageUpdated: 'Language updated',
    assignedPharmacy: 'Assigned Pharmacy',
    pharmacistInCharge: 'Pharmacist-In-Charge:',
    pharmacyLicense: 'Pharmacy License #:',
    taxId: 'Tax ID / TRN:',
    patient: 'Patient',
    myOrders: 'My Orders',
    shoppingCart: 'Shopping Cart',
    cartEmpty: 'Your cart is empty',
    browseMedicines: 'Browse Medicines',
    proceedCheckout: 'Proceed to Checkout',
  },
  ar: {
    hello: 'مرحباً',
    howCanWeHelp: 'كيف يمكننا مساعدتك اليوم؟',
    searchMedicines: 'ابحث عن الأدوية...',
    categories: 'الفئات',
    featuredMedicines: 'الأدوية المميزة',
    seeAll: 'عرض الكل',
    uploadPrescription: 'رفع الوصفة الطبية',
    prescriptionSubtitle: 'احصل على الأدوية التي وصفها طبيبك',
    medicines: 'الأدوية',
    allMedicines: 'كل الأدوية',
    categoryItems: 'منتجات الفئة',
    all: 'الكل',
    search: 'بحث',
    loading: 'جارٍ التحميل...',
    loadingMedicines: 'جارٍ تحميل الأدوية...',
    loadFailed: 'تعذر تحميل الأدوية. يرجى المحاولة مرة أخرى.',
    retry: 'إعادة المحاولة',
    noMedicines: 'لم يتم العثور على أدوية',
    noMedicinesHint: 'جرّب بحثاً أو فئة مختلفة.',
    inStock: 'متوفر',
    lowStock: 'كمية قليلة',
    outOfStock: 'غير متوفر',
    stock: 'المخزون',
    addToCart: 'أضف إلى السلة',
    medicineDetails: 'تفاصيل الدواء',
    description: 'الوصف',
    productDetails: 'تفاصيل المنتج',
    manufacturer: 'الشركة المصنعة',
    category: 'الفئة',
    quantity: 'الكمية',
    requiresPrescription: 'يتطلب وصفة طبية',
    prescriptionRequired: 'وصفة طبية مطلوبة',
    deaSchedule: 'جدول DEA',
    uaeClassification: 'تصنيف الإمارات',
    taxable: 'خاضع للضريبة',
    taxIncluded: 'السعر يشمل الضريبة',
    notAvailable: 'غير متوفر',
    success: 'نجاح',
    addedToCart: 'تمت الإضافة إلى السلة!',
    orderHistory: 'سجل الطلبات',
    prescriptions: 'الوصفات الطبية',
    helpSupport: 'المساعدة والدعم',
    logout: 'تسجيل الخروج',
    logoutConfirm: 'هل أنت متأكد من تسجيل الخروج؟',
    cancel: 'إلغاء',
    language: 'اللغة',
    languageNote: 'تم تحديث اتجاه التخطيط. قد يلزم إعادة تشغيل التطبيق بالكامل لتطبيق تغييرات RTL.',
    languageUpdated: 'تم تحديث اللغة',
    assignedPharmacy: 'الصيدلية المعينة',
    pharmacistInCharge: 'الصيدلي المسؤول:',
    pharmacyLicense: 'رقم رخصة الصيدلية:',
    taxId: 'رقم الضريبة / TRN:',
    patient: 'المريض',
    myOrders: 'طلباتي',
    shoppingCart: 'سلة التسوق',
    cartEmpty: 'سلة التسوق فارغة',
    browseMedicines: 'تصفح الأدوية',
    proceedCheckout: 'المتابعة إلى الدفع',
  },
};

const I18nContext = createContext();

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

export const I18nProvider = ({ children }) => {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    const loadLanguage = async () => {
      let stored = null;
      try {
        stored = await AsyncStorage.getItem(LANGUAGE_KEY);
      } catch (error) {
        console.error('Error loading language:', error);
      }
      const initial = stored === 'ar' ? 'ar' : DEFAULT_LANGUAGE;
      setLanguageState(initial);
      // I18nManager only mirrors native layouts; a full reload may be needed
      // for already-mounted screens and custom RTL styles.
      I18nManager.forceRTL(initial === 'ar');
    };

    loadLanguage();
  }, []);

  const setLanguage = useCallback((nextLanguage) => {
    const next = nextLanguage === 'ar' ? 'ar' : 'en';
    I18nManager.forceRTL(next === 'ar');
    setLanguageState(next);
    AsyncStorage.setItem(LANGUAGE_KEY, next).catch((error) => {
      console.error('Error saving language:', error);
    });
  }, []);

  const t = useCallback((key) => (
    translations[language]?.[key] || translations.en[key] || key
  ), [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  }, [language, setLanguage]);

  const value = {
    language,
    isRTL: language === 'ar',
    t,
    setLanguage,
    toggleLanguage,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export default I18nContext;
