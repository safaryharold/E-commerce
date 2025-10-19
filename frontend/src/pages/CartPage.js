import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import './CartPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CartPage() {
  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      const response = await axios.get(`${API}/cart`, { headers: getAuthHeader() });
      setCart(response.data);
    } catch (error) {
      console.error('Error fetching cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (productId, newQuantity) => {
    try {
      await axios.put(`${API}/cart/${productId}?quantity=${newQuantity}`, {}, { headers: getAuthHeader() });
      fetchCart();
    } catch (error) {
      toast.error('Failed to update quantity');
    }
  };

  const removeItem = async (productId) => {
    try {
      await axios.delete(`${API}/cart/${productId}`, { headers: getAuthHeader() });
      toast.success('Item removed from cart');
      fetchCart();
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const calculateTotal = () => {
    return cart.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  };

  if (loading) {
    return (
      <div className="cart-page">
        <Navbar />
        <div className="loading" data-testid="loading">Loading cart...</div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <Navbar cartCount={cart.items.length} />
      
      <div className="cart-container">
        <h1 className="cart-title" data-testid="cart-title">Shopping Cart</h1>

        {cart.items.length === 0 ? (
          <div className="empty-cart" data-testid="empty-cart">
            <ShoppingBag size={80} strokeWidth={1} />
            <h2>Your cart is empty</h2>
            <p>Add some products to get started</p>
            <button onClick={() => navigate('/products')} className="btn btn-primary" data-testid="browse-products-button">
              Browse Products
            </button>
          </div>
        ) : (
          <div className="cart-content">
            <div className="cart-items" data-testid="cart-items">
              {cart.items.map((item) => (
                <div key={item.id} className="cart-item" data-testid={`cart-item-${item.product_id}`}>
                  <img src={item.product.image_url} alt={item.product.name} className="cart-item-image" />
                  
                  <div className="cart-item-details">
                    <h3 data-testid="cart-item-name">{item.product.name}</h3>
                    <p className="cart-item-category" data-testid="cart-item-category">{item.product.category}</p>
                    <p className="cart-item-price" data-testid="cart-item-price">${item.product.price.toFixed(2)}</p>
                  </div>

                  <div className="cart-item-actions">
                    <div className="quantity-controls">
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        data-testid="decrease-quantity"
                      >
                        <Minus size={16} />
                      </button>
                      <span data-testid="item-quantity">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.stock}
                        data-testid="increase-quantity"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.product_id)}
                      className="remove-btn"
                      data-testid="remove-item-button"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-summary" data-testid="cart-summary">
              <h2>Order Summary</h2>
              
              <div className="summary-row">
                <span>Subtotal</span>
                <span data-testid="subtotal">${calculateTotal().toFixed(2)}</span>
              </div>
              
              <div className="summary-row">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              
              <div className="summary-divider"></div>
              
              <div className="summary-row summary-total">
                <span>Total</span>
                <span data-testid="total">${calculateTotal().toFixed(2)}</span>
              </div>

              <button
                onClick={() => navigate('/checkout')}
                className="btn btn-primary checkout-btn"
                data-testid="checkout-button"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}