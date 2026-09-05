import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getCartItemCount } = useCart();

  const categories = [
    { id: 1, name: 'Pain Relief', icon: 'healing', color: '#4CAF50' },
    { id: 2, name: 'Antibiotics', icon: 'medical-services', color: '#2196F3' },
    { id: 3, name: 'Vitamins', icon: 'spa', color: '#FF9800' },
    { id: 4, name: 'Cold & Flu', icon: 'air', color: '#9C27B0' },
    { id: 5, name: 'Digestive', icon: 'favorite', color: '#F44336' },
    { id: 6, name: 'Allergy', icon: 'eco', color: '#009688' },
  ];

  const featuredMedicines = [
    { id: 1, name: 'Paracetamol 500mg', price: 50, image: null },
    { id: 2, name: 'Vitamin C 1000mg', price: 80, image: null },
    { id: 3, name: 'Cough Syrup', price: 150, image: null },
    { id: 4, name: 'Antacid Tablets', price: 60, image: null },
  ];

  const currency = user?.business?.currency || 'USD';

  const MedicineCard = ({ medicine }) => (
    <TouchableOpacity
      style={styles.medicineCard}
      onPress={() => navigation.navigate('MedicineDetail', { medicine })}
    >
      <View style={styles.medicineImage}>
        {medicine.image ? (
          <Image source={{ uri: medicine.image }} style={styles.image} />
        ) : (
          <Icon name="medication" size={40} color="#ccc" />
        )}
      </View>
      <Text style={styles.medicineName} numberOfLines={2}>
        {medicine.name}
      </Text>
      <Text style={styles.medicinePrice}>{currency} {medicine.price}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name || 'User'}!</Text>
          <Text style={styles.subtitle}>How can we help you today?</Text>
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
        <TouchableOpacity style={styles.searchBar}>
          <Icon name="search" size={20} color="#666" />
          <Text style={styles.searchText}>Search medicines...</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <View style={styles.categoriesContainer}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryCard}
              onPress={() => navigation.navigate('Medicines', { categoryId: category.id })}
            >
              <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
                <Icon name={category.icon} size={24} color="#fff" />
              </View>
              <Text style={styles.categoryName}>{category.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured Medicines</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Medicines')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {featuredMedicines.map((medicine) => (
            <MedicineCard key={medicine.id} medicine={medicine} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.prescriptionCard}
          onPress={() => navigation.navigate('Prescription')}
        >
          <Icon name="camera-alt" size={40} color="#1976d2" />
          <View style={styles.prescriptionContent}>
            <Text style={styles.prescriptionTitle}>Upload Prescription</Text>
            <Text style={styles.prescriptionSubtitle}>
              Get medicines prescribed by your doctor
            </Text>
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
