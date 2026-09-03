import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [reorderedFromOrderId, setReorderedFromOrderId] = useState(null);
  const [loading, setLoading] = useState(false);

  const addToCart = (medicine, quantity = 1) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === medicine.id);
      
      if (existingItem) {
        return prevItems.map(item =>
          item.id === medicine.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        return [...prevItems, { ...medicine, quantity }];
      }
    });
  };

  const removeFromCart = (medicineId) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== medicineId));
  };

  const updateQuantity = (medicineId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(medicineId);
      return;
    }

    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === medicineId
          ? { ...item, quantity }
          : item
      )
    );
  };

  /**
   * Load items from a previous order into cart (Reorder functionality)
   * Pre-fills cart with items and quantities, allowing full editing before checkout
   */
  const loadCartItems = (items, fromOrderId = null) => {
    const formatted = items.map(i => ({
      id: i.medicineId || i.id,
      name: i.name || i.medicineName || `Medicine #${i.medicineId || i.id}`,
      price: parseFloat(i.price) || 0,
      quantity: parseInt(i.quantity, 10) || 1,
      imagePath: i.imagePath
    }));
    setCartItems(formatted);
    setReorderedFromOrderId(fromOrderId);
  };

  const clearCart = () => {
    setCartItems([]);
    setReorderedFromOrderId(null);
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getCartItemCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  const value = {
    cartItems,
    reorderedFromOrderId,
    addToCart,
    removeFromCart,
    updateQuantity,
    loadCartItems,
    clearCart,
    getCartTotal,
    getCartItemCount,
    loading,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
