import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useI18n } from '../contexts/I18nContext';
import { authHeaders, resolveImageUri } from '../utils/api';
import { useFormatCurrency } from '../utils/formatCurrency';

const CATEGORY_STYLES = [
  { icon: 'healing', color: '#4CAF50' },
  { icon: 'medical-services', color: '#2196F3' },
  { icon: 'spa', color: '#FF9800' },
  { icon: 'air', color: '#9C27B0' },
  { icon: 'favorite', color: '#F44336' },
  { icon: 'eco', color: '#009688' },
];

const categoryStyle = (name, index) => {
  const lower = (name || '').toLowerCase();
  let preset = CATEGORY_STYLES[index % CATEGORY_STYLES.length];

  if (/pain|anti-?inflam/.test(lower)) preset = CATEGORY_STYLES[0];
  else if (/anti?biotic|infection/.test(lower)) preset = CATEGORY_STYLES[1];
  else if (/vitamin|supplement|health/.test(lower)) preset = CATEGORY_STYLES[2];
  else if (/cold|flu|cough|resp/.test(lower)) preset = CATEGORY_STYLES[3];
  else if (/digest|gastro|stomach/.test(lower)) preset = CATEGORY_STYLES[4];
  else if (/aller|skin/.test(lower)) preset = CATEGORY_STYLES[5];

  return preset;
};

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user, token } = useAuth();
  const { getCartItemCount } = useCart();
  const { t } = useI18n();
  const formatMoney = useFormatCurrency();

  const [featured, setFeatured] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [medicineResponse, categoryResponse] = await Promise.all([
        axios.get('/medicines', {
          params: { page: 1, limit: 8, sortBy: 'name', sortOrder: 'asc' },
          headers: authHeaders(token),
        }),
        axios.get('/categories', { headers: authHeaders(token) }),
      ]);
      setFeatured(medicineResponse.data?.data?.medicines || []);
      setCatalogCategories(categoryResponse.data?.data?.categories || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || t('loadFailed'));
      setFeatured([]);
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const MedicineCard = ({ item }) => (
    <TouchableOpacity
      style={styles.medicineCard}
      onPress={() => navigation.navigate('MedicineDetail', { medicine: item })}
    >
      <View style={styles.medicineImage}>
        {item.imagePath ? (
          <Image source={{ uri: resolveImageUri(item.imagePath) }} style={styles.image} />
        ) : (
          <Icon name="medication" size={40} color="#ccc" />
        )}
      </View>
      <Text style={styles.medicineName} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={styles.medicinePrice}>{formatMoney(item.price)}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t('hello')}, {user?.name || t('patient')}!</Text>
          <Text style={styles.subtitle}>{t('howCanWeHelp')}</Text>
        </View>
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => navigation.navigate('Cart')}
        >
          <Icon name="shopping-cart" size={24} color="#1976d2" />
          {getCartItemCount() > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{getCartItemCount()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchSection}>
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => navigation.navigate('Medicines')}
        >
          <Icon name="search" size={20} color="#666" />
          <Text style={styles.searchText}>{t('searchMedicines')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('categories')}</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#1976d2" style={styles.inlineLoader} />
        ) : catalogCategories.length === 0 ? (
          <Text style={styles.emptyText}>{t('noMedicines')}</Text>
        ) : (
          <View style={styles.categoriesContainer}>
            {catalogCategories.map((category, index) => {
              const style = categoryStyle(category.name, index);
              return (
                <TouchableOpacity
                  key={category.id}
                  style={styles.categoryCard}
                  onPress={() => navigation.navigate('Medicines', { categoryId: category.id })}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: style.color }]}>
                    <Icon name={style.icon} size={24} color="#fff" />
                  </View>
                  <Text style={styles.categoryName}>{category.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('featuredMedicines')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Medicines')}>
            <Text style={styles.seeAll}>{t('seeAll')}</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={styles.stateText}>{t('loadingMedicines')}</Text>
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadCatalog}>
              <Text style={styles.retryText}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : featured.length === 0 ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>{t('noMedicines')}</Text>
            <Text style={styles.stateSubtext}>{t('noMedicinesHint')}</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {featured.map((item) => (
              <MedicineCard key={item.id} item={item} />
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.prescriptionCard}
          onPress={() => navigation.navigate('Prescription')}
        >
          <Icon name="camera-alt" size={40} color="#1976d2" />
          <View style={styles.prescriptionContent}>
            <Text style={styles.prescriptionTitle}>{t('uploadPrescription')}</Text>
            <Text style={styles.prescriptionSubtitle}>{t('prescriptionSubtitle')}</Text>
          </View>
          <Icon name="arrow-forward-ios" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  cartButton: {
    position: 'relative',
    padding: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#f44336',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchText: {
    marginLeft: 10,
    color: '#666',
    fontSize: 16,
  },
  section: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAll: {
    color: '#1976d2',
    fontSize: 14,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 15,
  },
  categoryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  medicineCard: {
    width: 150,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginRight: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medicineImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  medicineName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  medicinePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  inlineLoader: {
    marginVertical: 15,
  },
  stateText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  stateSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#f44336',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  prescriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  prescriptionContent: {
    flex: 1,
    marginLeft: 15,
  },
  prescriptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  prescriptionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
});

export default HomeScreen;
