import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';

const MedicineDetailScreen = ({ route, navigation }) => {
  const { medicine } = route.params || {};
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();
  const { user } = useAuth();
  const currency = user?.business?.currency || 'USD';

  const handleAddToCart = () => {
    addToCart(medicine, quantity);
    Alert.alert('Success', 'Added to cart!');
  };

  const increaseQuantity = () => setQuantity(quantity + 1);
  const decreaseQuantity = () => setQuantity(Math.max(1, quantity - 1));

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        <View style={styles.medicineImage}>
          <Icon name="medication" size={80} color="#ccc" />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.medicineName}>{medicine?.name || 'Medicine Name'}</Text>
          <Text style={styles.medicinePrice}>{currency} {medicine?.price || 0}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>
            This is a high-quality medicine that provides effective relief for various conditions. 
            Always consult with your healthcare provider before use.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Manufacturer:</Text>
            <Text style={styles.detailValue}>PharmaCorp</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Category:</Text>
            <Text style={styles.detailValue}>{medicine?.category || 'General'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Stock:</Text>
            <Text style={styles.detailValue}>Available</Text>
          </View>
        </View>

        <View style={styles.quantitySection}>
          <Text style={styles.sectionTitle}>Quantity</Text>
          <View style={styles.quantityControls}>
            <TouchableOpacity style={styles.quantityButton} onPress={decreaseQuantity}>
              <Icon name="remove" size={20} color="#666" />
            </TouchableOpacity>
            <Text style={styles.quantity}>{quantity}</Text>
            <TouchableOpacity style={styles.quantityButton} onPress={increaseQuantity}>
              <Icon name="add" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.addToCartButton} onPress={handleAddToCart}>
          <Icon name="shopping-cart" size={20} color="#fff" />
          <Text style={styles.addToCartText}>Add to Cart</Text>
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
  addToCartText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});

export default MedicineDetailScreen;
