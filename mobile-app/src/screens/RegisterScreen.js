import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../contexts/AuthContext';

const RegisterScreen = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    businessCode: '',
  });
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { register } = useAuth();

  const handleRegister = async () => {
    const { name, email, phone, password, confirmPassword, businessCode } = formData;

    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!businessCode) {
      Alert.alert('Error', 'Please enter a pharmacy/business code');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const result = await register({ name, email, phone, password, businessCode });
    setLoading(false);

    if (result.success) {
      // Navigation will be handled by the auth state change
    } else {
      Alert.alert('Registration Failed', result.message);
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="person-add" size={60} color="#1976d2" />
        <Text style={styles.title}>Register</Text>
        <Text style={styles.subtitle}>Create your account</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Icon name="person" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={formData.name}
            onChangeText={(value) => updateFormData('name', value)}
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="email" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={formData.email}
            onChangeText={(value) => updateFormData('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="phone" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Phone (Optional)"
            value={formData.phone}
            onChangeText={(value) => updateFormData('phone', value)}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="store" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Pharmacy Code *"
            value={formData.businessCode}
            onChangeText={(value) => updateFormData('businessCode', value)}
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="lock" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={formData.password}
            onChangeText={(value) => updateFormData('password', value)}
            secureTextEntry
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="lock" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChangeText={(value) => updateFormData('confirmPassword', value)}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[styles.registerButton, loading && styles.disabledButton]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.registerButtonText}>Register</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>
            Already have an account? Login
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
  },
  registerButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#1976d2',
    fontSize: 16,
  },
});

export default RegisterScreen;
