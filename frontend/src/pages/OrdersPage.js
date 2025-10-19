import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { Package, Clock, Truck, CheckCircle } from 'lucide-react';
import './OrdersPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STATUS_ICONS = {
  pending: Clock,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle
};

const STATUS_COLORS = {
  pending: '#f59e0b',
  processing: '#3b82f6',
  shipped: '#8b5cf6',
  delivered: '#22c55e'
};

export default function OrdersPage() {
  const { getAuthHeader } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`, { headers: getAuthHeader() });
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="orders-page">
        <Navbar />
        <div className="loading" data-testid="loading">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <Navbar />
      
      <div className="orders-container">
        <h1 className="orders-title" data-testid="orders-title">My Orders</h1>

        {orders.length === 0 ? (
          <div className="no-orders" data-testid="no-orders">
            <Package size={80} strokeWidth={1} />
            <h2>No orders yet</h2>
            <p>Start shopping to see your orders here</p>
          </div>
        ) : (
          <div className="orders-list" data-testid="orders-list">
            {orders.map((order) => {
              const StatusIcon = STATUS_ICONS[order.status] || Package;
              
              return (
                <div key={order.id} className="order-card" data-testid={`order-${order.id}`}>
                  <div className="order-header">
                    <div>
                      <p className="order-id" data-testid="order-id">Order #{order.id.substring(0, 8)}</p>
                      <p className="order-date" data-testid="order-date">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="order-status" style={{ color: STATUS_COLORS[order.status] }}>
                      <StatusIcon size={20} />
                      <span data-testid="order-status">{order.status}</span>
                    </div>
                  </div>

                  <div className="order-items">
                    {order.items.map((item, index) => (
                      <div key={index} className="order-item" data-testid={`order-item-${index}`}>
                        <span data-testid="item-name">{item.name}</span>
                        <span data-testid="item-quantity">x{item.quantity}</span>
                        <span data-testid="item-price">${item.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="order-delivery" data-testid="order-delivery">
                    <p><strong>Delivery:</strong> {order.delivery_city}</p>
                    <p>{order.delivery_address}</p>
                    <p>{order.delivery_phone}</p>
                  </div>

                  <div className="order-footer">
                    <div className="payment-status" data-testid="payment-status">
                      Payment: <span className={order.payment_status}>{order.payment_status}</span>
                    </div>
                    <div className="order-total" data-testid="order-total">
                      Total: <strong>${order.total_amount.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}