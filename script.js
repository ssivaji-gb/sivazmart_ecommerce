// Utility function to hash passwords using SHA-256
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// API Configuration
const API_BASE = 'http://localhost:3000';

// Utility Functions
const Utils = {
    formatPrice: function(price) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(price);
    },

    showMessage: function(message, type = 'info', duration = 3000) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(function() {
            messageDiv.remove();
        }, duration);
    },

    getCurrentUser: function() {
        const user = localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    },

    setCurrentUser: function(user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
    },

    clearCurrentUser: function() {
        localStorage.removeItem('currentUser');
    },

    isLoggedIn: function() {
        return !!localStorage.getItem('currentUser');
    },

    redirectIfNotLoggedIn: function() {
        if (!this.isLoggedIn()) {
            window.location.href = 'login.html';
            return true;
        }
        return false;
    },

    generateOrderNumber: function() {
        return 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    },

    formatDate: function(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};

// Product Service Functions
const ProductService = {
    getProducts: async function() {
        try {
            const response = await fetch(`${API_BASE}/products`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching products:', error);
            return [];
        }
    },

    getProductById: async function(id) {
        try {
            const response = await fetch(`${API_BASE}/products/${id}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching product:', error);
            return null;
        }
    },

    getCategories: async function() {
        try {
            const response = await fetch(`${API_BASE}/categories`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching categories:', error);
            return [];
        }
    },

    searchProducts: async function(query) {
        try {
            const response = await fetch(`${API_BASE}/products?q=${query}`);
            return await response.json();
        } catch (error) {
            console.error('Error searching products:', error);
            return [];
        }
    }
};

// Cart Service Functions
const CartService = {
    getCart: async function(userId) {
        try {
            const response = await fetch(`${API_BASE}/carts?userId=${userId}`);
            const carts = await response.json();
            return carts[0] || null;
        } catch (error) {
            console.error('Error fetching cart:', error);
            return null;
        }
    },

    createCart: async function(userId) {
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
    },

    getOrCreateCart: async function(userId) {
        let cart = await this.getCart(userId);
        if (!cart) {
            cart = await this.createCart(userId);
        }
        return cart;
    },

    updateCart: async function(cart) {
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
    },

    addToCart: async function(userId, product, quantity = 1) {
        const cart = await this.getOrCreateCart(userId);
        
        const existingItemIndex = cart.items.findIndex(function(item) {
            return item.productId === product.id;
        });
        
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
    },

    removeFromCart: async function(userId, productId) {
        const cart = await this.getCart(userId);
        if (!cart) return null;
        
        cart.items = cart.items.filter(function(item) {
            return item.productId !== productId;
        });
        return await this.updateCart(cart);
    },

    updateQuantity: async function(userId, productId, quantity) {
        const cart = await this.getCart(userId);
        if (!cart) return null;
        
        const item = cart.items.find(function(item) {
            return item.productId === productId;
        });
        if (item) {
            if (quantity <= 0) {
                return await this.removeFromCart(userId, productId);
            }
            item.qty = quantity;
        }
        
        return await this.updateCart(cart);
    },

    clearCart: async function(userId) {
        const cart = await this.getCart(userId);
        if (!cart) return null;
        
        cart.items = [];
        return await this.updateCart(cart);
    },

    calculateTotal: function(cart) {
        if (!cart || !cart.items) return 0;
        return cart.items.reduce(function(total, item) {
            return total + (item.price * item.qty);
        }, 0);
    }
};

// Order Service Functions
const OrderService = {
    getOrders: async function(userId) {
        try {
            const response = await fetch(`${API_BASE}/orders?userId=${userId}`);
            const orders = await response.json();
            // Sort by latest first
            return orders.sort(function(a, b) {
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
        } catch (error) {
            console.error('Error fetching orders:', error);
            return [];
        }
    },

    getOrderById: async function(orderId) {
        try {
            const response = await fetch(`${API_BASE}/orders/${orderId}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching order:', error);
            return null;
        }
    },

    createOrder: async function(orderData) {
        try {
            const response = await fetch(`${API_BASE}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
            return await response.json();
        } catch (error) {
            console.error('Error creating order:', error);
            throw error;
        }
    },

    getOrderStatusClass: function(status) {
        const statusClasses = {
            'processing': 'status-processing',
            'shipped': 'status-shipped',
            'delivered': 'status-delivered',
            'cancelled': 'status-cancelled'
        };
        return statusClasses[status] || 'status-processing';
    },

    getOrderStatusText: function(status) {
        const statusText = {
            'processing': 'Processing',
            'shipped': 'Shipped',
            'delivered': 'Delivered',
            'cancelled': 'Cancelled'
        };
        return statusText[status] || 'Processing';
    }
};

// Auth Service Functions
const AuthService = {
    login: async function(email, password) {
        try {
            const response = await fetch(`${API_BASE}/users?email=${email}`);
            const users = await response.json();

            if (users.length === 0) {
                throw new Error("User not found");
            }

            const user = users[0];

            // 🔐 hash entered password
            const hashedInput = await hashPassword(password);

            // ✅ compare hashes
            if (user.password !== hashedInput) {
                throw new Error("Invalid password");
            }

            // Remove password before storing
            const { password: _, ...userWithoutPassword } = user;

            Utils.setCurrentUser(userWithoutPassword);

            return userWithoutPassword;

        } catch (error) {
            console.error("Login error:", error);
            throw error;
        }
    },

    register: async function(name, email, password) {
        try {
            const checkResponse = await fetch(`${API_BASE}/users?email=${email}`);
            const existingUsers = await checkResponse.json();

            if (existingUsers.length > 0) {
                throw new Error("Email already registered");
            }

            // 🔐 HASH password (no bcrypt)
            const hashedPassword = await hashPassword(password);

            const response = await fetch(`${API_BASE}/users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    email,
                    password: hashedPassword,
                    createdAt: new Date().toISOString()
                })
            });

            return await response.json();

        } catch (error) {
            console.error("Registration error:", error);
            throw error;
        }
    },

    logout: function() {
        Utils.clearCurrentUser();
        window.location.href = 'index.html';
    }
};

// Navigation Functions
const Navigation = {
    init: function() {
        this.updateAuthUI();
        this.setupEventListeners();
    },

    updateAuthUI: function() {
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
    },

    updateCartCount: async function() {
        const cartCount = document.querySelector('.cart-count');
        if (!cartCount) return;
        
        const user = Utils.getCurrentUser();
        if (!user) {
            cartCount.textContent = '0';
            return;
        }
        
        const cart = await CartService.getCart(user.id);
        const count = cart ? cart.items.reduce(function(sum, item) {
            return sum + item.qty;
        }, 0) : 0;
        cartCount.textContent = count;
    },

    setupEventListeners: function() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                AuthService.logout();
            });
        }
    }
};

// Initialize luxury animations
const LuxuryAnimations = {
    init: function() {
        this.initializeAOS();
        this.createParticles();
        this.initializeLogoAnimation();
    },

    initializeAOS: function() {
        if (typeof AOS !== 'undefined') {
            AOS.init({
                duration: 1000,
                once: true,
                easing: 'ease-in-out',
                offset: 100
            });
        }
    },

    createParticles: function() {
        const banners = document.querySelectorAll('.category-banner');
        banners.forEach(function(banner) {
            for (let i = 0; i < 15; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                
                particle.style.left = `${Math.random() * 100}%`;
                particle.style.top = `${Math.random() * 100}%`;
                particle.style.animationDelay = `${Math.random() * 4}s`;
                
                const size = Math.random() * 3 + 1;
                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                
                banner.appendChild(particle);
            }
        });
    },

    initializeLogoAnimation: function() {
        const logo = document.querySelector('.logo');
        if (logo) {
            logo.style.animation = 'none';
            setTimeout(function() {
                logo.style.animation = 'logoEntrance 1s ease forwards';
            }, 300);
        }
    }
};

// Image Banner Animations
const ImageBannerAnimations = {
    init: function() {
        this.initializeImageLoading();
        this.initializeParallaxEffect();
        this.initializeHoverEffects();
    },

    initializeImageLoading: function() {
        const banners = document.querySelectorAll('.category-banner-image');
        
        banners.forEach(function(banner, index) {
            setTimeout(function() {
                banner.classList.remove('loading');
                banner.classList.add('loaded');
                
                const floatElements = banner.querySelectorAll('.category-image-floating');
                floatElements.forEach(function(element, i) {
                    element.style.animationDelay = `${i * 2}s`;
                });
                
            }, index * 200);
        });
    },

    initializeParallaxEffect: function() {
        if (window.innerWidth > 768) {
            window.addEventListener('scroll', function() {
                const banners = document.querySelectorAll('.category-banner-image');
                const scrollPosition = window.pageYOffset;
                
                banners.forEach(function(banner, index) {
                    const speed = 0.3 + (index * 0.1);
                    const yPos = -(scrollPosition * speed);
                    banner.style.transform = `translateY(${yPos}px) scale(1.02)`;
                });
            });
        }
    },

    initializeHoverEffects: function() {
        const banners = document.querySelectorAll('.category-banner-image');
        
        banners.forEach(function(banner) {
            banner.addEventListener('mouseenter', function() {
                const glow = banner.querySelector('.category-image-glow');
                if (glow) {
                    glow.style.opacity = '1';
                    glow.style.width = '400px';
                    glow.style.height = '400px';
                }
                
                ImageBannerAnimations.createRippleEffect(banner);
            });
            
            banner.addEventListener('mouseleave', function() {
                const glow = banner.querySelector('.category-image-glow');
                if (glow) {
                    glow.style.opacity = '0';
                    glow.style.width = '0';
                    glow.style.height = '0';
                }
            });
        });
    },

    createRippleEffect: function(banner) {
        const ripple = document.createElement('div');
        ripple.style.position = 'absolute';
        ripple.style.borderRadius = '50%';
        ripple.style.background = 'radial-gradient(circle, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0) 70%)';
        ripple.style.transform = 'scale(0)';
        ripple.style.animation = 'ripple 0.6s ease-out';
        ripple.style.zIndex = '2';
        
        const x = Math.random() * 80 + 10;
        const y = Math.random() * 80 + 10;
        ripple.style.left = `${x}%`;
        ripple.style.top = `${y}%`;
        
        banner.appendChild(ripple);
        
        setTimeout(function() {
            if (ripple.parentNode === banner) {
                banner.removeChild(ripple);
            }
        }, 600);
    }
};

// Responsive Utilities
const ResponsiveUtils = {
    isMobile: function() {
        return window.innerWidth <= 768;
    },

    isTablet: function() {
        return window.innerWidth > 768 && window.innerWidth <= 1024;
    },

    isDesktop: function() {
        return window.innerWidth > 1024;
    },

    getDeviceType: function() {
        if (this.isMobile()) return 'mobile';
        if (this.isTablet()) return 'tablet';
        return 'desktop';
    },

    adjustForMobile: function() {
        if (this.isMobile()) {
            const banners = document.querySelectorAll('.category-banner-image');
            banners.forEach(function(banner) {
                banner.style.backgroundAttachment = 'scroll';
            });
            
            document.body.classList.add('mobile-view');
        }
    },

    handleResize: function() {
        this.adjustForMobile();
        
        const cartItems = document.getElementById('cartItems');
        if (cartItems && this.isMobile()) {
            cartItems.style.flexDirection = 'column';
        }
        
        const carousel = document.querySelector('.carousel-container');
        if (carousel) {
            if (this.isMobile()) {
                carousel.style.height = '300px';
            } else if (this.isTablet()) {
                carousel.style.height = '400px';
            } else {
                carousel.style.height = '600px';
            }
        }
    },

    initializeTouchEvents: function() {
        const productCards = document.querySelectorAll('.product-card');
        productCards.forEach(function(card) {
            card.addEventListener('touchstart', function() {
                this.classList.add('touch-active');
            });
            
            card.addEventListener('touchend', function() {
                this.classList.remove('touch-active');
            });
        });
    }
};

// Global carousel variables
let currentSlide = 0;
let totalSlides = 4;
let carouselInterval;

// Carousel Functions
function showSlide(index) {
    const slides = document.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll('.indicator');
    const progressBar = document.querySelector('.progress-bar');
    
    slides.forEach(function(slide) {
        slide.classList.remove('active');
        slide.classList.add('exiting');
        setTimeout(function() {
            slide.classList.remove('exiting');
        }, 1000);
    });
    indicators.forEach(function(indicator) {
        indicator.classList.remove('active');
    });
    
    if (progressBar) {
        progressBar.style.transition = 'none';
        progressBar.style.width = '0%';
        setTimeout(function() {
            progressBar.style.transition = 'width 5s linear';
        }, 50);
    }
    
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
    
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.style.width = '100%';
    }
}

function initializeCarouselImages() {
    const slides = document.querySelectorAll('.carousel-slide');
    
    slides.forEach(function(slide, index) {
        const bgImage = new Image();
        
        const bgImageStyle = slide.style.backgroundImage;
        let bgUrl = '';
        
        if (bgImageStyle) {
            bgUrl = bgImageStyle.replace(/url\(['"]?([^'")]+)['"]?\)/g, '$1');
        }
        
        if (!bgUrl) {
            const computedStyle = window.getComputedStyle(slide);
            const bgImageComputed = computedStyle.backgroundImage;
            if (bgImageComputed && bgImageComputed !== 'none') {
                bgUrl = bgImageComputed.replace(/url\(['"]?([^'")]+)['"]?\)/g, '$1');
            }
        }
        
        if (!bgUrl) {
            console.warn('No background image found for carousel slide', index);
            slide.classList.add('loaded');
            return;
        }
        
        slide.classList.add('loading');
        
        bgImage.onload = function() {
            setTimeout(function() {
                slide.classList.remove('loading');
                slide.classList.add('loaded');
                
                if (index === 0) {
                    createParticles(slide);
                }
            }, index * 300);
        };
        
        bgImage.onerror = function() {
            console.error('Failed to load carousel image:', bgUrl);
            slide.classList.remove('loading');
            slide.classList.add('loaded');
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
        
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        
        const delay = Math.random() * 4;
        const duration = 4 + Math.random() * 4;
        particle.style.animationDelay = `${delay}s`;
        particle.style.animationDuration = `${duration}s`;
        
        const size = Math.random() * 3 + 1;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        particlesContainer.appendChild(particle);
    }
    
    container.appendChild(particlesContainer);
}

function initializeCarouselParallax() {
    if (window.innerWidth > 768) {
        window.addEventListener('scroll', function() {
            const slides = document.querySelectorAll('.carousel-slide');
            const scrollPosition = window.pageYOffset;
            
            slides.forEach(function(slide, index) {
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
    document.addEventListener('keydown', function(e) {
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
    
    carousel.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
    });
    
    carousel.addEventListener('touchend', function(e) {
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

// Mobile menu functions
function createMobileMenu() {
    const nav = document.querySelector('nav');
    const navLinks = document.querySelector('.nav-links');
    
    if (!nav || !navLinks) return;
    
    const menuButton = document.createElement('button');
    menuButton.className = 'mobile-menu-btn';
    menuButton.innerHTML = '☰';
    menuButton.style.cssText = `
        display: none;
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: var(--primary-color);
        padding: 0.5rem;
        position: absolute;
        right: 1rem;
        top: 1rem;
        z-index: 1000;
    `;
    
    nav.style.position = 'relative';
    nav.insertBefore(menuButton, nav.firstChild);
    
    menuButton.addEventListener('click', function() {
        navLinks.classList.toggle('show');
        menuButton.textContent = navLinks.classList.contains('show') ? '✕' : '☰';
    });
    
    document.addEventListener('click', function(e) {
        if (!nav.contains(e.target) && navLinks.classList.contains('show')) {
            navLinks.classList.remove('show');
            menuButton.textContent = '☰';
        }
    });
    
    function updateMenuVisibility() {
        if (ResponsiveUtils.isMobile()) {
            menuButton.style.display = 'block';
            navLinks.classList.remove('show');
            menuButton.textContent = '☰';
        } else {
            menuButton.style.display = 'none';
            navLinks.classList.add('show');
        }
    }
    
    updateMenuVisibility();
    window.addEventListener('resize', updateMenuVisibility);
}

// Initialize responsive features
function initializeResponsiveFeatures() {
    ResponsiveUtils.adjustForMobile();
    ResponsiveUtils.initializeTouchEvents();
    
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            ResponsiveUtils.handleResize();
        }, 250);
    });
}

// Page-specific initialization functions
function initializeProductsPage() {
    const productsGrid = document.getElementById('productsGrid');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const sortFilter = document.getElementById('sortFilter');
    
    let products = [];
    let categories = [];
    
    async function loadProducts() {
        products = await ProductService.getProducts();
        categories = await ProductService.getCategories();
        
        categories.forEach(function(category) {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categoryFilter.appendChild(option);
        });
        
        renderProducts(products);
    }
    
    function renderProducts(productsToRender) {
        productsGrid.innerHTML = '';
        
        if (productsToRender.length === 0) {
            productsGrid.innerHTML = '<p class="message message-info">No products found</p>';
            return;
        }
        
        productsToRender.forEach(function(product) {
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
        
        document.querySelectorAll('.add-to-cart').forEach(function(button) {
            button.addEventListener('click', async function(e) {
                const productId = parseInt(e.target.dataset.id);
                const product = products.find(function(p) {
                    return p.id === productId;
                });
                
                if (!Utils.isLoggedIn()) {
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
    
    function applyFilters(productsList) {
        let filtered = [...productsList];
        
        const category = categoryFilter.value;
        if (category) {
            filtered = filtered.filter(function(product) {
                return product.category === category;
            });
        }
        
        const sortBy = sortFilter.value;
        if (sortBy === 'price-asc') {
            filtered.sort(function(a, b) {
                return a.price - b.price;
            });
        } else if (sortBy === 'price-desc') {
            filtered.sort(function(a, b) {
                return b.price - a.price;
            });
        } else if (sortBy === 'rating-desc') {
            filtered.sort(function(a, b) {
                return b.rating - a.rating;
            });
        }
        
        renderProducts(filtered);
    }
    
    searchInput.addEventListener('input', async function(e) {
        const query = e.target.value.toLowerCase();
        if (query.length >= 2) {
            const searchResults = await ProductService.searchProducts(query);
            applyFilters(searchResults);
        } else if (query.length === 0) {
            applyFilters(products);
        }
    });
    
    categoryFilter.addEventListener('change', function() {
        applyFilters(products);
    });
    
    sortFilter.addEventListener('change', function() {
        applyFilters(products);
    });
    
    loadProducts();
}

function initializeProductDetailsPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get('id'));
    
    if (!productId) {
        window.location.href = 'products.html';
        return;
    }
    
    async function loadProduct() {
        const product = await ProductService.getProductById(productId);
        
        if (!product) {
            window.location.href = 'products.html';
            return;
        }
        
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
        
        const addToCartBtn = document.getElementById('addToCartBtn');
        const quantityInput = document.getElementById('quantity');
        
        addToCartBtn.addEventListener('click', async function() {
            const quantity = parseInt(quantityInput.value) || 1;
            
            if (!Utils.isLoggedIn()) {
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
    }
    
    loadProduct();
}

function initializeCartPage() {
    if (Utils.redirectIfNotLoggedIn()) return;
    
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    const user = Utils.getCurrentUser();
    let cart = null;
    
    async function loadCart() {
        cart = await CartService.getCart(user.id);
        renderCart();
    }
    
    function renderCart() {
        if (!cart || cart.items.length === 0) {
            cartItems.innerHTML = '<p class="message message-info">Your cart is empty</p>';
            cartTotal.textContent = Utils.formatPrice(0);
            checkoutBtn.disabled = true;
            return;
        }
        
        cartItems.innerHTML = '';
        let total = 0;
        
        cart.items.forEach(function(item) {
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
        
        document.querySelectorAll('.decrease').forEach(function(btn) {
            btn.addEventListener('click', async function(e) {
                const productId = parseInt(e.target.dataset.id);
                const item = cart.items.find(function(i) {
                    return i.productId === productId;
                });
                if (item) {
                    await CartService.updateQuantity(user.id, productId, item.qty - 1);
                    cart = await CartService.getCart(user.id);
                    renderCart();
                    Navigation.updateCartCount();
                }
            });
        });
        
        document.querySelectorAll('.increase').forEach(function(btn) {
            btn.addEventListener('click', async function(e) {
                const productId = parseInt(e.target.dataset.id);
                const item = cart.items.find(function(i) {
                    return i.productId === productId;
                });
                if (item) {
                    await CartService.updateQuantity(user.id, productId, item.qty + 1);
                    cart = await CartService.getCart(user.id);
                    renderCart();
                    Navigation.updateCartCount();
                }
            });
        });
        
        document.querySelectorAll('.remove-item').forEach(function(btn) {
            btn.addEventListener('click', async function(e) {
                const productId = parseInt(e.target.dataset.id);
                await CartService.removeFromCart(user.id, productId);
                cart = await CartService.getCart(user.id);
                renderCart();
                Navigation.updateCartCount();
            });
        });
    }
    
    checkoutBtn.addEventListener('click', function() {
        window.location.href = 'checkout.html';
    });
    
    loadCart();
}

// Enhanced Checkout Page Initialization
function initializeCheckoutPage() {
    if (Utils.redirectIfNotLoggedIn()) return;
    
    const checkoutForm = document.getElementById('checkoutForm');
    const orderSummary = document.getElementById('orderSummary');
    const user = Utils.getCurrentUser();
    
    async function loadCheckout() {
        const cart = await CartService.getCart(user.id);
        
        if (!cart || cart.items.length === 0) {
            window.location.href = 'cart.html';
            return;
        }
        
        const total = CartService.calculateTotal(cart);
        orderSummary.innerHTML = `
            <h3>Order Summary</h3>
            <div style="margin: 1.5rem 0;">
                ${cart.items.map(function(item) {
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <img src="${item.image}" alt="${item.title}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">
                                <div>
                                    <div style="font-weight: 600;">${item.title}</div>
                                    <div style="font-size: 0.85rem; color: var(--text-light);">Qty: ${item.qty}</div>
                                </div>
                            </div>
                            <div style="font-weight: 600; color: var(--primary-color);">
                                ${Utils.formatPrice(item.price * item.qty)}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 1rem; padding-top: 1rem; border-top: 2px solid var(--border-color);">
                <span>Total Amount</span>
                <span>${Utils.formatPrice(total)}</span>
            </div>
        `;
        
        document.getElementById('fullName').value = user.name || '';
        document.getElementById('email').value = user.email || '';
        
        checkoutForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const shippingAddress = document.getElementById('address').value;
            const city = document.getElementById('city').value;
            const zip = document.getElementById('zip').value;
            const paymentMethod = document.getElementById('paymentMethod').value;
            
            if (!shippingAddress || !city || !zip || !paymentMethod) {
                Utils.showMessage('Please fill in all required fields', 'error');
                return;
            }
            
            const orderData = {
                userId: user.id,
                userEmail: user.email,
                userName: user.name,
                items: cart.items.map(item => ({
                    productId: item.productId,
                    title: item.title,
                    price: item.price,
                    image: item.image,
                    qty: item.qty
                })),
                shippingAddress: shippingAddress,
                city: city,
                zipCode: zip,
                paymentMethod: paymentMethod,
                total: total,
                status: 'processing',
                createdAt: new Date().toISOString(),
                orderNumber: Utils.generateOrderNumber()
            };
            
            try {
                const submitBtn = checkoutForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<div class="loading loading-small"></div> Processing...';
                submitBtn.disabled = true;
                
                // Save order to database
                const newOrder = await OrderService.createOrder(orderData);
                
                // Clear cart
                await CartService.clearCart(user.id);
                
                // Show success message
                checkoutForm.innerHTML = `
                    <div class="success-message" style="text-align: center;">
                        <h3><i class="fas fa-check-circle" style="color: var(--secondary-color); margin-right: 0.5rem;"></i>Order Placed Successfully!</h3>
                        <div style="margin: 1.5rem 0;">
                            <div style="font-size: 1.1rem; margin-bottom: 0.5rem;">
                                Order ID: <strong>${newOrder.orderNumber}</strong>
                            </div>
                            <div style="color: var(--text-light); margin-bottom: 1rem;">
                                Total Amount: <strong>${Utils.formatPrice(newOrder.total)}</strong>
                            </div>
                            <div style="background: var(--bg-light); padding: 1rem; border-radius: var(--radius); margin: 1rem 0;">
                                <div style="font-size: 0.9rem; color: var(--text-light); margin-bottom: 0.5rem;">Shipping Address:</div>
                                <div>${newOrder.shippingAddress}, ${newOrder.city}, ${newOrder.zipCode}</div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 1rem; justify-content: center;">
                            <a href="orders.html" class="btn btn-primary">
                                <i class="fas fa-history"></i> View Order History
                            </a>
                            <a href="index.html" class="btn btn-outline">
                                <i class="fas fa-shopping-bag"></i> Continue Shopping
                            </a>
                        </div>
                    </div>
                `;
                
                Navigation.updateCartCount();
                
            } catch (error) {
                Utils.showMessage('Error placing order. Please try again.', 'error');
                
                const submitBtn = checkoutForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            }
        });
    }
    
    loadCheckout();
}

// Initialize Orders Page (Order History)
function initializeOrdersPage() {
    if (Utils.redirectIfNotLoggedIn()) return;
    
    const ordersList = document.getElementById('ordersList');
    const noOrders = document.getElementById('noOrders');
    const user = Utils.getCurrentUser();
    
    async function loadOrders() {
        const orders = await OrderService.getOrders(user.id);
        renderOrders(orders);
    }
    
    function renderOrders(orders) {
        ordersList.innerHTML = '';
        
        if (orders.length === 0) {
            ordersList.style.display = 'none';
            noOrders.style.display = 'block';
            return;
        }
        
        noOrders.style.display = 'none';
        ordersList.style.display = 'flex';
        
        orders.forEach(function(order) {
            const orderCard = document.createElement('div');
            orderCard.className = 'order-card';
            
            const itemCount = order.items.reduce(function(total, item) {
                return total + item.qty;
            }, 0);
            
            const statusClass = OrderService.getOrderStatusClass(order.status);
            const statusText = OrderService.getOrderStatusText(order.status);
            
            orderCard.innerHTML = `
                <div class="order-header">
                    <div class="order-info">
                        <div class="order-id">
                            <i class="fas fa-receipt"></i>
                            Order #${order.orderNumber || order.id}
                        </div>
                        <div class="order-date">
                            <i class="far fa-calendar"></i>
                            ${Utils.formatDate(order.createdAt)}
                        </div>
                    </div>
                    <div class="order-status ${statusClass}">
                        ${statusText}
                    </div>
                </div>
                
                <div class="order-body">
                    <div class="order-summary">
                        <div class="summary-item">
                            <div class="summary-label">Total Amount</div>
                            <div class="summary-value">${Utils.formatPrice(order.total)}</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">Items</div>
                            <div class="summary-value">${itemCount} item${itemCount !== 1 ? 's' : ''}</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">Payment Method</div>
                            <div class="summary-value">${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 
                                                      order.paymentMethod === 'upi' ? 'UPI' : 
                                                      order.paymentMethod === 'credit_card' ? 'Credit Card' : 
                                                      order.paymentMethod === 'debit_card' ? 'Debit Card' : order.paymentMethod}</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">Shipping To</div>
                            <div class="summary-value">${order.city || 'N/A'}</div>
                        </div>
                    </div>
                    
                    <div class="order-items">
                        <h4 style="margin-bottom: 1rem; color: var(--text-color);">Ordered Items</h4>
                        ${order.items.map(function(item) {
                            return `
                                <div class="order-item">
                                    <img src="${item.image}" alt="${item.title}" class="order-item-image">
                                    <div class="order-item-details">
                                        <div class="order-item-title">${item.title}</div>
                                        <div class="order-item-price">${Utils.formatPrice(item.price)} each</div>
                                        <div class="order-item-qty">Quantity: ${item.qty}</div>
                                    </div>
                                    <div class="order-item-price">
                                        ${Utils.formatPrice(item.price * item.qty)}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div class="order-footer">
                    <div class="order-total">
                        Total: <span>${Utils.formatPrice(order.total)}</span>
                    </div>
                    <div class="order-actions">
                        <button class="btn btn-outline btn-small track-order" data-id="${order.id}">
                            <i class="fas fa-truck"></i> Track Order
                        </button>
                        <button class="btn btn-outline btn-small reorder" data-id="${order.id}">
                            <i class="fas fa-redo"></i> Reorder
                        </button>
                        <a href="orders.html" class="btn btn-outline btn-small">
                            <i class="fas fa-print"></i> Print
                        </a>
                    </div>
                </div>
            `;
            
            ordersList.appendChild(orderCard);
        });
        
        // Add event listeners for track and reorder buttons
        document.querySelectorAll('.track-order').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                const orderId = e.target.closest('button').dataset.id;
                Utils.showMessage(`Order #${orderId} is currently being processed.`, 'info', 3000);
            });
        });
        
        document.querySelectorAll('.reorder').forEach(function(btn) {
            btn.addEventListener('click', async function(e) {
                const orderId = e.target.closest('button').dataset.id;
                const order = await OrderService.getOrderById(orderId);
                
                if (order) {
                    for (const item of order.items) {
                        const product = {
                            id: item.productId,
                            title: item.title,
                            price: item.price,
                            image: item.image
                        };
                        await CartService.addToCart(user.id, product, item.qty);
                    }
                    
                    Utils.showMessage('All items have been added to your cart!', 'success');
                    Navigation.updateCartCount();
                    
                    setTimeout(function() {
                        window.location.href = 'cart.html';
                    }, 1500);
                }
            });
        });
    }
    
    loadOrders();
}

function initializeLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const user = await AuthService.login(email, password);
            
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
}

function initializeRegisterPage() {
    const registerForm = document.getElementById('registerForm');
    const errorMessage = document.getElementById('errorMessage');
    
    registerForm.addEventListener('submit', async function(e) {
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
}

function initializeHomePage() {
    const featuredProducts = document.getElementById('featuredProducts');
    
    if (!featuredProducts) {
        console.warn('Featured products container not found in HTML');
        return;
    }
    
    async function loadFeaturedProducts() {
        const products = await ProductService.getProducts();
        
        const featured = products.slice(0, 4);
        
        featured.forEach((product) => {
            const productCard = document.createElement('div');
            productCard.classList.add('product-card');
            
            const rating = Math.floor(product.rating || 0);
            const image = product.image || 'placeholder.jpg';
            const title = product.title || 'No Title';
            
            productCard.innerHTML = `
                <img src="${image}" alt="${title}" class="product-image">
                <div class="product-info">
                    <h3 class="product-title">${title}</h3>
                    <div class="product-price">
                        ${Utils.formatPrice(product.price)}
                    </div>
                    <div class="product-rating">
                        ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}
                        <span>(${product.rating})</span>
                    </div>
                    <button 
                        class="btn btn-primary btn-block add-to-cart" 
                        data-id="${product.id}">
                        Add to Cart
                    </button>
                    <a 
                        href="product-details.html?id=${product.id}" 
                        class="btn btn-outline btn-block" 
                        style="margin-top: 0.5rem;">
                        View Details
                    </a>
                </div>
            `;
            
            featuredProducts.appendChild(productCard);
        });
  
        document.querySelectorAll('.add-to-cart').forEach(function(button) {
            button.addEventListener('click', async function(e) {
                const productId = parseInt(e.target.dataset.id);
                const product = products.find(function(p) {
                    return p.id === productId;
                });
                
                if (!Utils.isLoggedIn()) {
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
    
    loadFeaturedProducts();
}

function initializeOrdersPage() {
    if (Utils.redirectIfNotLoggedIn()) return;
    
    const ordersList = document.getElementById('ordersList');
    const noOrders = document.getElementById('noOrders');
    const user = Utils.getCurrentUser();
    
    async function loadOrders() {
        try {
            const response = await fetch(`${API_BASE}/orders?userId=${user.id}`);
            const orders = await response.json();
            
            if (orders.length === 0) {
                ordersList.style.display = 'none';
                noOrders.style.display = 'block';
                return;
            }
            
            ordersList.innerHTML = '';
            
            orders.forEach(function(order) {
                const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN');
                const orderStatus = order.status || 'processing';
                const statusClass = `status-${orderStatus}`;
                
                const orderCard = document.createElement('div');
                orderCard.className = 'order-card';
                orderCard.innerHTML = `
                    <div class="order-header">
                        <div class="order-info">
                            <h3>Order #${order.id}</h3>
                            <p class="order-date">${orderDate}</p>
                        </div>
                        <div class="order-status">
                            <span class="status-badge ${statusClass}">${orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1)}</span>
                        </div>
                    </div>
                    
                    <div class="order-items">
                        ${order.items.map(function(item) {
                            return `
                                <div class="order-item">
                                    <img src="${item.image}" alt="${item.title}" class="order-item-image">
                                    <div class="order-item-details">
                                        <h4>${item.title}</h4>
                                        <p>Quantity: ${item.qty} × ${Utils.formatPrice(item.price)}</p>
                                    </div>
                                    <div class="order-item-price">
                                        ${Utils.formatPrice(item.price * item.qty)}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    <div class="order-footer">
                        <div class="order-address">
                            <p><strong>Shipping Address:</strong></p>
                            <p>${order.shippingAddress || 'Not provided'}</p>
                        </div>
                        <div class="order-total">
                            <p>Total: <strong>${Utils.formatPrice(order.total)}</strong></p>
                        </div>
                    </div>
                `;
                
                ordersList.appendChild(orderCard);
            });
        } catch (error) {
            console.error('Error loading orders:', error);
            ordersList.innerHTML = '<p class="message message-error">Failed to load orders</p>';
        }
    }
    
    loadOrders();
}

// Main initialization function
function initializePage() {
    Navigation.init();
    LuxuryAnimations.init();
    ImageBannerAnimations.init();
    initializeResponsiveFeatures();
    createMobileMenu();
    
    initializeCarouselImages();
    initializeCarouselParallax();
    initializeCarouselKeyboard();
    initializeCarouselTouch();
    
    const carousel = document.querySelector('.carousel-container');
    if (carousel) {
        showSlide(0);
        carouselInterval = setInterval(autoSlide, 5000);
    }
    
    const style = document.createElement('style');
    style.textContent = `
        .carousel-slide.exiting {
            opacity: 0 !important;
            transition: opacity 0.8s ease !important;
        }
        
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
    document.head.appendChild(style);
    
    const mobileStyle = document.createElement('style');
    mobileStyle.textContent = `
        @media (max-width: 768px) {
            .mobile-menu-btn {
                display: block !important;
            }
            
            .nav-links:not(.show) {
                display: none !important;
            }
            
            .nav-links.show {
                display: flex !important;
                flex-direction: column;
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: var(--bg-color);
                padding: 1rem;
                box-shadow: var(--shadow);
                z-index: 999;
            }
            
            .nav-links.show li {
                width: 100%;
                margin: 0.5rem 0;
            }
            
            .btn, button {
                min-height: 44px;
                min-width: 44px;
            }
            
            .btn, button, a {
                -webkit-tap-highlight-color: transparent;
                user-select: none;
            }
            
            input, select, textarea {
                font-size: 16px !important;
            }
        }
        
        @media (hover: hover) {
            .btn:hover {
                transform: translateY(-2px);
            }
            
            .product-card:hover {
                transform: translateY(-5px);
            }
        }
    `;
    document.head.appendChild(mobileStyle);
    
    // Initialize page-specific functionality
    if (window.location.pathname.includes('products.html')) {
        initializeProductsPage();
    } else if (window.location.pathname.includes('product-details.html')) {
        initializeProductDetailsPage();
    } else if (window.location.pathname.includes('cart.html')) {
        initializeCartPage();
    } else if (window.location.pathname.includes('checkout.html')) {
        initializeCheckoutPage();
    } else if (window.location.pathname.includes('login.html')) {
        initializeLoginPage();
    } else if (window.location.pathname.includes('register.html')) {
        initializeRegisterPage();
    } else if (window.location.pathname.includes('orders.html')) {
        initializeOrdersPage();
    } else if (window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
        initializeHomePage();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePage);
