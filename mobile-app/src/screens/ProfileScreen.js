import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const business = user?.business;

  const menuItems = [
    { id: 4, title: 'Order History', icon: 'history', onPress: () => navigation.navigate('Orders') },
    { id: 5, title: 'Prescriptions', icon: 'description', onPress: () => navigation.navigate('Prescriptions') },
    { id: 7, title: 'Help & Support', icon: 'help', onPress: () => {} },
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.profileInfo}>
          <View style={styles.avatar}>
            <Icon name="person" size={40} color="#fff" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'Patient'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'patient@example.com'}</Text>
            {user?.emiratesId && (
              <View style={styles.idBadge}>
                <Text style={styles.idBadgeText}>Emirates ID: {user.emiratesId}</Text>
              </View>
            )}
            {user?.nationalIdLast4 && (
              <View style={styles.idBadge}>
                <Text style={styles.idBadgeText}>National ID (Last 4): ***-**-{user.nationalIdLast4}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Connected Pharmacy Card */}
      {business && (
        <View style={styles.pharmacyCard}>
          <View style={styles.pharmacyCardHeader}>
            <Icon name="local-pharmacy" size={20} color="#1976d2" />
            <Text style={styles.pharmacyTitle}>Assigned Pharmacy</Text>
            <View style={styles.countryTag}>
              <Text style={styles.countryTagText}>{business.country || 'USA'} ({business.currency || 'USD'})</Text>
            </View>
          </View>

          <Text style={styles.pharmacyName}>{business.name || 'MMS Pharmacy'}</Text>
          <Text style={styles.pharmacyCode}>Code: {business.code}</Text>

          <View style={styles.pharmacyDetails}>
            {business.pharmacistInChargeName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Pharmacist-In-Charge:</Text>
                <Text style={styles.detailValue}>{business.pharmacistInChargeName}</Text>
              </View>
            )}
            {business.licenseNumber && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Pharmacy License #:</Text>
                <Text style={styles.detailValue}>{business.licenseNumber}</Text>
              </View>
            )}
            {business.taxRegistrationNumber && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tax ID / TRN:</Text>
                <Text style={styles.detailValue}>{business.taxRegistrationNumber}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Menu Options */}
      <View style={styles.menuContainer}>
        {menuItems.map((item) => (
          <MenuItem key={item.id} item={item} />
        ))}
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Icon name="logout" size={22} color="#f44336" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#1976d2',
    paddingTop: 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  idBadge: {
    marginTop: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  idBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  pharmacyCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -15,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pharmacyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pharmacyTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1976d2',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countryTag: {
    marginLeft: 'auto',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  countryTagText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1d4ed8',
  },
  pharmacyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  pharmacyCode: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  pharmacyDetails: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f172a',
  },
  menuContainer: {
    backgroundColor: '#fff',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  logoutText: {
    fontSize: 14,
    color: '#f44336',
    marginLeft: 8,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;
