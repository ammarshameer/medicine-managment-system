import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { authHeaders, getStockStatus, resolveImageUri } from '../utils/api';
import { useFormatCurrency } from '../utils/formatCurrency';

const MedicineDetailScreen = ({ route, navigation }) => {
  const { medicine: initialMedicine, medicineId } = route.params || {};
  const [medicine, setMedicine] = useState(initialMedicine || null);
  const [loading, setLoading] = useState(!initialMedicine);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();
  const { token } = useAuth();
  const { t } = useI18n();
  const formatMoney = useFormatCurrency();

  useEffect(() => {
    if (initialMedicine) {
      setMedicine(initialMedicine);
      setLoading(false);
      return;
    }

    if (!medicineId) {
      setError(t('notAvailable'));
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadMedicine = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`/medicines/${medicineId}`, {
          headers: authHeaders(token),
        });
        if (!cancelled) {
          setMedicine(response.data?.data || null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.response?.data?.message || t('loadFailed'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMedicine();
    return () => { cancelled = true; };
  }, [initialMedicine, medicineId, token, t]);

  useEffect(() => {
    setQuantity(1);
  }, [medicine?.id]);

  const stockStatus = getStockStatus(medicine?.stock);
  const maxQuantity = Math.max(Number(medicine?.stock) || 0, 0);

  const handleAddToCart = () => {
    if (!medicine || stockStatus === 'out') {
      Alert.alert(t('outOfStock'), t('noMedicinesHint'));
      return;
    }
    addToCart(medicine, quantity);
    Alert.alert(t('success'), t('addedToCart'));
  };

  const increaseQuantity = () => setQuantity((current) => Math.min(current + 1, maxQuantity));
  const decreaseQuantity = () => setQuantity((current) => Math.max(1, current - 1));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.stateText}>{t('loading')}</Text>
      </View>
    );
  }

  if (error || !medicine) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || t('notAvailable')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryText}>{t('cancel')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        <View style={styles.medicineImage}>
          {medicine.imagePath ? (
            <Image source={{ uri: resolveImageUri(medicine.imagePath) }} style={styles.image} />
          ) : (
            <Icon name="medication" size={80} color="#ccc" />
          )}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.medicineName}>{medicine.name}</Text>
          <Text style={styles.medicinePrice}>{formatMoney(medicine.price)}</Text>
        </View>

        {medicine.requiresPrescription && (
          <View style={styles.prescriptionNotice}>
            <Icon name="description" size={20} color="#d97706" />
            <Text style={styles.prescriptionText}>{t('prescriptionRequired')}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('description')}</Text>
          <Text style={styles.description}>
            { medicine.description || t('notAvailable') }
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('productDetails')}</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('manufacturer')}</Text>
            <Text style={styles.detailValue}>{medicine.manufacturer || t('notAvailable')}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('category')}</Text>
            <Text style={styles.detailValue}>{medicine.category?.name || t('notAvailable')}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('stock')}</Text>
            <Text style={[
              styles.detailValue,
              stockStatus === 'out' ? styles.outOfStock : stockStatus === 'low' ? styles.lowStock : styles.inStock,
            ]}>
              {stockStatus === 'out'
                ? t('outOfStock')
                : stockStatus === 'low'
                  ? `${t('lowStock')} (${medicine.stock})`
                  : `${t('inStock')} (${medicine.stock})`}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('deaSchedule')}</Text>
            <Text style={styles.detailValue}>{medicine.deaSchedule || 'None'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('uaeClassification')}</Text>
            <Text style={styles.detailValue}>{medicine.uaeClassification || 'OTC'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('taxable')}</Text>
            <Text style={styles.detailValue}>
              {medicine.isTaxable ? t('taxable') : t('notAvailable')}
              {medicine.priceIncludesTax ? ` • ${t('taxIncluded')}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.quantitySection}>
          <Text style={styles.sectionTitle}>{t('quantity')}</Text>
          <View style={styles.quantityControls}>
            <TouchableOpacity style={styles.quantityButton} onPress={decreaseQuantity}>
              <Icon name="remove" size={20} color="#666" />
            </TouchableOpacity>
            <Text style={styles.quantity}>{quantity}</Text>
            <TouchableOpacity
              style={[styles.quantityButton, quantity >= maxQuantity && styles.quantityButtonDisabled]}
              onPress={increaseQuantity}
              disabled={quantity >= maxQuantity}
            >
              <Icon name="add" size={20} color={quantity >= maxQuantity ? '#ccc' : '#666'} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addToCartButton, stockStatus === 'out' && styles.addToCartDisabled]}
          onPress={handleAddToCart}
          disabled={stockStatus === 'out'}
        >
          <Icon name="shopping-cart" size={20} color="#fff" />
          <Text style={styles.addToCartText}>{t('addToCart')}</Text>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 30,
  },
  imageContainer: {
    backgroundColor: '#fff',
    padding: 40,
    alignItems: 'center',
  },
  medicineImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: 150,
    height: 150,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  medicineName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  medicinePrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  prescriptionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  prescriptionText: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  inStock: {
    color: '#16a34a',
  },
  lowStock: {
    color: '#d97706',
  },
  outOfStock: {
    color: '#dc2626',
  },
  quantitySection: {
    marginBottom: 25,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: {
    backgroundColor: '#f8f8f8',
  },
  quantity: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 30,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976d2',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  addToCartDisabled: {
    backgroundColor: '#cbd5e1',
  },
  addToCartText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  stateText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
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

export default MedicineDetailScreen;
