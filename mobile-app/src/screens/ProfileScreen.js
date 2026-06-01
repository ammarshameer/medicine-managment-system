import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();

  const menuItems = [
    { id: 1, title: 'Personal Information', icon: 'person', onPress: () => {} },
    { id: 2, title: 'Delivery Addresses', icon: 'location-on', onPress: () => {} },
    { id: 3, title: 'Payment Methods', icon: 'payment', onPress: () => {} },
    { id: 4, title: 'Order History', icon: 'history', onPress: () => navigation.navigate('Orders') },
    { id: 5, title: 'Prescriptions', icon: 'description', onPress: () => {} },
    { id: 6, title: 'Settings', icon: 'settings', onPress: () => {} },
    { id: 7, title: 'Help & Support', icon: 'help', onPress: () => {} },
    { id: 8, title: 'About', icon: 'info', onPress: () => {} },
  ];

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: logout },
      ]
    );
  };

  const MenuItem = ({ item }) => (
    <TouchableOpacity style={styles.menuItem} onPress={item.onPress}>
      <Icon name={item.icon} size={24} color="#666" />
      <Text style={styles.menuText}>{item.title}</Text>
      <Icon name="chevron-right" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileInfo}>
          <View style={styles.avatar}>
            <Icon name="person" size={40} color="#fff" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.menuContainer}>
        {menuItems.map((item) => (
          <MenuItem key={item.id} item={item} />
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Icon name="logout" size={24} color="#f44336" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1976d2',
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  menuContainer: {
    backgroundColor: '#fff',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutText: {
    fontSize: 16,
    color: '#f44336',
    marginLeft: 15,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;
