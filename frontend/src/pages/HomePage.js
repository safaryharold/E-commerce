import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Truck, Award } from 'lucide-react';
import Navbar from '../components/Navbar';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="home-page">
      <Navbar />
      
      {/* Hero Section */}
      <section className="hero" data-testid="hero-section">
        <div className="hero-content">
          <h1 className="hero-title" data-testid="hero-title">
            Crafted Leather
            <span className="hero-subtitle">Timeless Elegance</span>
          </h1>
          <p className="hero-description" data-testid="hero-description">
            Premium handcrafted leather wallets made from genuine leather.
            Experience the perfect blend of tradition and modern design.
          </p>
          <Link to="/products" className="btn btn-primary btn-hero" data-testid="shop-now-button">
            Shop Now <ArrowRight size={20} />
          </Link>
        </div>
        <div className="hero-image">
          <img 
            src="https://images.pexels.com/photos/982657/pexels-photo-982657.jpeg" 
            alt="Premium leather wallet"
            data-testid="hero-image"
          />
        </div>
      </section>

      {/* Features Section */}
      <section className="features" data-testid="features-section">
        <div className="container">
          <div className="features-grid">
            <div className="feature-card" data-testid="feature-quality">
              <div className="feature-icon">
                <Award size={40} />
              </div>
              <h3>Premium Quality</h3>
              <p>100% genuine leather sourced from the finest tanneries</p>
            </div>

            <div className="feature-card" data-testid="feature-delivery">
              <div className="feature-icon">
                <Truck size={40} />
              </div>
              <h3>Fast Delivery</h3>
              <p>Nationwide delivery across Pakistan's major cities</p>
            </div>

            <div className="feature-card" data-testid="feature-secure">
              <div className="feature-icon">
                <Shield size={40} />
              </div>
              <h3>Secure Payment</h3>
              <p>Multiple payment options with encrypted transactions</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="categories" data-testid="categories-section">
        <div className="container">
          <h2 className="section-title">Shop by Category</h2>
          <div className="categories-grid">
            <Link to="/products/category/men" className="category-card" data-testid="category-men">
              <img src="https://images.unsplash.com/photo-1627123424574-724758594e93?w=600" alt="Men's Wallets" />
              <div className="category-overlay">
                <h3>Men's Wallets</h3>
              </div>
            </Link>

            <Link to="/products/category/women" className="category-card" data-testid="category-women">
              <img src="https://images.unsplash.com/photo-1611688599669-e0d5a0497670?w=600" alt="Women's Wallets" />
              <div className="category-overlay">
                <h3>Women's Wallets</h3>
              </div>
            </Link>

            <Link to="/products/category/cardholder" className="category-card" data-testid="category-cardholder">
              <img src="https://images.unsplash.com/photo-1676276550349-580c49631496?w=600" alt="Card Holders" />
              <div className="category-overlay">
                <h3>Card Holders</h3>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>&copy; 2025 Leather Artisan. Crafted with passion in Pakistan.</p>
        </div>
      </footer>
    </div>
  );
}