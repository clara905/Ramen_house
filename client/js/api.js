const API_BASE_URL = 'http://localhost:5000/api';

// Loading Spinner Helpers
let activeRequests = 0;
let spinnerTimeout = null;

function showSpinner() {
  const spinner = document.getElementById('loading-spinner');
  if (spinner) {
    if (spinnerTimeout) {
      clearTimeout(spinnerTimeout);
      spinnerTimeout = null;
    }
    spinner.style.opacity = '1';
    spinner.style.display = 'flex';
  }
}

function hideSpinner(force = false) {
  if (activeRequests > 0 && !force) return;
  const spinner = document.getElementById('loading-spinner');
  if (spinner) {
    spinner.style.opacity = '0';
    if (spinnerTimeout) clearTimeout(spinnerTimeout);
    spinnerTimeout = setTimeout(() => {
      spinner.style.display = 'none';
      spinnerTimeout = null;
    }, 300);
  }
}

// Automatically hide spinner on initial load once DOM content is ready
document.addEventListener('DOMContentLoaded', () => {
  hideSpinner();
});

// SweetAlert2 Toast Helper
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

function showToast(icon, message) {
  Toast.fire({
    icon: icon, // 'success', 'error', 'warning', 'info'
    title: message
  });
}

// Currency Formatter
function formatPrice(amount) {
  return '$' + parseFloat(amount).toFixed(2);
}

// Fetch Wrapper with JWT Injection and Error Handling
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  // Set default headers
  const headers = { ...options.headers };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Determine if sending FormData (don't set Content-Type header manually for FormData)
  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const fetchOptions = {
    ...options,
    headers
  };

  try {
    activeRequests++;
    showSpinner();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);
    
    // Auto handle 401 Unauthorized (session expired)
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      showToast('error', 'Session expired. Please log in.');
      setTimeout(() => {
        window.location.href = '/client/pages/login.html';
      }, 1500);
      return null;
    }
    
    // Auto handle 403 Forbidden
    if (response.status === 403) {
      showToast('error', 'You are not authorized to access this resource.');
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Request Failure:', error);
    showToast('error', 'Network error. Please try again later.');
    return null;
  } finally {
    activeRequests--;
    hideSpinner();
  }
}

// Authentication Helpers
function getLoggedInUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

function isLoggedIn() {
  return localStorage.getItem('token') !== null;
}

function isAdmin() {
  const user = getLoggedInUser();
  return user && user.role === 'admin';
}

function isCustomer() {
  const user = getLoggedInUser();
  return user && user.role === 'customer';
}
