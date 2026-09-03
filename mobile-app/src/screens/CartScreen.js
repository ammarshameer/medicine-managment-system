import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import axios from 'axios';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';

const CartScreen = ({ navigation }) => {
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, clearCart, reorderedFromOrderId } = useCart();
  const { user } = useAuth();

  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(user?.address || '');
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const paymentOptions = [
    { id: 'Cash on Delivery', label: 'Cash on Delivery (COD)', icon: 'payments' },
    { id: 'JazzCash', label: 'JazzCash Mobile Account', icon: 'phone-android' },
    { id: 'EasyPaisa', label: 'EasyPaisa Wallet', icon: 'account-balance-wallet' },
    { id: 'Bank Transfer', label: 'Direct Bank Transfer', icon: 'account-balance' },
    { id: 'Credit Card', label: 'Credit / Debit Card', icon: 'credit-card' }
  ];

  const CartItem = ({ item }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemImage}>
        <Icon name="medication" size={32} color="#1976d2" />
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemPrice}>PKR {item.price.toFixed(2)}</Text>
      </View>
      <View style={styles.quantityControls}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => updateQuantity(item.id, item.quantity - 1)}
        >
          <Icon name="remove" size={16} color="#444" />
        </TouchableOpacity>
        <Text style={styles.quantity}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => updateQuantity(item.id, item.quantity + 1)}
        >
          <Icon name="add" size={16} color="#444" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => removeFromCart(item.id)}
      >
        <Icon name="delete-outline" size={22} color="#f44336" />
      </TouchableOpacity>
    </View>
  );

  const handleStartCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert('Cart Empty', 'Please add items to cart first');
      return;
    }
    setCheckoutModalVisible(true);
  };

  const handlePlaceOrder = async () => {
    if (!deliveryAddress.trim()) {
      Alert.alert('Address Required', 'Please enter your complete delivery address');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        items: cartItems.map(item => ({
          medicineId: item.id,
          quantity: item.quantity
        })),
        deliveryAddress: deliveryAddress.trim(),
        paymentMethod,
        reorderedFromOrderId: reorderedFromOrderId || undefined,
        notes: orderNotes.trim() || undefined
      };

      const response = await axios.post('/orders', payload);
      const order = response.data.data;

      setSubmitting(false);
      setCheckoutModalVisible(false);
      clearCart();

      Alert.alert(
        'Order Placed Successfully!',
        `Your order #${order.id} has been received and is being processed by the pharmacy.`,
        [
          {
            text: 'View My Orders',
            onPress: () => navigation.navigate('Orders')
          }
        ]
      );
    } catch (error) {
      setSubmitting(false);
      const message = error.response?.data?.message || 'Failed to place order. Please try again.';
      Alert.alert('Order Failed', message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Shopping Cart</Text>
        <Text style={styles.subtitle}>
          {cartItems.length} {cartItems.length === 1 ? 'medicine' : 'medicines'}
          {reorderedFromOrderId ? ` • (Reordering #${reorderedFromOrderId})` : ''}
        </Text>
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.emptyCart}>
          <Icon name="shopping-bag" size={70} color="#ccc" />
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <Text style={styles.emptySubtext}>Explore our pharmacy catalog to add medicines</Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => navigation.navigate('Medicines')}
          >
            <Text style={styles.shopButtonText}>Browse Medicines</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cartItems}
            renderItem={({ item }) => <CartItem item={item} />}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.checkoutSection}>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Grand Total:</Text>
              <Text style={styles.totalAmount}>PKR {getCartTotal().toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={styles.checkoutButton} onPress={handleStartCheckout}>
              <Icon name="shopping-cart-checkout" size={22} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Complete Checkout Modal */}
      <Modal
        visible={checkoutModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCheckoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complete Your Order</Text>
              <TouchableOpacity
                onPress={() => setCheckoutModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* Delivery Address Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Delivery Address *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="House/Street, Area, City"
                  value={deliveryAddress}
                  onChangeText={setDeliveryAddress}
                  multiline={true}
                  numberOfLines={3}
                />
              </View>

              {/* Payment Method Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Payment Method *</Text>
                {paymentOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.paymentOption,
                      paymentMethod === opt.id && styles.paymentOptionSelected
                    ]}
                    onPress={() => setPaymentMethod(opt.id)}
                  >
                    <Icon
                      name={opt.icon}
                      size={22}
                      color={paymentMethod === opt.id ? '#1976d2' : '#666'}
                    />
                    <Text
                      style={[
                        styles.paymentText,
                        paymentMethod === opt.id && styles.paymentTextSelected
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {paymentMethod === opt.id && (
                      <Icon name="check-circle" size={20} color="#1976d2" style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Order Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Special Delivery Instructions</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Ring bell, call before arrival..."
                  value={orderNotes}
                  onChangeText={setOrderNotes}
                />
              </View>

              {/* Order Summary Box */}
              <View style={styles.orderSummaryBox}>
                <Text style={styles.summaryTitle}>Order Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Items:</Text>
                  <Text style={styles.summaryValue}>{cartItems.length}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Payable Total:</Text>
                  <Text style={styles.summaryTotalValue}>PKR {getCartTotal().toFixed(2)}</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.placeOrderButton, submitting && styles.buttonDisabled]}
                onPress={handlePlaceOrder}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.placeOrderButtonText}>Confirm & Place Order</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 45,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 25,
  },
  shopButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  list: {
    padding: 16,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  itemImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 13,
    color: '#1976d2',
    fontWeight: '600',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  quantityButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantity: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginHorizontal: 8,
  },
  deleteButton: {
    padding: 6,
  },
  checkoutSection: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  checkoutButton: {
    backgroundColor: '#1976d2',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingBottom: 25,
    paddingHorizontal: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScroll: {
    marginTop: 12,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  paymentOptionSelected: {
    borderColor: '#1976d2',
    backgroundColor: '#eff6ff',
  },
  paymentText: {
    fontSize: 14,
    color: '#334155',
    marginLeft: 10,
    fontWeight: '500',
  },
  paymentTextSelected: {
    color: '#1976d2',
    fontWeight: 'bold',
  },
  orderSummaryBox: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 14,
    marginVertical: 10,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  summaryTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  modalFooter: {
    paddingTop: 12,
  },
  placeOrderButton: {
    backgroundColor: '#1976d2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  placeOrderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default CartScreen;
