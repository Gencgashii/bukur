import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { CartProvider } from './context/CartContext';
import { ProductsProvider } from './context/ProductsContext';
import { OrdersProvider } from './context/OrdersContext';
import Header from './components/Header';
import Footer from './components/Footer';
import WelcomeScreen from './components/WelcomeScreen';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import About from './pages/About';
import AdminApp from './admin/AdminApp';
import './App.css';
import './luxury.css';

function AppLayout() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const isCheckout = location.pathname === '/checkout';
  const chrome = !isAdmin && !isCheckout;

  return (
    <>
      <ScrollToTop />
      {!isAdmin && <WelcomeScreen />}
      {chrome && <Header />}
      <main className="main-content">
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      {chrome && <Footer />}
    </>
  );
}

function App() {
  return (
    <LanguageProvider>
      <ProductsProvider>
        <CartProvider>
          <OrdersProvider>
            <Router>
              <div className="App">
                <AppLayout />
              </div>
            </Router>
          </OrdersProvider>
        </CartProvider>
      </ProductsProvider>
    </LanguageProvider>
  );
}

export default App;
