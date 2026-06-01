import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const MedicinesScreen = ({ route }) => {
  const { categoryId } = route.params || {};
  
  const [medicines] = React.useState([
    { id: 1, name: 'Paracetamol 500mg', price: 50, stock: 100, category: 'Pain Relief' },
    { id: 2, name: 'Ibuprofen 400mg', price: 75, stock: 80, category: 'Pain Relief' },
    { id: 3, name: 'Vitamin C 1000mg', price: 80, stock: 200, category: 'Vitamins' },
    { id: 4, name: 'Cough Syrup', price: 150, stock: 75, category: 'Cold & Flu' },
  ]);

  const MedicineCard = ({ medicine }) => (
    <TouchableOpacity style={styles.medicineCard}>
      <View style={styles.medicineImage}>
        <Icon name="medication" size={40} color="#ccc" />
      </View>
      <View style={styles.medicineInfo}>
        <Text style={styles.medicineName}>{medicine.name}</Text>
        <Text style={styles.medicineCategory}>{medicine.category}</Text>
        <View style={styles.priceStockContainer}>
          <Text style={styles.medicinePrice}>PKR {medicine.price}</Text>
          <Text style={styles.stock}>Stock: {medicine.stock}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.addButton}>
        <Icon name="add" size={20} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Medicines</Text>
        <Text style={styles.subtitle}>
          {categoryId ? 'Category Items' : 'All Medicines'}
        </Text>
      </View>

      <FlatList
        data={medicines}
        renderItem={({ item }) => <MedicineCard medicine={item} />}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
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
  list: {
    paddingHorizontal: 20,
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
    color: '#666',
  },
  addButton: {
    backgroundColor: '#1976d2',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MedicinesScreen;
