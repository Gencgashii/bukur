import React, { createContext, useContext } from 'react';
import { API_URL } from '../config';

const OrdersContext = createContext();

export const useOrders = () => {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return context;
};

const ordersApi = `${API_URL.replace(/\/$/, '')}/store/custom/orders`;

/**
 * Order creation.
 *
 * There is NO local/offline "fake success" fallback. If the backend does not
 * confirm the order, this throws and the checkout UI must show a failure state
 * and keep the customer's cart. The frontend never decides an order or a
 * payment succeeded.
 */
export const OrdersProvider = ({ children }) => {
  const addOrder = async (orderData, { idempotencyKey } = {}) => {
    let response;
    try {
      response = await fetch(ordersApi, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: JSON.stringify(orderData),
      });
    } catch (networkError) {
      const err = new Error('We could not reach the store to place your order. Please try again.');
      err.cause = networkError;
      throw err;
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (_parseError) {
      payload = null;
    }

    if (!response.ok) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        'Your order could not be placed. Please review your details and try again.';
      const err = new Error(message);
      err.code = payload?.error?.code;
      err.status = response.status;
      throw err;
    }

    return payload;
  };

  return (
    <OrdersContext.Provider value={{ addOrder }}>
      {children}
    </OrdersContext.Provider>
  );
};
