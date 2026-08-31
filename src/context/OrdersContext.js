import React, { createContext, useContext, useEffect, useState } from 'react';
import { MEDUSA_URL } from '../config';

const OrdersContext = createContext();

export const useOrders = () => {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return context;
};

const getInitialOrders = () => {
  const saved = localStorage.getItem('bukur-orders');
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    // ignore and fall through
  }
  return [];
};

export const OrdersProvider = ({ children }) => {
  const [orders, setOrders] = useState(getInitialOrders);
  const ordersApi = `${MEDUSA_URL.replace(/\/$/, '')}/store/custom/orders`;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(ordersApi);
        if (!res.ok) return;
        const data = await res.json();
        setOrders(data);
      } catch (e) {
        console.error('Failed to load orders from server', e);
      }
    };

    load();
  }, []);

  const addOrder = async (orderData) => {
    try {
      const res = await fetch(ordersApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      if (res.ok) {
        const created = await res.json();
        setOrders((prev) => [created, ...prev]);
        return created;
      }
    } catch (e) {
      console.warn('Backend server unreachable, saving order locally:', e);
    }

    // Local Fallback order creation if backend server is not running
    const localOrder = {
      id: `#${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      emailSent: false,
      ...orderData,
    };

    setOrders((prev) => {
      const updated = [localOrder, ...prev];
      localStorage.setItem('bukur-orders', JSON.stringify(updated));
      return updated;
    });

    return localOrder;
  };

  const updateOrder = async (id, updates) => {
    try {
      const number = typeof id === 'string' && id.startsWith('#') ? id.slice(1) : id;
      const res = await fetch(`${ordersApi}/${number}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        return updated;
      }
    } catch (e) {
      console.warn('Backend server unreachable, updating order locally:', e);
    }

    setOrders((prev) => {
      const updated = prev.map((o) => (o.id === id ? { ...o, ...updates } : o));
      localStorage.setItem('bukur-orders', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <OrdersContext.Provider
      value={{
        orders,
        addOrder,
        updateOrder,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
};

