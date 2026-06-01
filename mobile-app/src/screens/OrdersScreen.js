import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const OrdersScreen = () => {
  const [orders] = React.useState([
    {
      id: 1,
      date: '2024-01-15',
      status: 'Delivered',
      total: 250,
      items: 3,
    },
    {
      id: 2,
      date: '2024-01-14',
      status: 'Dispatched',
      total: 180,
      items: 2,
    },
    {
      id: 3,
      date: '2024-01-13',
      status: 'Pending',
      total: 320,
      items: 4,
    },
  ]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Delivered': return '#4CAF50';
      case 'Dispatched': return '#2196F3';
      case 'Pending': return '#FF9800';
      case 'Cancelled': return '#F44336';
      default: return '#666';
    }
  };

  const OrderItem = ({ order }) => (
    <TouchableOpacity style={styles.orderItem}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderId}>Order #{order.id}</Text>
          <Text style={styles.orderDate}>{order.date}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
          <Text style={styles.statusText}>{order.status}</Text>
        </View>
      </View>
      <View style={styles.orderDetails}>
        <Text style={styles.orderItems}>{order.items} items</Text>
        <Text style={styles.orderTotal}>PKR {order.total}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Orders</Text>
        <Text style={styles.subtitle}>Track your orders</Text>
      </View>

      <FlatList
        data={orders}
        renderItem={({ item }) => <OrderItem order={item} />}
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
  orderItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderItems: {
    fontSize: 14,
    color: '#666',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
  },
});

export default OrdersScreen;
