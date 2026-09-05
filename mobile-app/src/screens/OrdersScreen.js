import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import axios from 'axios';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';

const OrdersScreen = ({ navigation }) => {
  const { loadCartItems } = useCart();
  const { user } = useAuth();
  const defaultCurrency = user?.business?.currency || 'USD';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await axios.get('/orders/my-orders?limit=30');
      const orderList = response.data.data?.orders || [];
      setOrders(orderList);
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      Alert.alert('Error', 'Unable to load orders. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'Delivered':
        return { color: '#16a34a', bg: '#dcfce7', label: 'Delivered', icon: 'check-circle' };
      case 'Dispatched':
        return { color: '#0284c7', bg: '#e0f2fe', label: 'Out for Delivery', icon: 'local-shipping' };
      case 'Approved':
        return { color: '#4f46e5', bg: '#e0e7ff', label: 'Approved', icon: 'thumb-up' };
      case 'Pending':
        return { color: '#d97706', bg: '#fef3c7', label: 'Pending Review', icon: 'hourglass-empty' };
      case 'Cancelled':
        return { color: '#dc2626', bg: '#fee2e2', label: 'Cancelled', icon: 'cancel' };
      default:
        return { color: '#475569', bg: '#f1f5f9', label: status || 'Unknown', icon: 'help-outline' };
    }
  };

  const handleReorder = (order) => {
    if (!order.items || order.items.length === 0) {
      Alert.alert('Cannot Reorder', 'This order has no item list (e.g. prescription-only order).');
      return;
    }

    Alert.alert(
      'Reorder Items',
      `Add all ${order.items.length} item(s) from Order #${order.id} to your cart? You can edit quantities before confirming.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load into Cart',
          onPress: () => {
            loadCartItems(order.items, order.id);
            navigation.navigate('Cart');
          }
        }
      ]
    );
  };

  const toggleExpand = (orderId) => {
    setExpandedOrderId(prev => prev === orderId ? null : orderId);
  };

  const OrderItem = ({ order }) => {
    const config = getStatusConfig(order.status);
    const isExpanded = expandedOrderId === order.id;

    return (
      <View style={styles.orderCard}>
        {/* Header */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => toggleExpand(order.id)}
          style={styles.cardHeader}
        >
          <View style={styles.headerLeft}>
            <View style={styles.orderTitleRow}>
              <Text style={styles.orderId}>Order #{order.id}</Text>
              {order.source === 'POS' && (
                <View style={styles.posBadge}>
                  <Text style={styles.posBadgeText}>POS</Text>
                </View>
              )}
            </View>
            <Text style={styles.orderDate}>
              {new Date(order.orderDate).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            <Icon name={config.icon} size={14} color={config.color} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
        </TouchableOpacity>

        {/* Main Details */}
        <View style={styles.cardBody}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Items:</Text>
            <Text style={styles.metaValue}>
              {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'}
              {order.prescription ? ' (Prescription attached)' : ''}
            </Text>
          </View>

          {order.taxRate > 0 && order.subtotal && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Subtotal / Tax:</Text>
              <Text style={styles.metaValue}>
                {order.currency || defaultCurrency} {parseFloat(order.subtotal).toFixed(2)} + Tax {order.currency || defaultCurrency} {parseFloat(order.taxAmount || 0).toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Total Payable:</Text>
            <Text style={styles.metaAmount}>{order.currency || defaultCurrency} {order.totalAmount?.toFixed(2) || '0.00'}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Payment:</Text>
            <Text style={styles.metaValue}>
              {order.paymentMethod} ({order.paymentStatus})
            </Text>
          </View>
        </View>

        {/* Expandable item breakdown */}
        {isExpanded && order.items && order.items.length > 0 && (
          <View style={styles.expandedSection}>
            <Text style={styles.itemSectionTitle}>Medicine Details:</Text>
            {order.items.map((item, idx) => (
              <View key={idx} style={styles.lineItem}>
                <Text style={styles.lineItemName} numberOfLines={1}>
                  {item.name || `Medicine #${item.medicineId}`}
                </Text>
                <Text style={styles.lineItemQty}>× {item.quantity}</Text>
                <Text style={styles.lineItemPrice}>
                  {order.currency || defaultCurrency} {parseFloat(item.subtotal || (item.price * item.quantity)).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Card Footer Actions */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => toggleExpand(order.id)}
          >
            <Text style={styles.expandButtonText}>
              {isExpanded ? 'Hide Details' : 'View Breakdown'}
            </Text>
            <Icon
              name={isExpanded ? 'expand-less' : 'expand-more'}
              size={18}
              color="#1976d2"
            />
          </TouchableOpacity>

          {/* Reorder Button */}
          {order.items && order.items.length > 0 && (
            <TouchableOpacity
              style={styles.reorderButton}
              onPress={() => handleReorder(order)}
            >
              <Icon name="repeat" size={16} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.reorderButtonText}>Reorder</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Orders</Text>
        <Text style={styles.subtitle}>Track live order status & reorder past medicines</Text>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Fetching your orders...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="receipt-long" size={70} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Orders Yet</Text>
          <Text style={styles.emptySubtitle}>
            When you place orders through our pharmacy app, you can track their live status here.
          </Text>
          <TouchableOpacity
            style={styles.shopNowButton}
            onPress={() => navigation.navigate('Medicines')}
          >
            <Text style={styles.shopNowButtonText}>Browse Catalog</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={({ item }) => <OrderItem order={item} />}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#1976d2']}
            />
          }
        />
      )}
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
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 15,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 25,
  },
  shopNowButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  shopNowButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flex: 1,
  },
  orderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  posBadge: {
    marginLeft: 6,
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  posBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#7e22ce',
  },
  orderDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardBody: {
    paddingVertical: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  metaLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },
  metaAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  expandedSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
  },
  itemSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 6,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 3,
  },
  lineItemName: {
    flex: 1,
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '500',
  },
  lineItemQty: {
    fontSize: 12,
    color: '#64748b',
    marginHorizontal: 8,
  },
  lineItemPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1976d2',
  },
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976d2',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  reorderButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

export default OrdersScreen;
