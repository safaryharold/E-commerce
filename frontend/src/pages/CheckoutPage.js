import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { MapPin, Phone, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import './CheckoutPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PAKISTANI_CITIES = [
  'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad',
  'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala'
];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData] = useState({
    delivery_city: 'Karachi',
    delivery_address: '',
    delivery_phone: ''
  });

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      const response = await axios.get(`${API}/cart`, { headers: getAuthHeader() });
      setCart(response.data);
      
      if (response.data.items.length === 0) {
        toast.error('Your cart is empty');
        navigate('/cart');
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return cart.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    setProcessing(true);

    try {
      // Create order
      const orderResponse = await axios.post(
        `${API}/orders`,
        formData,
        { headers: getAuthHeader() }
      );

      const { order_id } = orderResponse.data;

      // Create checkout session
      const sessionResponse = await axios.post(
        `${API}/checkout/session`,
        {
          order_id,
          origin_url: window.location.origin
        },
        { headers: getAuthHeader() }
      );

      // Redirect to Stripe
      window.location.href = sessionResponse.data.url;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Checkout failed');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="checkout-page">
        <Navbar />
        <div className="loading" data-testid="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <Navbar />
      
      <div className="checkout-container">
        <h1 className="checkout-title" data-testid="checkout-title">Checkout</h1>

        <div className="checkout-content">
          <form onSubmit={handleCheckout} className="checkout-form" data-testid="checkout-form">
            <div className="form-section">
              <h2>Delivery Information</h2>

              <div className="form-group">
                <label htmlFor="city">
                  <MapPin size={18} /> Delivery City
                </label>
                <select
                  id="city"
                  value={formData.delivery_city}
                  onChange={(e) => setFormData({ ...formData, delivery_city: e.target.value })}
                  required
                  data-testid="city-select"
                >
                  {PAKISTANI_CITIES.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="address">
                  <MapPin size={18} /> Delivery Address
                </label>
                <textarea
                  id="address"
                  value={formData.delivery_address}
                  onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                  placeholder="Enter your complete address"
                  rows="3"
                  required
                  data-testid="address-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">
                  <Phone size={18} /> Contact Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.delivery_phone}
                  onChange={(e) => setFormData({ ...formData, delivery_phone: e.target.value })}
                  placeholder="03XX-XXXXXXX"
                  required
                  data-testid="phone-input"
                />
              </div>
            </div>

            <div className="form-section">
              <h2>Payment Method</h2>
              <div className="payment-info">
                <CreditCard size={24} />
                <div>
                  <p><strong>Stripe Payment Gateway</strong></p>
                  <p className="payment-desc">Secure payment with Stripe (International cards supported)</p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary submit-btn"
              disabled={processing}
              data-testid="submit-button"
            >
              {processing ? 'Processing...' : `Pay $${calculateTotal().toFixed(2)}`}
            </button>
          </form>

          <div className="order-summary" data-testid="order-summary">
            <h2>Order Summary</h2>
            
            <div className="summary-items">
              {cart.items.map((item) => (
                <div key={item.id} className="summary-item" data-testid={`summary-item-${item.product_id}`}>
                  <img src={item.product.image_url} alt={item.product.name} />
                  <div className="summary-item-details">
                    <p className="item-name">{item.product.name}</p>
                    <p className="item-quantity">Qty: {item.quantity}</p>
                  </div>
                  <p className="item-price">${(item.product.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>

            <div className="summary-divider"></div>

            <div className="summary-row">
              <span>Subtotal</span>
              <span data-testid="subtotal">${calculateTotal().toFixed(2)}</span>
            </div>

            <div className="summary-row summary-total">
              <span>Total</span>
              <span data-testid="total">${calculateTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}