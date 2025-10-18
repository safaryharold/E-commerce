import { Link } from 'react-router-dom';
import { ShoppingCart, User, LogOut, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar({ cartCount = 0 }) {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar" data-testid="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand" data-testid="navbar-brand">
          <span className="brand-text">Leather Artisan</span>
        </Link>

        <div className="navbar-links">
          <Link to="/products" className="nav-link" data-testid="nav-products-link">
            Products
          </Link>

          {user && (
            <>
              <Link to="/cart" className="nav-link cart-link" data-testid="nav-cart-link">
                <ShoppingCart size={20} />
                {cartCount > 0 && <span className="cart-badge" data-testid="cart-badge">{cartCount}</span>}
              </Link>

              <Link to="/orders" className="nav-link" data-testid="nav-orders-link">
                <Package size={20} />
              </Link>

              {user.role === 'admin' && (
                <Link to="/admin" className="nav-link" data-testid="nav-admin-link">
                  Admin
                </Link>
              )}

              <div className="user-menu">
                <span className="user-name" data-testid="user-name">{user.name}</span>
                <button onClick={logout} className="btn-logout" data-testid="logout-button">
                  <LogOut size={18} />
                </button>
              </div>
            </>
          )}

          {!user && (
            <Link to="/login" className="btn btn-primary" data-testid="login-link">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}