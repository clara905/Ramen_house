// Shopping Cart Local Storage Manager

function getCart() {
  const cart = localStorage.getItem('cart');
  return cart ? JSON.parse(cart) : [];
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadge();
  if (window.loadMenu) {
    window.loadMenu();
  }
  if (window.loadMenuDetail) {
    window.loadMenuDetail();
  }
}

function addToCart(menuItem, quantity = 1) {
  if (!isLoggedIn()) {
    Swal.fire({
      title: 'Login Required',
      text: 'You need to login first to place an order or add items to your cart.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#C62828',
      cancelButtonColor: '#2D2D2D',
      confirmButtonText: 'Login Now',
      cancelButtonText: 'Browse Menu'
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = '/client/pages/login.html';
      }
    });
    return;
  }

  const cart = getCart();
  const existingItemIndex = cart.findIndex(item => item.id === menuItem.id);

  if (existingItemIndex > -1) {
    cart[existingItemIndex].quantity += parseInt(quantity);
  } else {
    cart.push({
      id: menuItem.id,
      name: menuItem.name,
      price: parseFloat(menuItem.price),
      image: menuItem.image,
      quantity: parseInt(quantity)
    });
  }

  saveCart(cart);
  showToast('success', `Added "${menuItem.name}" to cart!`);
}

function updateCartQty(itemId, quantity) {
  const cart = getCart();
  const itemIndex = cart.findIndex(item => item.id === parseInt(itemId));

  if (itemIndex > -1) {
    const newQty = parseInt(quantity);
    if (newQty <= 0) {
      cart.splice(itemIndex, 1);
    } else {
      cart[itemIndex].quantity = newQty;
    }
    saveCart(cart);
  }
}

function removeFromCart(itemId) {
  const cart = getCart();
  const filteredCart = cart.filter(item => item.id !== parseInt(itemId));
  saveCart(filteredCart);
  showToast('info', 'Item removed from cart.');
}

function clearCart() {
  localStorage.removeItem('cart');
  updateCartBadge();
}

function getCartTotal() {
  const cart = getCart();
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge-count');
  if (!badge) return;

  const cart = getCart();
  const totalQty = cart.reduce((total, item) => total + item.quantity, 0);
  badge.textContent = totalQty;
}

// Make functions globally available
window.updateCartBadge = updateCartBadge;
window.getCart = getCart;
window.addToCart = addToCart;
window.updateCartQty = updateCartQty;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.getCartTotal = getCartTotal;
