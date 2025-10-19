import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { CheckCircle, Package, Loader } from 'lucide-react';
import './PaymentSuccessPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();
  const [status, setStatus] = useState('checking'); // checking, success, failed
  const [orderId, setOrderId] = useState(null);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      navigate('/cart');
      return;
    }

    checkPaymentStatus();
  }, [sessionId]);

  const checkPaymentStatus = async () => {
    let attempts = 0;
    const maxAttempts = 5;

    const poll = async () => {
      try {
        const response = await axios.get(
          `${API}/checkout/status/${sessionId}`,
          { headers: getAuthHeader() }
        );

        if (response.data.payment_status === 'paid') {
          setStatus('success');
          setOrderId(response.data.order_id);
          return;
        } else if (response.data.status === 'expired') {
          setStatus('failed');
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setStatus('failed');
        }
      } catch (error) {
        console.error('Error checking payment:', error);
        setStatus('failed');
      }
    };

    poll();
  };

  return (
    <div className="payment-success-page">
      <Navbar />
      
      <div className="payment-success-container">
        {status === 'checking' && (
          <div className="payment-status" data-testid="payment-checking">
            <Loader size={80} className="spinner" />
            <h1>Processing Payment...</h1>
            <p>Please wait while we confirm your payment</p>
          </div>
        )}

        {status === 'success' && (
          <div className="payment-status success" data-testid="payment-success">
            <CheckCircle size={80} strokeWidth={1.5} />
            <h1>Payment Successful!</h1>
            <p>Thank you for your order. Your payment has been confirmed.</p>
            
            {orderId && (
              <div className="order-info" data-testid="order-info">
                <Package size={24} />
                <div>
                  <p className="order-label">Order ID</p>
                  <p className="order-id" data-testid="order-id">{orderId}</p>
                </div>
              </div>
            )}

            <div className="action-buttons">
              <Link to="/orders" className="btn btn-primary" data-testid="view-orders-button">
                View My Orders
              </Link>
              <Link to="/products" className="btn btn-outline" data-testid="continue-shopping-button">
                Continue Shopping
              </Link>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="payment-status failed" data-testid="payment-failed">
            <h1>Payment Verification Failed</h1>
            <p>We couldn't verify your payment. Please check your orders or contact support.</p>
            
            <div className="action-buttons">
              <Link to="/orders" className="btn btn-primary" data-testid="check-orders-button">
                Check My Orders
              </Link>
              <Link to="/cart" className="btn btn-outline" data-testid="back-to-cart-button">
                Back to Cart
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}