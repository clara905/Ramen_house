// Auth page functions and route protection

document.addEventListener('DOMContentLoaded', () => {
  // Page protection checks
  protectRoutes();

  // Setup navbar adjustments
  setupNavbar();

  // 1. Login Form Submit
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // 2. Register Form Submit
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }

  // 3. Forgot Password Form Submit
  const forgotForm = document.getElementById('forgot-form');
  if (forgotForm) {
    forgotForm.addEventListener('submit', handleForgotPassword);
  }

  // 4. Logout trigger
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // 5. Toggle Password Show/Hide
  const togglePasswordBtn = document.getElementById('toggle-password');
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      const passwordInput = document.getElementById('password');
      const icon = document.getElementById('toggle-password-icon');
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    });
  }
});

// Route Protection Logic
function protectRoutes() {
  const path = window.location.pathname.toLowerCase();
  const user = getLoggedInUser();

  // Admin page list
  const adminPages = ['/pages/dashboard.html', '/pages/inventory.html', '/pages/orders.html', '/pages/reports.html'];
  // Customer pages that require login
  const customerProtectedPages = ['/pages/cart.html', '/pages/checkout.html', '/pages/order-history.html', '/pages/profile.html'];

  const isAdminPage = adminPages.some(page => path.endsWith(page));
  const isCustomerPage = customerProtectedPages.some(page => path.endsWith(page));

  if (isAdminPage) {
    if (!isLoggedIn()) {
      window.location.href = 'login.html';
    } else if (!isAdmin()) {
      window.location.href = '../index.html'; // Go to homepage
    }
  }

  if (isCustomerPage) {
    if (!isLoggedIn()) {
      window.location.href = 'login.html';
    }
  }
}

// Navbar adjustment according to session state
function setupNavbar() {
  const navbarNav = document.getElementById('navbar-nav-links');
  if (!navbarNav) return;

  const loggedIn = isLoggedIn();
  const user = getLoggedInUser();

  let linksHtml = '';

  if (loggedIn) {
    if (user.role === 'admin') {
      linksHtml = `
        <li class="nav-item"><a class="nav-link" href="/client/pages/dashboard.html"><i class="fas fa-chart-line"></i> Admin Dashboard</a></li>
        <li class="nav-item"><a class="nav-link" href="#" id="logout-btn"><i class="fas fa-sign-out-alt"></i> Logout</a></li>
      `;
    } else {
      // Customer navbar
      linksHtml = `
        <li class="nav-item"><a class="nav-link" href="/client/index.html">Home</a></li>
        <li class="nav-item"><a class="nav-link" href="/client/pages/menu.html">Menu</a></li>
        <li class="nav-item"><a class="nav-link" href="/client/pages/order-history.html">My Orders</a></li>
        <li class="nav-item"><a class="nav-link" href="/client/pages/profile.html">My Profile</a></li>
        <li class="nav-item">
          <a class="nav-link cart-icon-wrapper" href="/client/pages/cart.html">
            <i class="fas fa-shopping-cart"></i> Cart
            <span class="cart-badge" id="cart-badge-count">0</span>
          </a>
        </li>
        <li class="nav-item"><a class="nav-link" href="#" id="logout-btn"><i class="fas fa-sign-out-alt"></i> Logout</a></li>
      `;
    }
  } else {
    // Guest navbar
    linksHtml = `
      <li class="nav-item"><a class="nav-link" href="/client/index.html">Home</a></li>
      <li class="nav-item"><a class="nav-link" href="/client/pages/menu.html">Menu</a></li>
      <li class="nav-item"><a class="nav-link btn btn-ramen-primary text-white py-1 px-3" href="/client/pages/login.html">Login</a></li>
    `;
  }

  navbarNav.innerHTML = linksHtml;

  // Re-bind logout buttons if dynamic navbar rendered
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Update cart badge if function exists
  if (window.updateCartBadge) {
    window.updateCartBadge();
  }
}

// 1. Handle Login
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    showToast('error', 'Please fill all fields.');
    return;
  }

  const result = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password }
  });

  if (result && result.success) {
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));

    showToast('success', result.message);
    
    setTimeout(() => {
      if (result.user.role === 'admin') {
        window.location.href = 'dashboard.html';
      } else {
        window.location.href = '../index.html';
      }
    }, 1200);
  } else if (result) {
    showToast('error', result.message || 'Login failed.');
  }
}

// 2. Handle Register
async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();

  if (!name || !email || !password) {
    showToast('error', 'Please fill all required fields.');
    return;
  }

  const result = await apiRequest('/auth/register', {
    method: 'POST',
    body: { name, email, password, phone, address }
  });

  if (result && result.success) {
    showToast('success', result.message);
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1500);
  } else if (result) {
    showToast('error', result.message || 'Registration failed.');
  }
}

// 3. Handle Forgot Password
async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();

  if (!email) {
    showToast('error', 'Please enter your email address.');
    return;
  }

  const result = await apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: { email }
  });

  if (result && result.success) {
    Swal.fire({
      icon: 'success',
      title: 'Email Sent',
      text: result.message,
      confirmButtonColor: '#C62828'
    }).then(() => {
      window.location.href = 'login.html';
    });
  } else if (result) {
    showToast('error', result.message || 'Password reset request failed.');
  }
}

// 4. Handle Logout
function handleLogout(e) {
  if (e) e.preventDefault();
  
  Swal.fire({
    title: 'Logout',
    text: 'Are you sure you want to log out?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#C62828',
    cancelButtonColor: '#2D2D2D',
    confirmButtonText: 'Yes, log out!'
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('cart'); // Optionally clear customer cart on logout
      showToast('success', 'Logged out successfully.');
      setTimeout(() => {
        window.location.href = '/client/index.html';
      }, 1000);
    }
  });
}
