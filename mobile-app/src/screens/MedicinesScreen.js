import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useI18n } from '../contexts/I18nContext';
import { authHeaders, getStockStatus, resolveImageUri } from '../utils/api';
import { useFormatCurrency } from '../utils/formatCurrency';

const MedicinesScreen = ({ route }) => {
  const navigation = useNavigation();
  const { token } = useAuth();
  const { addToCart } = useCart();
  const { t } = useI18n();
  const formatMoney = useFormatCurrency();

  const [medicines, setMedicines] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(route.params?.categoryId ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (route.params?.categoryId !== undefined) {
      setSelectedCategory(route.params.categoryId);
    }
  }, [route.params?.categoryId]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await axios.get('/categories', { headers: authHeaders(token) });
        setCategories(response.data?.data?.categories || []);
      } catch (requestError) {
        console.error('Error fetching categories:', requestError);
      }
    };

    loadCategories();
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    const loadMedicines = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get('/medicines', {
          params: {
            page: 1,
            limit: 50,
            search: search.trim() || undefined,
            category: selectedCategory || undefined,
          },
          headers: authHeaders(token),
        });
        if (!cancelled) {
          setMedicines(response.data?.data?.medicines || []);
        }
      } catch (requestError) {
        if (!cancelled) {
          setMedicines([]);
          setError(requestError.response?.data?.message || t('loadFailed'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(loadMedicines, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, selectedCategory, token, t, refreshKey]);

  const handleAddToCart = (item, event) => {
    if (event && event.stopPropagation) event.stopPropagation();
    if (getStockStatus(item.stock) === 'out') {
      Alert.alert(t('outOfStock'), t('noMedicinesHint'));
      return;
    }
    addToCart(item, 1);
    Alert.alert(t('success'), t('addedToCart'));
  };

  const stockStyle = (stock) => {
    const status = getStockStatus(stock);
    if (status === 'out') return { label: t('outOfStock'), color: '#dc2626' };
    if (status === 'low') return { label: `${t('lowStock')} (${stock})`, color: '#d97706' };
    return { label: `${t('inStock')} (${stock})`, color: '#16a34a' };
  };

  const MedicineCard = ({ item }) => {
    const stock = stockStyle(item.stock);
    return (
      <TouchableOpacity
        style={styles.medicineCard}
        onPress={() => navigation.navigate('MedicineDetail', { medicine: item })}
        activeOpacity={0.8}
      >
        <View style={styles.medicineImage}>
          {item.imagePath ? (
            <Image source={{ uri: resolveImageUri(item.imagePath) }} style={styles.image} />
          ) : (
            <Icon name="medication" size={40} color="#1976d2" />
          )}
        </View>
        <View style={styles.medicineInfo}>
          <Text style={styles.medicineName}>{item.name}</Text>
          <Text style={styles.medicineCategory}>{item.category?.name || t('category')}</Text>
          <View style={styles.priceStockContainer}>
            <Text style={styles.medicinePrice}>{formatMoney(item.price)}</Text>
            <Text style={[styles.stock, { color: stock.color }]}>{stock.label}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.addButton, getStockStatus(item.stock) === 'out' && styles.addButtonDisabled]}
          onPress={(event) => handleAddToCart(item, event)}
        >
          <Icon name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('medicines')}</Text>
        <Text style={styles.subtitle}>
          {selectedCategory ? t('categoryItems') : t('allMedicines')}
        </Text>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Icon name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('searchMedicines')}
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipList}>
        <TouchableOpacity
          style={[styles.chip, !selectedCategory && styles.chipSelected]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.chipText, !selectedCategory && styles.chipTextSelected]}>
            {t('all')}
          </Text>
        </TouchableOpacity>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[styles.chip, selectedCategory === category.id && styles.chipSelected]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Text style={[styles.chipText, selectedCategory === category.id && styles.chipTextSelected]}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.stateText}>{t('loadingMedicines')}</Text>
        </View>
      ) : error ? (
        <View style={styles.stateContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => setRefreshKey((previous) => previous + 1)}
          >
            <Text style={styles.retryText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : medicines.length === 0 ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>{t('noMedicines')}</Text>
          <Text style={styles.stateSubtext}>{t('noMedicinesHint')}</Text>
        </View>
      ) : (
        <FlatList
          data={medicines}
          renderItem={({ item }) => <MedicineCard item={item} />}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 10,
    color: '#333',
    fontSize: 16,
  },
  chipList: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  chipText: {
    color: '#475569',
    fontSize: 13,
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  medicineCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
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
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    overflow: 'hidden',
  },
  image: {
    width: 60,
    height: 60,
  },
  medicineInfo: {
    flex: 1,
  },
  medicineName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  medicineCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  priceStockContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medicinePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  stock: {
    fontSize: 12,
  },
  addButton: {
    backgroundColor: '#1976d2',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
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
});

export default MedicinesScreen;
