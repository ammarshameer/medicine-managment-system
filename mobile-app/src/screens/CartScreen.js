import React, { useState, useEffect } from 'react';
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

const getCurrencySymbol = (code = 'USD') => {
  switch (code) {
    case 'PKR': return 'Rs. ';
    case 'AED': return 'AED ';
    case 'SAR': return 'SAR ';
    case 'GBP': return '£';
    case 'EUR': return '€';
    default: return '$';
  }
};

const CartScreen = ({ navigation }) => {
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, clearCart, reorderedFromOrderId } = useCart();
  const { user } = useAuth();

  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(user?.address || '');
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [taxPreview, setTaxPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Live tax preview effect whenever cart items change
  useEffect(() => {
    if (cartItems.length === 0) {
      setTaxPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const res = await axios.post('/orders/preview-tax', {
          items: cartItems.map(i => ({ medicineId: i.id, quantity: i.quantity }))
        });
        if (res.data?.success) {
          setTaxPreview(res.data.data);
        }
      } catch (err) {
        console.error('Mobile tax preview error:', err);
      } finally {
        setPreviewLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [cartItems]);

  const currencyCode = taxPreview?.currency || user?.business?.currency || 'USD';
  const currencySymbol = getCurrencySymbol(currencyCode);

  const rawTotal = getCartTotal();
  const grandTotal = taxPreview ? taxPreview.totalAmount : rawTotal;
  const subtotalAmount = taxPreview ? taxPreview.subtotal : rawTotal;
  const taxAmount = taxPreview ? taxPreview.taxAmount : 0;
  const taxRate = taxPreview ? taxPreview.taxRate : 0;

  // Adapt payment options based on region/currency
  const isPKR = currencyCode === 'PKR';
  const paymentOptions = [
    { id: 'Cash on Delivery', label: 'Cash on Delivery (COD)', icon: 'payments' },
    { id: 'Credit Card', label: 'Credit / Debit Card', icon: 'credit-card' },
    { id: 'Bank Transfer', label: 'Direct Bank Transfer', icon: 'account-balance' },
    { id: 'Insurance Copay', label: 'Insurance Copay', icon: 'health-and-safety' },
    ...(isPKR ? [
      { id: 'JazzCash', label: 'JazzCash Mobile Account', icon: 'phone-android' },
      { id: 'EasyPaisa', label: 'EasyPaisa Wallet', icon: 'account-balance-wallet' }
    ] : [])
  ];

  const CartItem = ({ item }) => {
    const previewItem = taxPreview?.items?.find(i => i.medicineId === item.id);
    const isTaxable = previewItem ? previewItem.isTaxable : true;

    return (
      <View style={styles.cartItem}>
        <View style={styles.itemImage}>
          <Icon name="medication" size={32} color="#1976d2" />
        </View>
        <View style={styles.itemInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.taxTag, isTaxable ? styles.taxTagT : styles.taxTagE]}>
              {isTaxable ? '[T]' : '[E]'}
            </Text>
          </View>
          <Text style={styles.itemPrice}>{currencySymbol}{item.price.toFixed(2)}</Text>
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
  };

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
        `Your order #${order.id} has been placed for ${currencySymbol}${order.totalAmount.toFixed(2)}. Processing now.`,
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text style={styles.title}>Shopping Cart</Text>
            <Text style={styles.subtitle}>
              {cartItems.length} {cartItems.length === 1 ? 'medicine' : 'medicines'}
              {reorderedFromOrderId ? ` • (Reordering #${reorderedFromOrderId})` : ''}
            </Text>
          </div>
          <View style={styles.currencyBadge}>
            <Text style={styles.currencyBadgeText}>{currencyCode}</Text>
          </View>
        </View>
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
            <View style={styles.summaryBreakdown}>
              <View style={styles.summaryRowMini}>
                <Text style={styles.summaryLabelMini}>Subtotal:</Text>
                <Text style={styles.summaryValueMini}>{currencySymbol}{subtotalAmount.toFixed(2)}</Text>
              </View>
              {taxAmount > 0 && (
                <View style={styles.summaryRowMini}>
                  <Text style={styles.summaryLabelMini}>Tax / VAT ({(taxRate * 100).toFixed(2)}%):</Text>
                  <Text style={styles.summaryValueMini}>+{currencySymbol}{taxAmount.toFixed(2)}</Text>
                </View>
              )}
            </View>

            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Grand Total:</Text>
              <Text style={styles.totalAmount}>
                {previewLoading ? '...' : `${currencySymbol}${grandTotal.toFixed(2)}`}
              </Text>
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
                  <Text style={styles.summaryLabel}>Subtotal:</Text>
                  <Text style={styles.summaryValue}>{currencySymbol}{subtotalAmount.toFixed(2)}</Text>
                </View>
                {taxAmount > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Tax / VAT ({(taxRate * 100).toFixed(2)}%):</Text>
                    <Text style={styles.summaryValue}>{currencySymbol}{taxAmount.toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, marginTop: 4 }]}>
                  <Text style={[styles.summaryLabel, { fontWeight: 'bold', color: '#0f172a' }]}>Grand Total:</Text>
                  <Text style={styles.summaryTotalValue}>{currencySymbol}{grandTotal.toFixed(2)}</Text>
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
  currencyBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  currencyBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1d4ed8',
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 20,
  },
  shopButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  list: {
    padding: 15,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemImage: {
    width: 46,
    height: 46,
    borderRadius: 8,
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
    color: '#0f172a',
    maxWidth: 120,
  },
  taxTag: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  taxTagT: {
    color: '#2563eb',
  },
  taxTagE: {
    color: '#16a34a',
  },
  itemPrice: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    marginRight: 10,
  },
  quantityButton: {
    padding: 6,
  },
  quantity: {
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  deleteButton: {
    padding: 6,
  },
  checkoutSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  summaryBreakdown: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  summaryRowMini: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  taxBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  taxableBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  exemptBadge: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  taxBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  taxableBadgeText: {
    color: '#1d4ed8',
  },
  exemptBadgeText: {
    color: '#15803d',
  },
  breakdownBox: {
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1976d2',
  },
  checkoutButton: {
    backgroundColor: '#1976d2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  checkoutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginBottom: 15,
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
    marginBottom: 15,
  },
  formGroup: {
    marginBottom: 15,
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
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 8,
  },
  paymentOptionSelected: {
    borderColor: '#1976d2',
    backgroundColor: '#eff6ff',
  },
  paymentText: {
    marginLeft: 10,
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  paymentTextSelected: {
    color: '#1976d2',
    fontWeight: 'bold',
  },
  orderSummaryBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
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
    color: '#0f172a',
  },
  summaryTotalValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1976d2',
  },
  modalFooter: {
    paddingTop: 10,
  },
  placeOrderButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  placeOrderButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default CartScreen;
