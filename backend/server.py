from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Helper function to generate slug
def generate_slug(name: str) -> str:
    """Generate SEO-friendly slug from product name"""
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_DAYS = 7

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# Create the main app without a prefix
# docs_url/openapi_url are prefixed with /api so they're reachable through
# the Kubernetes ingress (which only forwards /api/* to this service).
app = FastAPI(
    title="Leather Wallet Shop API",
    version="1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {
        "message": "Leather Wallet Shop API",
        "version": "1.0",
        "endpoints": {
            "products": {
                "GET /api/products": "Get all products",
                "GET /api/products/category/{category}": "Get products by category (men/women/cardholder)",
                "GET /api/products/{slug}": "Get product by slug",
                "POST /api/products": "Create product (Admin only)",
                "PUT /api/products/{id}": "Update product (Admin only)",
                "DELETE /api/products/{id}": "Delete product (Admin only)"
            },
            "auth": {
                "POST /api/auth/register": "Register new user",
                "POST /api/auth/login": "Login with email/password",
                "POST /api/auth/session": "Process Google OAuth session",
                "POST /api/auth/logout": "Logout",
                "GET /api/auth/me": "Get current user"
            },
            "cart": {
                "GET /api/cart": "Get cart items (Auth required)",
                "POST /api/cart": "Add to cart (Auth required)",
                "PUT /api/cart/{product_id}": "Update cart quantity (Auth required)",
                "DELETE /api/cart/{product_id}": "Remove from cart (Auth required)"
            },
            "orders": {
                "GET /api/orders": "Get orders (Auth required)",
                "GET /api/orders/{id}": "Get order by ID (Auth required)",
                "POST /api/orders": "Create order (Auth required)",
                "PUT /api/orders/{id}/status": "Update order status (Admin only)"
            },
            "checkout": {
                "POST /api/checkout/session": "Create Stripe checkout session (Auth required)",
                "GET /api/checkout/status/{session_id}": "Get payment status (Auth required)"
            },
            "admin": {
                "POST /api/seed": "Seed database with sample data"
            }
        },
        "admin_credentials": {
            "email": "admin@leatherwallet.pk",
            "password": "admin123"
        }
    }
# ============ MODELS ============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    password_hash: Optional[str] = None
    picture: Optional[str] = None
    role: str = "customer"  # customer or admin
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str = ""  # SEO-friendly URL slug
    description: str
    category: str  # men, women, cardholder
    price: float
    image_url: str
    stock: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    slug: str = ""
    description: str
    category: str
    price: float
    image_url: str
    stock: int = 0

class CartItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    product_id: str
    quantity: int
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CartItemAdd(BaseModel):
    product_id: str
    quantity: int = 1

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_email: str
    items: List[Dict]
    total_amount: float
    delivery_city: str
    delivery_address: str
    delivery_phone: str
    status: str = "pending"  # pending, processing, shipped, delivered
    payment_method: str = "stripe"  # stripe, jazzcash, easypaisa, cod
    payment_status: str = "pending"  # pending, paid, failed
    payment_session_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderCreate(BaseModel):
    delivery_city: str
    delivery_address: str
    delivery_phone: str
    payment_method: str = "stripe"  # stripe, jazzcash, easypaisa, cod

class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    order_id: str
    user_id: str
    amount: float
    currency: str
    payment_status: str
    status: str
    metadata: Optional[Dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AuthSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ AUTH HELPERS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, email: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(request: Request) -> dict:
    # Try cookie first
    token = request.cookies.get('session_token')
    
    # Fallback to Authorization header
    if not token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if it's a session token (from Google OAuth)
    session = await db.auth_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        if datetime.fromisoformat(session['expires_at']) > datetime.now(timezone.utc):
            user = await db.users.find_one({"id": session['user_id']}, {"_id": 0})
            if user:
                return user
        else:
            raise HTTPException(status_code=401, detail="Session expired")
    
    # Try JWT token
    payload = decode_jwt_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============ AUTH ROUTES ============

@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        password_hash=hash_password(user_data.password),
        role="customer"
    )
    
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    token = create_jwt_token(user.id, user.email)
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not user.get('password_hash'):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user['id'], user['email'])
    return {"token": token, "user": {"id": user['id'], "email": user['email'], "name": user['name'], "role": user['role']}}

@api_router.post("/auth/session")
async def create_session(request: Request):
    """Process Google OAuth session_id and create backend session"""
    session_id = request.headers.get('X-Session-ID')
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    # Call Emergent Auth API
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.get(
            'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
            headers={'X-Session-ID': session_id}
        ) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            data = await resp.json()
    
    # Check if user exists
    user = await db.users.find_one({"email": data['email']}, {"_id": 0})
    
    if not user:
        # Create new user
        user = User(
            email=data['email'],
            name=data.get('name', ''),
            picture=data.get('picture'),
            role="customer"
        )
        doc = user.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.users.insert_one(doc)
        user = doc
    
    # Create backend session
    session_token = data['session_token']
    auth_session = AuthSession(
        user_id=user['id'],
        session_token=session_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    
    session_doc = auth_session.model_dump()
    session_doc['expires_at'] = session_doc['expires_at'].isoformat()
    session_doc['created_at'] = session_doc['created_at'].isoformat()
    await db.auth_sessions.insert_one(session_doc)
    
    return {
        "session_token": session_token,
        "user": {
            "id": user['id'],
            "email": user['email'],
            "name": user['name'],
            "picture": user.get('picture'),
            "role": user['role']
        }
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get('session_token')
    if token:
        await db.auth_sessions.delete_one({"session_token": token})
    response.delete_cookie('session_token', path='/', secure=True, samesite='none')
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {"user": {"id": user['id'], "email": user['email'], "name": user['name'], "role": user['role'], "picture": user.get('picture')}}

# ============ PRODUCT ROUTES ============

@api_router.get("/products", response_model=List[Product])
async def get_products(category: Optional[str] = None):
    query = {"category": category} if category else {}
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    return products

@api_router.get("/products/category/{category}")
async def get_products_by_category(category: str):
    """Get products by category using path parameter"""
    products = await db.products.find({"category": category}, {"_id": 0}).to_list(1000)
    return products

@api_router.get("/products/{product_slug}")
async def get_product(product_slug: str):
    # Try to find by slug first
    product = await db.products.find_one({"slug": product_slug}, {"_id": 0})
    
    # Fallback to ID for backward compatibility
    if not product:
        product = await db.products.find_one({"id": product_slug}, {"_id": 0})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@api_router.post("/products", response_model=Product)
async def create_product(product_data: ProductCreate, user: dict = Depends(get_admin_user)):
    # Auto-generate slug if not provided
    if not product_data.slug:
        product_data.slug = generate_slug(product_data.name)
    
    product = Product(**product_data.model_dump())
    doc = product.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.products.insert_one(doc)
    return product

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, product_data: ProductCreate, user: dict = Depends(get_admin_user)):
    # Auto-generate slug if not provided
    if not product_data.slug:
        product_data.slug = generate_slug(product_data.name)
    
    result = await db.products.update_one(
        {"id": product_id},
        {"$set": product_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product updated"}

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(get_admin_user)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

# ============ CART ROUTES ============

@api_router.get("/cart")
async def get_cart(user: dict = Depends(get_current_user)):
    cart_items = await db.cart.find({"user_id": user['id']}, {"_id": 0}).to_list(1000)
    
    # Populate with product details
    items_with_products = []
    for item in cart_items:
        product = await db.products.find_one({"id": item['product_id']}, {"_id": 0})
        if product:
            items_with_products.append({
                **item,
                "product": product
            })
    
    return {"items": items_with_products}

@api_router.post("/cart")
async def add_to_cart(item_data: CartItemAdd, user: dict = Depends(get_current_user)):
    # Check if product exists
    product = await db.products.find_one({"id": item_data.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if already in cart
    existing = await db.cart.find_one({"user_id": user['id'], "product_id": item_data.product_id}, {"_id": 0})
    
    if existing:
        # Update quantity
        new_quantity = existing['quantity'] + item_data.quantity
        await db.cart.update_one(
            {"user_id": user['id'], "product_id": item_data.product_id},
            {"$set": {"quantity": new_quantity}}
        )
    else:
        # Add new item
        cart_item = CartItem(
            user_id=user['id'],
            product_id=item_data.product_id,
            quantity=item_data.quantity
        )
        doc = cart_item.model_dump()
        doc['added_at'] = doc['added_at'].isoformat()
        await db.cart.insert_one(doc)
    
    return {"message": "Added to cart"}

@api_router.delete("/cart/{product_id}")
async def remove_from_cart(product_id: str, user: dict = Depends(get_current_user)):
    result = await db.cart.delete_one({"user_id": user['id'], "product_id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not in cart")
    return {"message": "Removed from cart"}

@api_router.put("/cart/{product_id}")
async def update_cart_quantity(product_id: str, quantity: int, user: dict = Depends(get_current_user)):
    if quantity <= 0:
        return await remove_from_cart(product_id, user)
    
    result = await db.cart.update_one(
        {"user_id": user['id'], "product_id": product_id},
        {"$set": {"quantity": quantity}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not in cart")
    return {"message": "Cart updated"}

# ============ ORDER ROUTES ============

@api_router.post("/orders")
async def create_order(order_data: OrderCreate, user: dict = Depends(get_current_user)):
    # Get cart items
    cart_items = await db.cart.find({"user_id": user['id']}, {"_id": 0}).to_list(1000)
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Calculate total and get product details
    items = []
    total = 0.0
    for cart_item in cart_items:
        product = await db.products.find_one({"id": cart_item['product_id']}, {"_id": 0})
        if product:
            item_total = product['price'] * cart_item['quantity']
            total += item_total
            items.append({
                "product_id": product['id'],
                "name": product['name'],
                "price": product['price'],
                "quantity": cart_item['quantity'],
                "subtotal": item_total
            })
    
    # Create order
    order = Order(
        user_id=user['id'],
        user_email=user['email'],
        items=items,
        total_amount=total,
        delivery_city=order_data.delivery_city,
        delivery_address=order_data.delivery_address,
        delivery_phone=order_data.delivery_phone,
        payment_method=order_data.payment_method,
    )
    
    doc = order.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.orders.insert_one(doc)
    
    # Clear cart
    await db.cart.delete_many({"user_id": user['id']})
    
    return {"order_id": order.id, "total_amount": total}

@api_router.get("/orders")
async def get_orders(user: dict = Depends(get_current_user)):
    if user['role'] == 'admin':
        orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    else:
        orders = await db.orders.find({"user_id": user['id']}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"orders": orders}

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check authorization
    if user['role'] != 'admin' and order['user_id'] != user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return order

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, user: dict = Depends(get_admin_user)):
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order status updated"}

# ============ PAYMENT ROUTES ============

@api_router.post("/checkout/session")
async def create_checkout_session(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    order_id = body.get('order_id')
    origin_url = body.get('origin_url')
    
    if not order_id or not origin_url:
        raise HTTPException(status_code=400, detail="order_id and origin_url required")
    
    # Get order
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check authorization
    if order['user_id'] != user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Initialize Stripe
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create checkout session
    success_url = f"{origin_url}/payment/success?session_id={{{{CHECKOUT_SESSION_ID}}}}"
    cancel_url = f"{origin_url}/cart"
    
    checkout_request = CheckoutSessionRequest(
        amount=float(order['total_amount']),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "order_id": order_id,
            "user_id": user['id']
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction
    transaction = PaymentTransaction(
        session_id=session.session_id,
        order_id=order_id,
        user_id=user['id'],
        amount=float(order['total_amount']),
        currency="usd",
        payment_status="pending",
        status="initiated",
        metadata=checkout_request.metadata
    )
    
    trans_doc = transaction.model_dump()
    trans_doc['created_at'] = trans_doc['created_at'].isoformat()
    trans_doc['updated_at'] = trans_doc['updated_at'].isoformat()
    await db.payment_transactions.insert_one(trans_doc)
    
    # Update order with session ID
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"payment_session_id": session.session_id}}
    )
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, user: dict = Depends(get_current_user)):
    # Check if transaction exists
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Check if already processed
    if transaction['payment_status'] == 'paid':
        return {
            "status": transaction['status'],
            "payment_status": transaction['payment_status'],
            "order_id": transaction['order_id']
        }
    
    # Initialize Stripe
    host_url = str(os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001'))
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Get status from Stripe
    checkout_status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": checkout_status.payment_status,
            "status": checkout_status.status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update order if paid
    if checkout_status.payment_status == 'paid':
        await db.orders.update_one(
            {"id": transaction['order_id']},
            {"$set": {
                "payment_status": "paid",
                "status": "processing"
            }}
        )
    
    return {
        "status": checkout_status.status,
        "payment_status": checkout_status.payment_status,
        "order_id": transaction['order_id']
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    # Initialize Stripe
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Update transaction
        if webhook_response.session_id:
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {
                    "payment_status": webhook_response.payment_status,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Update order if paid
            if webhook_response.payment_status == 'paid':
                transaction = await db.payment_transactions.find_one({"session_id": webhook_response.session_id}, {"_id": 0})
                if transaction:
                    await db.orders.update_one(
                        {"id": transaction['order_id']},
                        {"$set": {
                            "payment_status": "paid",
                            "status": "processing"
                        }}
                    )
        
        return {"status": "success"}
    except Exception as e:
        logging.error(f"Webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ============ MOCK LOCAL PAYMENTS (JazzCash / EasyPaisa / COD) ============
# These are simulated flows for development/testing. In production these would
# be replaced with real JazzCash/EasyPaisa merchant integrations.

class MockPayRequest(BaseModel):
    order_id: str
    method: str  # jazzcash | easypaisa | cod
    mobile_number: Optional[str] = None  # mock wallet number
    cnic_last4: Optional[str] = None     # mock CNIC (JazzCash/EasyPaisa require this)

@api_router.post("/payments/mock/initiate")
async def mock_payment_initiate(payload: MockPayRequest, user: dict = Depends(get_current_user)):
    """Simulate a JazzCash/EasyPaisa/COD transaction. No real money moves."""
    if payload.method not in {"jazzcash", "easypaisa", "cod"}:
        raise HTTPException(status_code=400, detail="Unsupported payment method")

    order = await db.orders.find_one({"id": payload.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order['user_id'] != user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Basic mock validation for wallet methods
    if payload.method in {"jazzcash", "easypaisa"}:
        if not payload.mobile_number or len(payload.mobile_number) < 10:
            raise HTTPException(status_code=400, detail="Valid mobile number required")
        if not payload.cnic_last4 or len(payload.cnic_last4) != 4:
            raise HTTPException(status_code=400, detail="Last 4 digits of CNIC required")

    mock_session_id = f"MOCK-{payload.method.upper()}-{uuid.uuid4().hex[:12]}"

    # Record a payment transaction row for traceability
    transaction = PaymentTransaction(
        session_id=mock_session_id,
        order_id=payload.order_id,
        user_id=user['id'],
        amount=float(order['total_amount']),
        currency="pkr",
        payment_status="paid" if payload.method != "cod" else "pending",
        status="completed" if payload.method != "cod" else "initiated",
        metadata={"method": payload.method, "mock": True},
    )
    trans_doc = transaction.model_dump()
    trans_doc['created_at'] = trans_doc['created_at'].isoformat()
    trans_doc['updated_at'] = trans_doc['updated_at'].isoformat()
    await db.payment_transactions.insert_one(trans_doc)

    # For wallets: instantly mark as paid. For COD: keep pending until delivered.
    if payload.method in {"jazzcash", "easypaisa"}:
        await db.orders.update_one(
            {"id": payload.order_id},
            {"$set": {
                "payment_status": "paid",
                "status": "processing",
                "payment_method": payload.method,
                "payment_session_id": mock_session_id,
            }}
        )
    else:  # cod
        await db.orders.update_one(
            {"id": payload.order_id},
            {"$set": {
                "payment_status": "pending",
                "status": "processing",
                "payment_method": "cod",
                "payment_session_id": mock_session_id,
            }}
        )

    return {
        "session_id": mock_session_id,
        "method": payload.method,
        "payment_status": "paid" if payload.method != "cod" else "pending",
        "order_id": payload.order_id,
        "message": f"Mock {payload.method.upper()} transaction successful" if payload.method != "cod" else "Cash on Delivery order placed",
    }

# ============ SEED DATA ============

@api_router.post("/seed")
async def seed_data():
    # Check if already seeded
    existing = await db.products.count_documents({})
    if existing > 0:
        return {"message": "Database already seeded"}
    
    # Seed products
    products = [
        {
            "id": str(uuid.uuid4()),
            "name": "Classic Brown Leather Wallet",
            "slug": "classic-brown-leather-wallet",
            "description": "Premium genuine leather wallet with multiple card slots and bill compartments. Perfect for everyday use.",
            "category": "men",
            "price": 45.00,
            "image_url": "https://images.unsplash.com/photo-1627123424574-724758594e93?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwxfHxsZWF0aGVyJTIwd2FsbGV0fGVufDB8fHx8MTc2MDgzMTYxNnww&ixlib=rb-4.1.0&q=85",
            "stock": 50,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Executive Black Bifold",
            "slug": "executive-black-bifold",
            "description": "Sophisticated black leather bifold wallet. Slim design with RFID protection.",
            "category": "men",
            "price": 55.00,
            "image_url": "https://images.unsplash.com/photo-1620109176813-e91290f6c795?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwyfHxsZWF0aGVyJTIwd2FsbGV0fGVufDB8fHx8MTc2MDgzMTYxNnww&ixlib=rb-4.1.0&q=85",
            "stock": 35,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Minimalist Card Holder",
            "slug": "minimalist-card-holder",
            "description": "Sleek gray leather card holder. Perfect for carrying essentials only.",
            "category": "cardholder",
            "price": 25.00,
            "image_url": "https://images.unsplash.com/photo-1676276550349-580c49631496?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwxfHxjYXJkJTIwaG9sZGVyfGVufDB8fHx8MTc2MDgzMTYyMXww&ixlib=rb-4.1.0&q=85",
            "stock": 75,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Women's Elegant Wallet",
            "slug": "womens-elegant-wallet",
            "description": "Beautiful handcrafted leather wallet with zipper closure. Multiple compartments for cards and cash.",
            "category": "women",
            "price": 50.00,
            "image_url": "https://images.unsplash.com/photo-1611688599669-e0d5a0497670?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzR8MHwxfHNlYXJjaHw0fHxsdXh1cnklMjBsZWF0aGVyfGVufDB8fHx8MTc2MDgzMTYyNXww&ixlib=rb-4.1.0&q=85",
            "stock": 40,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Premium Black Wallet",
            "slug": "premium-black-wallet",
            "description": "Luxury black leather wallet with gold accents. Features multiple card slots and coin pocket.",
            "category": "men",
            "price": 65.00,
            "image_url": "https://images.unsplash.com/photo-1629958513881-a086d21383cd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwzfHxsZWF0aGVyJTIwd2FsbGV0fGVufDB8fHx8MTc2MDgzMTYxNnww&ixlib=rb-4.1.0&q=85",
            "stock": 30,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Slim Black Card Case",
            "slug": "slim-black-card-case",
            "description": "Ultra-slim black leather card case. Holds 4-6 cards comfortably.",
            "category": "cardholder",
            "price": 30.00,
            "image_url": "https://images.unsplash.com/photo-1601592996763-f05c9c80a7f1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwzfHxjYXJkJTIwaG9sZGVyfGVufDB8fHx8MTc2MDgzMTYyMXww&ixlib=rb-4.1.0&q=85",
            "stock": 60,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.products.insert_many(products)
    
    # Create admin user
    admin = User(
        email="admin@leatherwallet.pk",
        name="Admin",
        password_hash=hash_password("admin123"),
        role="admin"
    )
    admin_doc = admin.model_dump()
    admin_doc['created_at'] = admin_doc['created_at'].isoformat()
    await db.users.insert_one(admin_doc)
    
    return {"message": "Database seeded successfully", "admin_email": "admin@leatherwallet.pk", "admin_password": "admin123"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()