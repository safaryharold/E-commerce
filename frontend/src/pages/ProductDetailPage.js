import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import './ProductDetailPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, getAuthHeader } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const response = await axios.get(`${API}/products/${id}`);
      setProduct(response.data);
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Product not found');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async () => {
    if (!user) {
      toast.error('Please login to add items to cart');
      navigate('/login');
      return;
    }

    setAdding(true);
    try {
      await axios.post(
        `${API}/cart`,
        { product_id: product.id, quantity },
        { headers: getAuthHeader() }
      );
      toast.success('Added to cart!');
      navigate('/cart');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add to cart');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="product-detail-page">
        <Navbar />
        <div className="loading" data-testid="loading">Loading...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-detail-page">
        <Navbar />
        <div className="error" data-testid="error">Product not found</div>
      </div>
    );
  }

  return (
    <div className="product-detail-page">
      <Navbar />
      
      <div className="product-detail-container">
        <button onClick={() => navigate(-1)} className="back-button" data-testid="back-button">
          <ArrowLeft size={20} /> Back
        </button>

        <div className="product-detail-grid">
          <div className="product-detail-image">
            <img src={product.image_url} alt={product.name} data-testid="product-image" />
          </div>

          <div className="product-detail-info">
            <p className="product-category" data-testid="product-category">{product.category}</p>
            <h1 className="product-title" data-testid="product-title">{product.name}</h1>
            <p className="product-price" data-testid="product-price">${product.price.toFixed(2)}</p>
            
            <div className="product-description" data-testid="product-description">
              <h3>Description</h3>
              <p>{product.description}</p>
            </div>

            <div className="product-stock" data-testid="product-stock">
              {product.stock > 0 ? (
                <span className="in-stock">In Stock ({product.stock} available)</span>
              ) : (
                <span className="out-stock">Out of Stock</span>
              )}
            </div>

            <div className="quantity-selector">
              <label htmlFor="quantity">Quantity:</label>
              <input
                id="quantity"
                type="number"
                min="1"
                max={product.stock}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1)))}
                disabled={product.stock === 0}
                data-testid="quantity-input"
              />
            </div>

            <button
              onClick={addToCart}
              disabled={product.stock === 0 || adding}
              className="btn btn-primary add-to-cart-btn"
              data-testid="add-to-cart-button"
            >
              <ShoppingCart size={20} />
              {adding ? 'Adding...' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}