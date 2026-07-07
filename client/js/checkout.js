// Checkout Process Controller

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.toLowerCase().endsWith('checkout.html')) return;

  // Initialize checkout
  loadCheckoutSummary();
  prefillCustomerInfo();

  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', handleCheckoutSubmit);
  }
});

// 1. Prefill customer details if logged in
async function prefillCustomerInfo() {
  const user = getLoggedInUser();
  if (!user) return;

  const response = await apiRequest('/auth/profile');
  if (response && response.success) {
    const userProfile = response.user;
    if (document.getElementById('checkout-name')) {
      document.getElementById('checkout-name').value = userProfile.name || '';
    }
    if (document.getElementById('checkout-phone')) {
      document.getElementById('checkout-phone').value = userProfile.phone || '';
    }
    if (document.getElementById('checkout-address')) {
      document.getElementById('checkout-address').value = userProfile.address || '';
    }
  }
}

// 2. Load Checkout Order Summary
function loadCheckoutSummary() {
  const summaryContainer = document.getElementById('checkout-summary-items');
  const summaryTotal = document.getElementById('checkout-summary-total');
  
  if (!summaryContainer) return;

  const cart = getCart();
  if (cart.length === 0) {
    showToast('warning', 'Your cart is empty. Redirecting to menu...');
    setTimeout(() => {
      window.location.href = 'menu.html';
    }, 1500);
    return;
  }

  let html = '';
  let grandTotal = 0;

  cart.forEach(item => {
    const subtotal = item.price * item.quantity;
    grandTotal += subtotal;
    html += `
      <div class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
        <div>
          <h6 class="mb-0 fw-semibold">${item.name}</h6>
          <small class="text-muted">${item.quantity} x ${formatPrice(item.price)}</small>
        </div>
        <span class="fw-bold">${formatPrice(subtotal)}</span>
      </div>
    `;
  });

  summaryContainer.innerHTML = html;
  if (summaryTotal) {
    summaryTotal.textContent = formatPrice(grandTotal);
  }
}

// 3. Handle Order Checkout Form Submission
async function handleCheckoutSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('checkout-name').value.trim();
  const phone = document.getElementById('checkout-phone').value.trim();
  const address = document.getElementById('checkout-address').value.trim();
  const notes = document.getElementById('checkout-notes').value.trim();
  const paymentMethodElement = document.querySelector('input[name="payment_method"]:checked');

  if (!name || !phone || !address) {
    showToast('error', 'Please fill name, phone, and delivery address.');
    return;
  }

  if (!paymentMethodElement) {
    showToast('error', 'Please select a payment method.');
    return;
  }

  const payment_method = paymentMethodElement.value;
  const cart = getCart();

  const orderItems = cart.map(item => ({
    menu_id: item.id,
    quantity: item.quantity
  }));

  // Confirm with SweetAlert before checking out
  Swal.fire({
    title: 'Place Order',
    text: `Confirm checkout of ${formatPrice(getCartTotal())}?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#C62828',
    cancelButtonColor: '#2D2D2D',
    confirmButtonText: 'Yes, Order Now!'
  }).then(async (result) => {
    if (result.isConfirmed) {
      const response = await apiRequest('/orders/checkout', {
        method: 'POST',
        body: {
          name,
          phone,
          address,
          notes,
          payment_method,
          items: orderItems
        }
      });

      if (response && response.success) {
        // Clear local cart
        clearCart();

        let paymentAlertText = 'Order received!';
        if (payment_method === 'QRIS') {
          paymentAlertText = 'Please prepare to scan the QRIS code to finalize payment at checkout.';
        } else if (payment_method === 'Bank Transfer') {
          paymentAlertText = 'Our bank account details will be shared to process your transfer.';
        }

        Swal.fire({
          title: 'Order Placed!',
          text: `Your order was submitted. ${paymentAlertText}`,
          icon: 'success',
          confirmButtonColor: '#C62828'
        }).then(() => {
          // Redirect to orders tracking list
          window.location.href = 'order-history.html';
        });
      } else if (response) {
        showToast('error', response.message || 'Checkout failed. Please try again.');
      }
    }
  });
}
