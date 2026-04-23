import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { Smartphone, Lock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import './MockPaymentPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BRAND = {
  jazzcash: { name: 'JazzCash', color: '#d91e18', logo: 'JC' },
  easypaisa: { name: 'EasyPaisa', color: '#00a651', logo: 'EP' },
};

export default function MockPaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();
  const orderId = searchParams.get('order_id');
  const method = searchParams.get('method');

  const [order, setOrder] = useState(null);
  const [mobile, setMobile] = useState('03');
  const [cnic, setCnic] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1 = details, 2 = otp
  const [submitting, setSubmitting] = useState(false);

  const brand = BRAND[method];

  useEffect(() => {
    if (!orderId || !brand) {
      navigate('/cart');
      return;
    }
    const fetchOrder = async () => {
      try {
        const res = await axios.get(`${API}/orders/${orderId}`, { headers: getAuthHeader() });
        setOrder(res.data);
      } catch (e) {
        toast.error('Order not found');
        navigate('/cart');
      }
    };
    fetchOrder();
  }, [orderId, method]);

  const submitWalletDetails = (e) => {
    e.preventDefault();
    if (!/^03\d{9}$/.test(mobile)) {
      toast.error('Enter a valid Pakistani mobile number (03XXXXXXXXX)');
      return;
    }
    if (!/^\d{4}$/.test(cnic)) {
      toast.error('Enter last 4 digits of your CNIC');
      return;
    }
    // Simulate OTP sent
    toast.success(`OTP sent to ${mobile} (hint: 1234)`);
    setStep(2);
  };

  const confirmPayment = async (e) => {
    e.preventDefault();
    if (otp !== '1234') {
      toast.error('Invalid OTP. For this mock, use 1234.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(
        `${API}/payments/mock/initiate`,
        { order_id: orderId, method, mobile_number: mobile, cnic_last4: cnic },
        { headers: getAuthHeader() }
      );
      toast.success(`Payment successful via ${brand.name}!`);
      navigate(`/payment/success?mock=1&order_id=${orderId}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Payment failed');
      setSubmitting(false);
    }
  };

  if (!brand || !order) {
    return (
      <div className="mock-payment-page">
        <Navbar />
        <div className="loading" data-testid="loading">Loading payment…</div>
      </div>
    );
  }

  return (
    <div className="mock-payment-page">
      <Navbar />
      <div className="mock-container">
        <div className="mock-card" style={{ '--brand': brand.color }}>
          <div className="mock-header" data-testid="mock-header">
            <div className="brand-logo" aria-hidden>{brand.logo}</div>
            <div>
              <h2 data-testid="brand-name">{brand.name}</h2>
              <p className="mock-note">Simulated gateway — no real money is charged</p>
            </div>
          </div>

          <div className="mock-amount" data-testid="mock-amount">
            <span>Amount</span>
            <strong>${order.total_amount.toFixed(2)}</strong>
          </div>

          {step === 1 && (
            <form onSubmit={submitWalletDetails} data-testid="wallet-form">
              <label htmlFor="mobile">
                <Smartphone size={16} /> Mobile Wallet Number
              </label>
              <input
                id="mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="03XXXXXXXXX"
                maxLength={11}
                required
                data-testid="mobile-input"
              />

              <label htmlFor="cnic">
                <Lock size={16} /> CNIC Last 4 Digits
              </label>
              <input
                id="cnic"
                value={cnic}
                onChange={(e) => setCnic(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                maxLength={4}
                required
                data-testid="cnic-input"
              />

              <button type="submit" className="btn-pay" data-testid="send-otp-button">
                Send OTP
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={confirmPayment} data-testid="otp-form">
              <label htmlFor="otp">Enter OTP (use 1234)</label>
              <input
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                maxLength={4}
                required
                data-testid="otp-input"
              />

              <button
                type="submit"
                className="btn-pay"
                disabled={submitting}
                data-testid="confirm-payment-button"
              >
                <CheckCircle2 size={18} /> {submitting ? 'Confirming…' : `Pay $${order.total_amount.toFixed(2)}`}
              </button>
            </form>
          )}

          <button
            className="btn-cancel"
            onClick={() => navigate('/cart')}
            data-testid="cancel-mock-payment"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
