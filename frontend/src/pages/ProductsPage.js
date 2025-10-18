import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { Filter } from 'lucide-react';
import './ProductsPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category');

  useEffect(() => {
    fetchProducts();
  }, [category]);

  const fetchProducts = async () => {
    try {
      const url = category ? `${API}/products?category=${category}` : `${API}/products`;
      const response = await axios.get(url);
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterByCategory = (cat) => {
    if (cat) {
      setSearchParams({ category: cat });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="products-page">
      <Navbar />
      
      <div className="products-container">
        <div className="products-header">
          <h1 className="products-title" data-testid="products-title">Our Collection</h1>
          
          <div className="filter-buttons" data-testid="filter-buttons">
            <button 
              className={`filter-btn ${!category ? 'active' : ''}`}
              onClick={() => filterByCategory(null)}
              data-testid="filter-all"
            >
              All
            </button>
            <button 
              className={`filter-btn ${category === 'men' ? 'active' : ''}`}
              onClick={() => filterByCategory('men')}
              data-testid="filter-men"
            >
              Men
            </button>
            <button 
              className={`filter-btn ${category === 'women' ? 'active' : ''}`}
              onClick={() => filterByCategory('women')}
              data-testid="filter-women"
            >
              Women
            </button>
            <button 
              className={`filter-btn ${category === 'cardholder' ? 'active' : ''}`}
              onClick={() => filterByCategory('cardholder')}
              data-testid="filter-cardholder"
            >
              Card Holders
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading" data-testid="loading">Loading products...</div>
        ) : (
          <div className="products-grid" data-testid="products-grid">
            {products.map((product) => (
              <Link
                key={product.id}
                to={`/products/${product.id}`}
                className="product-card"
                data-testid={`product-card-${product.id}`}
              >
                <div className="product-image">
                  <img src={product.image_url} alt={product.name} />
                </div>
                <div className="product-info">
                  <h3 className="product-name" data-testid="product-name">{product.name}</h3>
                  <p className="product-category" data-testid="product-category">{product.category}</p>
                  <p className="product-price" data-testid="product-price">${product.price.toFixed(2)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && products.length === 0 && (
          <div className="no-products" data-testid="no-products">
            <p>No products found in this category.</p>
          </div>
        )}
      </div>
    </div>
  );
}