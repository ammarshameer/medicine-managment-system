import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Import screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import MedicinesScreen from './src/screens/MedicinesScreen';
import CartScreen from './src/screens/CartScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MedicineDetailScreen from './src/screens/MedicineDetailScreen';
import PrescriptionScreen from './src/screens/PrescriptionScreen';

// Import context
import { AuthProvider } from './src/contexts/AuthContext';
import { CartProvider } from './src/contexts/CartContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Medicines') {
            iconName = 'medication';
          } else if (route.name === 'Cart') {
            iconName = 'shopping-cart';
          } else if (route.name === 'Orders') {
            iconName = 'receipt';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Medicines" component={MedicinesScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const App = () => {
  return (
    <PaperProvider>
      <AuthProvider>
        <CartProvider>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Login">
              <Stack.Screen 
                name="Login" 
                component={LoginScreen} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Register" 
                component={RegisterScreen} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Main" 
                component={MainTabNavigator} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="MedicineDetail" 
                component={MedicineDetailScreen}
                options={{ title: 'Medicine Details' }}
              />
              <Stack.Screen 
                name="Prescription" 
                component={PrescriptionScreen}
                options={{ title: 'Prescription' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </CartProvider>
      </AuthProvider>
    </PaperProvider>
  );
};

export default App;
