import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { CartProvider } from './context/CartContext';
import { ProductsProvider } from './context/ProductsContext';
import { OrdersProvider } from './context/OrdersContext';
import ErrorBoundary from './components/ErrorBoundary';
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
import FAQ from './pages/FAQ';
import Contact from './pages/Contact';
import LegalPage from './pages/LegalPage';
import './App.css';
import './luxury.css';

// Admin CMS is code-split out of the storefront bundle — shoppers never download it.
const AdminApp = lazy(() => import('./admin/AdminApp'));

function AppLayout() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const isCheckout = location.pathname === '/checkout';
  const chrome = !isAdmin && !isCheckout;

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <ScrollToTop />
      {!isAdmin && <WelcomeScreen />}
      {chrome && <Header />}
      <main className="main-content" id="main">
        <ErrorBoundary>
          <Routes>
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<div className="ad-boot">Loading BUKUR admin…</div>}>
                  <AdminApp />
                </Suspense>
              }
            />
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Products />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/terms" element={<LegalPage doc="terms" />} />
            <Route path="/privacy" element={<LegalPage doc="privacy" />} />
            <Route path="/cookies" element={<LegalPage doc="cookies" />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </ErrorBoundary>
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
