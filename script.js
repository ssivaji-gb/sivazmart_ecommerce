// API Configuration
const API_BASE = 'http://localhost:3000';

// Utility Functions
class Utils {
    static formatPrice(price) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(price);
    }

    static showMessage(message, type = 'info', duration = 3000) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, duration);
    }

    static getCurrentUser() {
        const user = localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    }

    static setCurrentUser(user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
    }

    static clearCurrentUser() {
        localStorage.removeItem('currentUser');
    }

    static isLoggedIn() {
        return !!localStorage.getItem('currentUser');
    }

    static redirectIfNotLoggedIn() {
        if (!this.isLoggedIn()) {
            window.location.href = 'login.html';
            return true;
        }
        return false;
    }
}

// Product Service
class ProductService {
    static async getProducts() {
        try {
            const response = await fetch(`${API_BASE}/products`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching products:', error);
            return [];
        }
    }

    static async getProductById(id) {
        try {
            const response = await fetch(`${API_BASE}/products/${id}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching product:', error);
            return null;
        }
    }

    static async getCategories() {
        try {
            const response = await fetch(`${API_BASE}/categories`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching categories:', error);
            return [];
        }
    }

    static async searchProducts(query) {
        try {
            const response = await fetch(`${API_BASE}/products?q=${query}`);
            return await response.json();
        } catch (error) {
            console.error('Error searching products:', error);
            return [];
        }
    }
}

// Cart Service
class CartService {
    static async getCart(userId) {
        try {
            const response = await fetch(`${API_BASE}/carts?userId=${userId}`);
            const carts = await response.json();
            return carts[0] || null;
        } catch (error) {
            console.error('Error fetching cart:', error);
            return null;
        }
    }

    static async createCart(userId) {
        try {
            const response = await fetch(`${API_BASE}/carts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    items: [],
                    createdAt: new Date().toISOString()
                })
            });
            return await response.json();
        } catch (error) {
            console.error('Error creating cart:', error);
            return null;
        }
    }

    static async getOrCreateCart(userId) {
        let cart = await this.getCart(userId);
        if (!cart) {
            cart = await this.createCart(userId);
        }
        return cart;
    }

    static async updateCart(cart) {
        try {
            const response = await fetch(`${API_BASE}/carts/${cart.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cart)
            });
            return await response.json();
        } catch (error) {
            console.error('Error updating cart:', error);
            return null;
        }
    }

    static async addToCart(userId, product, quantity = 1) {
        const cart = await this.getOrCreateCart(userId);
        
        const existingItemIndex = cart.items.findIndex(item => item.productId === product.id);
        
        if (existingItemIndex > -1) {
            cart.items[existingItemIndex].qty += quantity;
        } else {
            cart.items.push({
                productId: product.id,
                title: product.title,
                price: product.price,
                image: product.image,
                qty: quantity
            });
        }
        
        return await this.updateCart(cart);
    }

    static async removeFromCart(userId, productId) {
        const cart = await this.getCart(userId);
        if (!cart) return null;
        
        cart.items = cart.items.filter(item => item.productId !== productId);
        return await this.updateCart(cart);
    }

    static async updateQuantity(userId, productId, quantity) {
        const cart = await this.getCart(userId);
        if (!cart) return null;
        
        const item = cart.items.find(item => item.productId === productId);
        if (item) {
            if (quantity <= 0) {
                return await this.removeFromCart(userId, productId);
            }
            item.qty = quantity;
        }
        
        return await this.updateCart(cart);
    }

    static async clearCart(userId) {
        const cart = await this.getCart(userId);
        if (!cart) return null;
        
        cart.items = [];
        return await this.updateCart(cart);
    }

    static calculateTotal(cart) {
        if (!cart || !cart.items) return 0;
        return cart.items.reduce((total, item) => total + (item.price * item.qty), 0);
    }
}

// Auth Service
class AuthService {
    static async login(email, password) {
        try {
            const response = await fetch(`${API_BASE}/users?email=${email}`);
            const users = await response.json();
            
            if (users.length === 0) {
                throw new Error('User not found');
            }
            
            const user = users[0];
            if (user.password !== password) {
                throw new Error('Invalid password');
            }
            
            // Remove password before storing
            const { password: _, ...userWithoutPassword } = user;
            Utils.setCurrentUser(userWithoutPassword);
            
            return userWithoutPassword;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    static async register(name, email, password) {
        try {
            // Check if email exists
            const checkResponse = await fetch(`${API_BASE}/users?email=${email}`);
            const existingUsers = await checkResponse.json();
            
            if (existingUsers.length > 0) {
                throw new Error('Email already registered');
            }
            
            // Create new user
            const response = await fetch(`${API_BASE}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    createdAt: new Date().toISOString()
                })
            });
            
            const user = await response.json();
            const { password: _, ...userWithoutPassword } = user;
            
            return userWithoutPassword;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    static logout() {
        Utils.clearCurrentUser();
        window.location.href = 'index.html';
    }
}

// Navigation
class Navigation {
    static init() {
        this.updateAuthUI();
        this.setupEventListeners();
    }

    static updateAuthUI() {
        const user = Utils.getCurrentUser();
        const authButtons = document.getElementById('authButtons');
        const userInfo = document.getElementById('userInfo');
        
        if (authButtons && userInfo) {
            if (user) {
                authButtons.style.display = 'none';
                userInfo.style.display = 'flex';
                document.getElementById('userName').textContent = user.name;
            } else {
                authButtons.style.display = 'flex';
                userInfo.style.display = 'none';
            }
        }
        
        this.updateCartCount();
    }

    static async updateCartCount() {
        const cartCount = document.querySelector('.cart-count');
        if (!cartCount) return;
        
        const user = Utils.getCurrentUser();
        if (!user) {
            cartCount.textContent = '0';
            return;
        }
        
        const cart = await CartService.getCart(user.id);
        const count = cart ? cart.items.reduce((sum, item) => sum + item.qty, 0) : 0;
        cartCount.textContent = count;
    }

    static setupEventListeners() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => AuthService.logout());
        }
    }
}

// Product Listing Page
if (window.location.pathname.includes('products.html')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const productsGrid = document.getElementById('productsGrid');
        const searchInput = document.getElementById('searchInput');
        const categoryFilter = document.getElementById('categoryFilter');
        const sortFilter = document.getElementById('sortFilter');
        
        let products = await ProductService.getProducts();
        let categories = await ProductService.getCategories();
        
        // Populate category filter
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categoryFilter.appendChild(option);
        });
        
        function renderProducts(productsToRender) {
            productsGrid.innerHTML = '';
            
            if (productsToRender.length === 0) {
                productsGrid.innerHTML = '<p class="message message-info">No products found</p>';
                return;
            }
            
            productsToRender.forEach(product => {
                const productCard = document.createElement('div');
                productCard.className = 'product-card luxury';
                productCard.innerHTML = `
                    <img src="${product.image}" alt="${product.title}" class="product-image">
                    <div class="product-info">
                        <h3 class="product-title">${product.title}</h3>
                        <div class="product-price">${Utils.formatPrice(product.price)}</div>
                        <div class="product-rating">
                            ${'★'.repeat(Math.floor(product.rating))}${'☆'.repeat(5 - Math.floor(product.rating))}
                            (${product.rating})
                        </div>
                        <span class="product-category">${product.category}</span>
                        <button class="btn btn-primary btn-block add-to-cart" data-id="${product.id}">
                            Add to Cart
                        </button>
                        <a href="product-details.html?id=${product.id}" class="btn btn-outline btn-block" style="margin-top: 0.5rem;">
                            View Details
                        </a>
                    </div>
                `;
                productsGrid.appendChild(productCard);
            });
            
            // Add event listeners to Add to Cart buttons
            document.querySelectorAll('.add-to-cart').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const productId = parseInt(e.target.dataset.id);
                    const product = products.find(p => p.id === productId);
                    
                    if (!Utils.isLoggedIn()) {
                        // Store pending product and redirect to login
                        localStorage.setItem('pendingCartProductId', productId);
                        window.location.href = 'login.html';
                        return;
                    }
                    
                    const user = Utils.getCurrentUser();
                    await CartService.addToCart(user.id, product);
                    Utils.showMessage('Product added to cart!', 'success');
                    Navigation.updateCartCount();
                });
            });
        }
        
        // Initial render
        renderProducts(products);
        
        // Search functionality
        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value.toLowerCase();
            if (query.length >= 2) {
                const searchResults = await ProductService.searchProducts(query);
                applyFilters(searchResults);
            } else if (query.length === 0) {
                applyFilters(products);
            }
        });
        
        // Filter and sort functionality
        function applyFilters(productsList) {
            let filtered = [...productsList];
            
            // Category filter
            const category = categoryFilter.value;
            if (category) {
                filtered = filtered.filter(product => product.category === category);
            }
            
            // Sort filter
            const sortBy = sortFilter.value;
            if (sortBy === 'price-asc') {
                filtered.sort((a, b) => a.price - b.price);
            } else if (sortBy === 'price-desc') {
                filtered.sort((a, b) => b.price - a.price);
            } else if (sortBy === 'rating-desc') {
                filtered.sort((a, b) => b.rating - a.rating);
            }
            
            renderProducts(filtered);
        }
        
        categoryFilter.addEventListener('change', () => applyFilters(products));
        sortFilter.addEventListener('change', () => applyFilters(products));
    });
}

// Product Details Page
if (window.location.pathname.includes('product-details.html')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = parseInt(urlParams.get('id'));
        
        if (!productId) {
            window.location.href = 'products.html';
            return;
        }
        
        const product = await ProductService.getProductById(productId);
        
        if (!product) {
            window.location.href = 'products.html';
            return;
        }
        
        // Update page content
        document.getElementById('productImage').src = product.image;
        document.getElementById('productImage').alt = product.title;
        document.getElementById('productTitle').textContent = product.title;
        document.getElementById('productPrice').textContent = Utils.formatPrice(product.price);
        document.getElementById('productCategory').textContent = product.category;
        document.getElementById('productDescription').textContent = product.description;
        document.getElementById('productRating').innerHTML = `
            ${'★'.repeat(Math.floor(product.rating))}${'☆'.repeat(5 - Math.floor(product.rating))}
            (${product.rating})
        `;
        
        // Add to cart functionality
        const addToCartBtn = document.getElementById('addToCartBtn');
        const quantityInput = document.getElementById('quantity');
        
        addToCartBtn.addEventListener('click', async () => {
            const quantity = parseInt(quantityInput.value) || 1;
            
            if (!Utils.isLoggedIn()) {
                // Store pending product and redirect to login
                localStorage.setItem('pendingCartProductId', productId);
                localStorage.setItem('pendingCartQuantity', quantity);
                window.location.href = 'login.html';
                return;
            }
            
            const user = Utils.getCurrentUser();
            await CartService.addToCart(user.id, product, quantity);
            Utils.showMessage('Product added to cart!', 'success');
            Navigation.updateCartCount();
        });
    });
}

// Cart Page
if (window.location.pathname.includes('cart.html')) {
    document.addEventListener('DOMContentLoaded', async () => {
        if (Utils.redirectIfNotLoggedIn()) return;
        
        const cartItems = document.getElementById('cartItems');
        const cartTotal = document.getElementById('cartTotal');
        const checkoutBtn = document.getElementById('checkoutBtn');
        
        const user = Utils.getCurrentUser();
        let cart = await CartService.getCart(user.id);
        
        function renderCart() {
            if (!cart || cart.items.length === 0) {
                cartItems.innerHTML = '<p class="message message-info">Your cart is empty</p>';
                cartTotal.textContent = Utils.formatPrice(0);
                checkoutBtn.disabled = true;
                return;
            }
            
            cartItems.innerHTML = '';
            let total = 0;
            
            cart.items.forEach(item => {
                const itemTotal = item.price * item.qty;
                total += itemTotal;
                
                const cartItem = document.createElement('div');
                cartItem.className = 'cart-item';
                cartItem.innerHTML = `
                    <img src="${item.image}" alt="${item.title}" class="cart-item-image">
                    <div class="cart-item-details">
                        <h4 class="cart-item-title">${item.title}</h4>
                        <div class="cart-item-price">${Utils.formatPrice(item.price)}</div>
                    </div>
                    <div class="cart-item-actions">
                        <div class="quantity-control">
                            <button class="quantity-btn decrease" data-id="${item.productId}">-</button>
                            <span class="quantity">${item.qty}</span>
                            <button class="quantity-btn increase" data-id="${item.productId}">+</button>
                        </div>
                        <div class="item-total">${Utils.formatPrice(itemTotal)}</div>
                        <button class="btn btn-danger btn-small remove-item" data-id="${item.productId}">
                            Remove
                        </button>
                    </div>
                `;
                cartItems.appendChild(cartItem);
            });
            
            cartTotal.textContent = Utils.formatPrice(total);
            checkoutBtn.disabled = false;
            
            // Add event listeners
            document.querySelectorAll('.decrease').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const productId = parseInt(e.target.dataset.id);
                    const item = cart.items.find(i => i.productId === productId);
                    if (item) {
                        await CartService.updateQuantity(user.id, productId, item.qty - 1);
                        cart = await CartService.getCart(user.id);
                        renderCart();
                        Navigation.updateCartCount();
                    }
                });
            });
            
            document.querySelectorAll('.increase').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const productId = parseInt(e.target.dataset.id);
                    const item = cart.items.find(i => i.productId === productId);
                    if (item) {
                        await CartService.updateQuantity(user.id, productId, item.qty + 1);
                        cart = await CartService.getCart(user.id);
                        renderCart();
                        Navigation.updateCartCount();
                    }
                });
            });
            
            document.querySelectorAll('.remove-item').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const productId = parseInt(e.target.dataset.id);
                    await CartService.removeFromCart(user.id, productId);
                    cart = await CartService.getCart(user.id);
                    renderCart();
                    Navigation.updateCartCount();
                });
            });
        }
        
        renderCart();
        
        // Checkout button
        checkoutBtn.addEventListener('click', () => {
            window.location.href = 'checkout.html';
        });
    });
}

// Checkout Page
if (window.location.pathname.includes('checkout.html')) {
    document.addEventListener('DOMContentLoaded', async () => {
        if (Utils.redirectIfNotLoggedIn()) return;
        
        const checkoutForm = document.getElementById('checkoutForm');
        const orderSummary = document.getElementById('orderSummary');
        const user = Utils.getCurrentUser();
        const cart = await CartService.getCart(user.id);
        
        if (!cart || cart.items.length === 0) {
            window.location.href = 'cart.html';
            return;
        }
        
        // Populate order summary
        const total = CartService.calculateTotal(cart);
        orderSummary.innerHTML = `
            <h3>Order Summary</h3>
            ${cart.items.map(item => `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>${item.title} x ${item.qty}</span>
                    <span>${Utils.formatPrice(item.price * item.qty)}</span>
                </div>
            `).join('')}
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                <span>Total</span>
                <span>${Utils.formatPrice(total)}</span>
            </div>
        `;
        
        // Auto-fill form with user data
        document.getElementById('fullName').value = user.name || '';
        
        // Handle form submission
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const orderData = {
                userId: user.id,
                items: cart.items,
                shippingAddress: document.getElementById('address').value,
                paymentMethod: document.getElementById('paymentMethod').value,
                total: total,
                status: 'processing',
                createdAt: new Date().toISOString()
            };
            
            try {
                // Save order to mock server
                await fetch(`${API_BASE}/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderData)
                });
                
                // Clear cart
                await CartService.clearCart(user.id);
                
                // Show success message
                checkoutForm.innerHTML = `
                    <div class="success-message">
                        <h3>Order Placed Successfully!</h3>
                        <p>Thank you for your order. Your order ID is #${Date.now()}</p>
                        <p>You will receive a confirmation email shortly.</p>
                        <a href="index.html" class="btn btn-primary" style="margin-top: 1rem;">
                            Continue Shopping
                        </a>
                    </div>
                `;
                
                Navigation.updateCartCount();
            } catch (error) {
                Utils.showMessage('Error placing order. Please try again.', 'error');
            }
        });
    });
}

// Login Page
if (window.location.pathname.includes('login.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        const loginForm = document.getElementById('loginForm');
        const errorMessage = document.getElementById('errorMessage');
        
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                const user = await AuthService.login(email, password);
                
                // Check for pending cart product
                const pendingProductId = localStorage.getItem('pendingCartProductId');
                const pendingQuantity = localStorage.getItem('pendingCartQuantity') || 1;
                
                if (pendingProductId) {
                    const product = await ProductService.getProductById(parseInt(pendingProductId));
                    if (product) {
                        await CartService.addToCart(user.id, product, parseInt(pendingQuantity));
                        localStorage.removeItem('pendingCartProductId');
                        localStorage.removeItem('pendingCartQuantity');
                        window.location.href = 'cart.html';
                        return;
                    }
                }
                
                window.location.href = 'index.html';
            } catch (error) {
                errorMessage.textContent = error.message;
                errorMessage.style.display = 'block';
            }
        });
    });
}

// Register Page
if (window.location.pathname.includes('register.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        const registerForm = document.getElementById('registerForm');
        const errorMessage = document.getElementById('errorMessage');
        
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (password !== confirmPassword) {
                errorMessage.textContent = 'Passwords do not match';
                errorMessage.style.display = 'block';
                return;
            }
            
            try {
                const user = await AuthService.register(name, email, password);
                Utils.setCurrentUser(user);
                
                // Check for pending cart product
                const pendingProductId = localStorage.getItem('pendingCartProductId');
                const pendingQuantity = localStorage.getItem('pendingCartQuantity') || 1;
                
                if (pendingProductId) {
                    const product = await ProductService.getProductById(parseInt(pendingProductId));
                    if (product) {
                        await CartService.addToCart(user.id, product, parseInt(pendingQuantity));
                        localStorage.removeItem('pendingCartProductId');
                        localStorage.removeItem('pendingCartQuantity');
                        window.location.href = 'cart.html';
                        return;
                    }
                }
                
                window.location.href = 'index.html';
            } catch (error) {
                errorMessage.textContent = error.message;
                errorMessage.style.display = 'block';
            }
        });
    });
}

// Home Page
if (window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const featuredProducts = document.getElementById('featuredProducts');
        const products = await ProductService.getProducts();
        
        // Display featured products (first 4)
        const featured = products.slice(0, 4);
        
        featured.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
                <img src="${product.image}" alt="${product.title}" class="product-image">
                <div class="product-info">
                    <h3 class="product-title">${product.title}</h3>
                    <div class="product-price">${Utils.formatPrice(product.price)}</div>
                    <div class="product-rating">
                        ${'★'.repeat(Math.floor(product.rating))}${'☆'.repeat(5 - Math.floor(product.rating))}
                        (${product.rating})
                    </div>
                    <button class="btn btn-primary btn-block add-to-cart" data-id="${product.id}">
                        Add to Cart
                    </button>
                    <a href="product-details.html?id=${product.id}" class="btn btn-outline btn-block" style="margin-top: 0.5rem;">
                        View Details
                    </a>
                </div>
            `;
            featuredProducts.appendChild(productCard);
        });
        
        // Add event listeners to Add to Cart buttons
        document.querySelectorAll('.add-to-cart').forEach(button => {
            button.addEventListener('click', async (e) => {
                const productId = parseInt(e.target.dataset.id);
                const product = products.find(p => p.id === productId);
                
                if (!Utils.isLoggedIn()) {
                    // Store pending product and redirect to login
                    localStorage.setItem('pendingCartProductId', productId);
                    window.location.href = 'login.html';
                    return;
                }
                
                const user = Utils.getCurrentUser();
                await CartService.addToCart(user.id, product);
                Utils.showMessage('Product added to cart!', 'success');
                Navigation.updateCartCount();
            });
        });
    });
}

// Enhanced Carousel Functionality
let currentSlide = 0;
let totalSlides = 4;
let carouselInterval;
let progressInterval;

function showSlide(index) {
    const slides = document.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll('.indicator');
    const progressBar = document.querySelector('.progress-bar');
    
    // Remove active class from all slides and indicators
    slides.forEach(slide => {
        slide.classList.remove('active');
        slide.classList.add('exiting');
        setTimeout(() => slide.classList.remove('exiting'), 1000);
    });
    indicators.forEach(indicator => indicator.classList.remove('active'));
    
    // Reset progress bar
    if (progressBar) {
        progressBar.style.transition = 'none';
        progressBar.style.width = '0%';
        setTimeout(() => {
            progressBar.style.transition = 'width 5s linear';
        }, 50);
    }
    
    // Add active class to current slide and indicator
    if (slides[index]) {
        slides[index].classList.add('active');
    }
    if (indicators[index]) {
        indicators[index].classList.add('active');
    }
    
    currentSlide = index;
}

function carouselNext() {
    currentSlide = (currentSlide + 1) % totalSlides;
    showSlide(currentSlide);
    resetCarouselInterval();
}

function carouselPrev() {
    currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
    showSlide(currentSlide);
    resetCarouselInterval();
}

function carouselGoto(index) {
    currentSlide = index;
    showSlide(currentSlide);
    resetCarouselInterval();
}

function autoSlide() {
    carouselNext();
}

function resetCarouselInterval() {
    clearInterval(carouselInterval);
    carouselInterval = setInterval(autoSlide, 5000);
    
    // Reset progress bar animation
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.style.width = '100%';
    }
}

function initializeCarouselImages() {
    const slides = document.querySelectorAll('.carousel-slide');
    
    slides.forEach((slide, index) => {
        // Add loaded class after image loads
        const bgImage = new Image();
        const bgUrl = slide.style.backgroundImage.replace('url("', '').replace('")', '');
        
        slide.classList.add('loading');
        
        bgImage.onload = () => {
            setTimeout(() => {
                slide.classList.remove('loading');
                slide.classList.add('loaded');
                
                // Add particles after image loads
                if (index === 0) {
                    createParticles(slide);
                }
            }, index * 300);
        };
        
        bgImage.src = bgUrl;
    });
}

function createParticles(container) {
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'carousel-particles';
    
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'carousel-particle';
        
        // Random position
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        
        // Random animation delay and duration
        const delay = Math.random() * 4;
        const duration = 4 + Math.random() * 4;
        particle.style.animationDelay = `${delay}s`;
        particle.style.animationDuration = `${duration}s`;
        
        // Random size
        const size = Math.random() * 3 + 1;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        particlesContainer.appendChild(particle);
    }
    
    container.appendChild(particlesContainer);
}

function initializeCarouselParallax() {
    if (window.innerWidth > 768) {
        window.addEventListener('scroll', () => {
            const slides = document.querySelectorAll('.carousel-slide');
            const scrollPosition = window.pageYOffset;
            
            slides.forEach((slide, index) => {
                if (slide.classList.contains('active')) {
                    const speed = 0.2;
                    const yPos = -(scrollPosition * speed);
                    slide.style.transform = `translateY(${yPos}px) scale(1)`;
                }
            });
        });
    }
}

function initializeCarouselKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            carouselPrev();
        } else if (e.key === 'ArrowRight') {
            carouselNext();
        }
    });
}

function initializeCarouselTouch() {
    const carousel = document.querySelector('.carousel-container');
    let startX = 0;
    let endX = 0;
    
    if (!carousel) return;
    
    carousel.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    });
    
    carousel.addEventListener('touchend', (e) => {
        endX = e.changedTouches[0].clientX;
        handleSwipe();
    });
    
    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = startX - endX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                carouselNext();
            } else {
                carouselPrev();
            }
        }
    }
}

// Update initialization
document.addEventListener('DOMContentLoaded', () => {
    LuxuryAnimations.init();
    Navigation.init();
    ImageBannerAnimations.init();
    
    // Initialize carousel
    initializeCarouselImages();
    initializeCarouselParallax();
    initializeCarouselKeyboard();
    initializeCarouselTouch();
    
    // Start carousel
    showSlide(0);
    carouselInterval = setInterval(autoSlide, 5000);
    
    // Add exit animation style
    const style = document.createElement('style');
    style.textContent = `
        .carousel-slide.exiting {
            opacity: 0 !important;
            transition: opacity 0.8s ease !important;
        }
    `;
    document.head.appendChild(style);
});

// Luxury Animations Initialization
class LuxuryAnimations {
    static init() {
        this.initializeAOS();
        this.createParticles();
        this.initializeLogoAnimation();
    }

    static initializeAOS() {
        AOS.init({
            duration: 1000,
            once: true,
            easing: 'ease-in-out',
            offset: 100
        });
    }

    static createParticles() {
        const banners = document.querySelectorAll('.category-banner');
        banners.forEach(banner => {
            for (let i = 0; i < 15; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                
                // Random position
                particle.style.left = `${Math.random() * 100}%`;
                particle.style.top = `${Math.random() * 100}%`;
                
                // Random animation delay
                particle.style.animationDelay = `${Math.random() * 4}s`;
                
                // Random size
                const size = Math.random() * 3 + 1;
                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                
                banner.appendChild(particle);
            }
        });
    }

    static initializeLogoAnimation() {
        const logo = document.querySelector('.logo');
        if (logo) {
            // Add logo animation on page load
            logo.style.animation = 'none';
            setTimeout(() => {
                logo.style.animation = 'logoEntrance 1s ease forwards';
            }, 300);
        }
    }
}

// Add logo animation keyframes to style element
const style = document.createElement('style');
style.textContent = `
    @keyframes logoEntrance {
        0% {
            opacity: 0;
            transform: scale(0.8) translateY(-20px);
        }
        100% {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }
`;
document.head.appendChild(style);

// Initialize luxury animations when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    LuxuryAnimations.init();
    Navigation.init();
    
    // Start carousel auto-rotation if carousel exists
    const carousel = document.querySelector('.carousel-container');
    if (carousel) {
        showSlide(0);
        carouselInterval = setInterval(autoSlide, 5000);
    }
});

// Initialize carousel when page loads
document.addEventListener('DOMContentLoaded', () => {
    Navigation.init();
    
    // Start carousel auto-rotation if carousel exists
    const carousel = document.querySelector('.carousel-container');
    if (carousel) {
        showSlide(0);
        carouselInterval = setInterval(autoSlide, 5000);
    }
});

// Image Category Banner Animations
class ImageBannerAnimations {
    static init() {
        this.initializeImageLoading();
        this.initializeParallaxEffect();
        this.initializeHoverEffects();
    }

    static initializeImageLoading() {
        const banners = document.querySelectorAll('.category-banner-image');
        
        banners.forEach((banner, index) => {
            // Simulate image loading with delay for staggered effect
            setTimeout(() => {
                banner.classList.remove('loading');
                banner.classList.add('loaded');
                
                // Add random delay for floating elements animation
                const floatElements = banner.querySelectorAll('.category-image-floating');
                floatElements.forEach((element, i) => {
                    element.style.animationDelay = `${i * 2}s`;
                });
                
            }, index * 200);
        });
    }

    static initializeParallaxEffect() {
        // Only enable parallax on desktop
        if (window.innerWidth > 768) {
            window.addEventListener('scroll', () => {
                const banners = document.querySelectorAll('.category-banner-image');
                const scrollPosition = window.pageYOffset;
                
                banners.forEach((banner, index) => {
                    const speed = 0.3 + (index * 0.1);
                    const yPos = -(scrollPosition * speed);
                    banner.style.transform = `translateY(${yPos}px) scale(1.02)`;
                });
            });
        }
    }

    static initializeHoverEffects() {
        const banners = document.querySelectorAll('.category-banner-image');
        
        banners.forEach(banner => {
            banner.addEventListener('mouseenter', () => {
                // Add glow animation
                const glow = banner.querySelector('.category-image-glow');
                if (glow) {
                    glow.style.opacity = '1';
                    glow.style.width = '400px';
                    glow.style.height = '400px';
                }
                
                // Add ripple effect
                this.createRippleEffect(banner);
            });
            
            banner.addEventListener('mouseleave', () => {
                // Remove glow animation
                const glow = banner.querySelector('.category-image-glow');
                if (glow) {
                    glow.style.opacity = '0';
                    glow.style.width = '0';
                    glow.style.height = '0';
                }
            });
        });
    }

    static createRippleEffect(banner) {
        const ripple = document.createElement('div');
        ripple.style.position = 'absolute';
        ripple.style.borderRadius = '50%';
        ripple.style.background = 'radial-gradient(circle, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0) 70%)';
        ripple.style.transform = 'scale(0)';
        ripple.style.animation = 'ripple 0.6s ease-out';
        ripple.style.zIndex = '2';
        
        // Random position
        const x = Math.random() * 80 + 10;
        const y = Math.random() * 80 + 10;
        ripple.style.left = `${x}%`;
        ripple.style.top = `${y}%`;
        
        banner.appendChild(ripple);
        
        // Remove ripple after animation
        setTimeout(() => {
            if (ripple.parentNode === banner) {
                banner.removeChild(ripple);
            }
        }, 600);
    }

    static initializeCounterAnimation() {
        const counters = document.querySelectorAll('.category-image-count');
        
        counters.forEach(counter => {
            const text = counter.textContent;
            const number = parseInt(text.match(/\d+/)[0]);
            
            // Animate counter on hover
            const parentBanner = counter.closest('.category-banner-image');
            parentBanner.addEventListener('mouseenter', () => {
                this.animateCounter(counter, number);
            });
        });
    }

    static animateCounter(counter, target) {
        let current = 0;
        const increment = target / 30;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            counter.textContent = `+${Math.floor(current)} Products`;
        }, 30);
    }
}

// Add ripple animation to CSS
const rippleStyle = document.createElement('style');
rippleStyle.textContent = `
    @keyframes ripple {
        0% {
            transform: scale(0);
            opacity: 1;
        }
        100% {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(rippleStyle);

// Update initialization
document.addEventListener('DOMContentLoaded', () => {
    LuxuryAnimations.init();
    Navigation.init();
    ImageBannerAnimations.init();
    
    // Start carousel auto-rotation if carousel exists
    const carousel = document.querySelector('.carousel-container');
    if (carousel) {
        showSlide(0);
        carouselInterval = setInterval(autoSlide, 5000);
    }
});
