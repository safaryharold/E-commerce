import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { Package, ShoppingBag, Users, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import './AdminDashboard.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminDashboard() {
  const { getAuthHeader } = useAuth();
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'men',
    price: '',
    image_url: '',
    stock: ''
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === 'products') {
        const response = await axios.get(`${API}/products`);
        setProducts(response.data);
      } else {
        const response = await axios.get(`${API}/orders`, { headers: getAuthHeader() });
        setOrders(response.data.orders);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock)
      };

      if (editingProduct) {
        await axios.put(`${API}/products/${editingProduct.id}`, productData, { headers: getAuthHeader() });
        toast.success('Product updated!');
      } else {
        await axios.post(`${API}/products`, productData, { headers: getAuthHeader() });
        toast.success('Product created!');
      }

      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      await axios.delete(`${API}/products/${id}`, { headers: getAuthHeader() });
      toast.success('Product deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/orders/${orderId}/status?status=${status}`, {}, { headers: getAuthHeader() });
      toast.success('Order status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update order');
    }
  };

  const editProduct = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price.toString(),
      image_url: product.image_url,
      stock: product.stock.toString()
    });
    setShowProductForm(true);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', category: 'men', price: '', image_url: '', stock: '' });
    setEditingProduct(null);
    setShowProductForm(false);
  };

  return (
    <div className="admin-dashboard">
      <Navbar />
      
      <div className="admin-container">
        <h1 className="admin-title" data-testid="admin-title">Admin Dashboard</h1>

        <div className="admin-tabs" data-testid="admin-tabs">
          <button
            className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
            data-testid="products-tab"
          >
            <ShoppingBag size={20} /> Products
          </button>
          <button
            className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
            data-testid="orders-tab"
          >
            <Package size={20} /> Orders
          </button>
        </div>

        {activeTab === 'products' && (
          <div className="products-section" data-testid="products-section">
            <div className="section-header">
              <h2>Manage Products</h2>
              <button
                onClick={() => setShowProductForm(!showProductForm)}
                className="btn btn-primary"
                data-testid="add-product-button"
              >
                <Plus size={20} /> Add Product
              </button>
            </div>

            {showProductForm && (
              <form onSubmit={handleProductSubmit} className="product-form" data-testid="product-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Product Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="product-name-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      data-testid="product-category-select"
                    >
                      <option value="men">Men</option>
                      <option value="women">Women</option>
                      <option value="cardholder">Card Holder</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="3"
                    required
                    data-testid="product-description-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                      data-testid="product-price-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Stock</label>
                    <input
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      required
                      data-testid="product-stock-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Image URL</label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    required
                    data-testid="product-image-input"
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" data-testid="save-product-button">
                    <Save size={18} /> {editingProduct ? 'Update' : 'Create'} Product
                  </button>
                  <button type="button" onClick={resetForm} className="btn btn-outline" data-testid="cancel-button">
                    <X size={18} /> Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="products-table" data-testid="products-table">
              {products.map((product) => (
                <div key={product.id} className="product-row" data-testid={`product-row-${product.id}`}>
                  <img src={product.image_url} alt={product.name} />
                  <div className="product-details">
                    <h3 data-testid="product-name">{product.name}</h3>
                    <p className="product-category" data-testid="product-category">{product.category}</p>
                    <p className="product-price" data-testid="product-price">${product.price.toFixed(2)}</p>
                    <p className="product-stock" data-testid="product-stock">Stock: {product.stock}</p>
                  </div>
                  <div className="product-actions">
                    <button
                      onClick={() => editProduct(product)}
                      className="btn-icon"
                      data-testid="edit-product-button"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="btn-icon delete"
                      data-testid="delete-product-button"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="orders-section" data-testid="orders-section">
            <h2>Manage Orders</h2>
            
            <div className="orders-table">
              {orders.map((order) => (
                <div key={order.id} className="order-row" data-testid={`admin-order-${order.id}`}>
                  <div className="order-info">
                    <h3 data-testid="order-id">Order #{order.id.substring(0, 8)}</h3>
                    <p data-testid="order-email">Customer: {order.user_email}</p>
                    <p>Items: {order.items.length}</p>
                    <p data-testid="order-total">Total: ${order.total_amount.toFixed(2)}</p>
                    <p>City: {order.delivery_city}</p>
                    <p className="payment-status" data-testid="order-payment-status">
                      Payment: <span className={order.payment_status}>{order.payment_status}</span>
                    </p>
                  </div>
                  
                  <div className="order-actions">
                    <label htmlFor={`status-${order.id}`}>Status:</label>
                    <select
                      id={`status-${order.id}`}
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                      className="status-select"
                      data-testid="order-status-select"
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}