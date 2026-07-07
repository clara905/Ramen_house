// Orders Controller (Customer and Admin functions)

let currentPage = 1;
const limit = 10;

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname.toLowerCase();

  if (path.endsWith('order-history.html')) {
    loadCustomerOrders();
  } else if (path.endsWith('orders.html')) {
    loadAdminOrders();

    // Filter bindings
    const statusFilter = document.getElementById('admin-order-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        currentPage = 1;
        loadAdminOrders();
      });
    }
  }
});

// ==================================================
// CUSTOMER OR HISTORY FUNCTIONS
// ==================================================
async function loadCustomerOrders() {
  const container = document.getElementById('customer-orders-list');
  if (!container) return;

  const response = await apiRequest('/orders/customer/orders');
  if (!response || !response.success || response.data.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-muted">
          <i class="fas fa-receipt fa-2x mb-3 d-block"></i>
          You have not placed any orders yet.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  response.data.forEach(order => {
    html += `
      <tr>
        <td class="fw-semibold">#RH-${order.id}</td>
        <td>${new Date(order.order_date).toLocaleDateString()}</td>
        <td>${order.payment_method}</td>
        <td class="fw-bold text-primary-ramen">${formatPrice(order.total_price)}</td>
        <td>
          <span class="badge-ramen ${getStatusBadgeClass(order.status)}">${order.status}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-ramen-outline py-1 px-3" onclick="viewOrderDetails(${order.id})">
            <i class="fas fa-eye"></i> Track
          </button>
        </td>
      </tr>
    `;
  });

  container.innerHTML = html;
}

// Track Order Detail Modal/Overlay
async function viewOrderDetails(orderId) {
  const response = await apiRequest(`/orders/${orderId}`);
  if (!response || !response.success) {
    showToast('error', 'Could not load order details.');
    return;
  }

  const order = response.data;
  
  // Render tracking steps
  const steps = ['Waiting', 'Cooking', 'Ready', 'Completed'];
  const currentStepIndex = steps.indexOf(order.status);

  let trackingHtml = '<div class="row text-center mt-3 mb-5 position-relative">';
  // draw progress line connecting dots
  trackingHtml += `
    <div class="position-absolute top-50 start-50 translate-middle-y w-75 bg-light" style="height: 4px; z-index: 1; left: 12.5%;">
      <div class="bg-primary-ramen h-100" style="width: ${currentStepIndex === -1 ? 0 : (currentStepIndex / (steps.length - 1)) * 100}%; transition: width 0.5s;"></div>
    </div>
  `;

  steps.forEach((step, index) => {
    let stepClass = 'bg-secondary text-white';
    if (order.status === 'Cancelled' && index <= 1) {
      stepClass = 'bg-danger text-white';
    } else if (index <= currentStepIndex) {
      stepClass = 'bg-primary-ramen text-white';
    }
    
    let icon = 'fa-clock';
    if (step === 'Cooking') icon = 'fa-fire-alt';
    if (step === 'Ready') icon = 'fa-bell';
    if (step === 'Completed') icon = 'fa-check';

    trackingHtml += `
      <div class="col-3" style="position: relative; z-index: 2;">
        <div class="rounded-circle d-flex justify-content-center align-items-center mx-auto mb-2 shadow-sm ${stepClass}" style="width: 45px; height: 45px;">
          <i class="fas ${icon}"></i>
        </div>
        <div class="fw-semibold small">${step}</div>
      </div>
    `;
  });
  trackingHtml += '</div>';

  // Render items bought table
  let itemsHtml = '';
  order.items.forEach(item => {
    itemsHtml += `
      <div class="d-flex align-items-center mb-3 pb-3 border-bottom">
        <img src="http://localhost:5000/uploads/${item.menu_image || 'chicken_ramen.jpg'}" onerror="this.src='https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=100'" class="rounded" style="width: 50px; height: 50px; object-fit: cover; margin-right: 15px;">
        <div class="flex-grow-1">
          <h6 class="mb-0 fw-semibold">${item.menu_name}</h6>
          <small class="text-muted">${item.quantity} x ${formatPrice(item.price)}</small>
        </div>
        <span class="fw-bold">${formatPrice(item.subtotal)}</span>
      </div>
    `;
  });

  const modalBody = `
    <div>
      <div class="mb-4">
        <h5 class="fw-bold mb-1">Order #RH-${order.id}</h5>
        <span class="text-muted small">Placed on ${new Date(order.order_date).toLocaleString()}</span>
      </div>
      
      ${order.status === 'Cancelled' ? `
        <div class="alert alert-danger text-center fw-bold py-2 mb-4">
          <i class="fas fa-times-circle"></i> This order was Cancelled.
        </div>
      ` : trackingHtml}

      <div class="row mb-4">
        <div class="col-md-6 mb-3 mb-md-0">
          <h6 class="fw-bold border-bottom pb-2">Delivery Details</h6>
          <p class="mb-1 small"><strong>Name:</strong> ${order.name}</p>
          <p class="mb-1 small"><strong>Phone:</strong> ${order.phone}</p>
          <p class="mb-0 small"><strong>Address:</strong> ${order.address}</p>
          ${order.notes ? `<p class="mt-2 mb-0 small text-muted"><strong>Notes:</strong> ${order.notes}</p>` : ''}
        </div>
        <div class="col-md-6">
          <h6 class="fw-bold border-bottom pb-2">Payment Info</h6>
          <p class="mb-1 small"><strong>Method:</strong> ${order.payment_method}</p>
          <p class="mb-0 small"><strong>Status:</strong> <span class="badge bg-secondary">${order.payment_status}</span></p>
          ${order.payment_status === 'Pending' && ['QRIS', 'Bank Transfer'].includes(order.payment_method) ? `
            <button class="btn btn-sm btn-success mt-2 w-100 py-1 px-3 fw-semibold" style="border-radius: 8px;" onclick="simulatePaymentFlow(${order.id}, '${order.payment_method}', ${order.total_price})">
              <i class="fas fa-wallet me-1"></i> Bayar Sekarang (Simulasi)
            </button>
          ` : ''}
        </div>
      </div>

      <h6 class="fw-bold border-bottom pb-2 mb-3">Items Summary</h6>
      ${itemsHtml}
      
      <div class="d-flex justify-content-between align-items-center mt-3 pt-2">
        <h5 class="fw-bold">Total Amount</h5>
        <h4 class="fw-bold text-primary-ramen">${formatPrice(order.total_price)}</h4>
      </div>
    </div>
  `;

  Swal.fire({
    html: modalBody,
    showConfirmButton: true,
    confirmButtonColor: '#C62828',
    confirmButtonText: 'Close Window',
    width: '600px'
  });
}

// ==================================================
// ADMIN ORDER MANAGEMENT FUNCTIONS
// ==================================================
async function loadAdminOrders() {
  const container = document.getElementById('admin-orders-list');
  if (!container) return;

  const statusFilter = document.getElementById('admin-order-status-filter');
  const status = statusFilter ? statusFilter.value : '';

  const response = await apiRequest(`/orders/admin/orders?status=${status}&page=${currentPage}&limit=${limit}`);
  
  if (!response || !response.success || response.data.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-muted">No orders found.</td>
      </tr>
    `;
    return;
  }

  let html = '';
  response.data.forEach(order => {
    html += `
      <tr>
        <td class="fw-bold">#RH-${order.id}</td>
        <td>${order.name}</td>
        <td>${new Date(order.order_date).toLocaleString()}</td>
        <td>${order.payment_method}</td>
        <td class="fw-bold text-primary-ramen">${formatPrice(order.total_price)}</td>
        <td>
          <select class="form-select form-select-sm" onchange="updateOrderStatus(${order.id}, this.value)" style="width: 130px;">
            <option value="Waiting" ${order.status === 'Waiting' ? 'selected' : ''}>Waiting</option>
            <option value="Cooking" ${order.status === 'Cooking' ? 'selected' : ''}>Cooking</option>
            <option value="Ready" ${order.status === 'Ready' ? 'selected' : ''}>Ready</option>
            <option value="Completed" ${order.status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td>
          <span class="badge bg-${order.payment_status === 'Paid' ? 'success' : 'warning'}" 
                style="cursor: pointer;" 
                onclick="togglePaymentStatus(${order.id}, '${order.payment_status}')">
            ${order.payment_status}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-ramen-dark py-1 px-3" onclick="viewOrderDetails(${order.id})">
            <i class="fas fa-list"></i> Details
          </button>
        </td>
      </tr>
    `;
  });

  container.innerHTML = html;
  renderAdminOrdersPagination(response.pagination);
}

async function updateOrderStatus(orderId, newStatus) {
  const response = await apiRequest(`/orders/${orderId}/status`, {
    method: 'PUT',
    body: { status: newStatus }
  });

  if (response && response.success) {
    showToast('success', response.message);
    loadAdminOrders();
  } else if (response) {
    showToast('error', response.message || 'Status update failed.');
  }
}

async function togglePaymentStatus(orderId, currentStatus) {
  const newPayStatus = currentStatus === 'Paid' ? 'Pending' : 'Paid';
  
  // Call status update API with same order status but updated payment status
  const orders = await apiRequest(`/orders/${orderId}`);
  if (!orders || !orders.success) return;

  const response = await apiRequest(`/orders/${orderId}/status`, {
    method: 'PUT',
    body: { 
      status: orders.data.status, 
      payment_status: newPayStatus 
    }
  });

  if (response && response.success) {
    showToast('success', 'Payment status updated!');
    loadAdminOrders();
  }
}

function renderAdminOrdersPagination(pagination) {
  const container = document.getElementById('admin-orders-pagination');
  if (!container) return;

  let html = '';
  const totalPages = pagination.totalPages;

  // Previous Button
  html += `
    <li class="page-item">
      <a class="page-link-ramen ${currentPage === 1 ? 'disabled' : ''}" href="#" onclick="changeOrdersPage(${currentPage - 1})">
        <i class="fas fa-chevron-left"></i>
      </a>
    </li>
  `;

  for (let i = 1; i <= totalPages; i++) {
    html += `
      <li class="page-item">
        <a class="page-link-ramen ${currentPage === i ? 'active' : ''}" href="#" onclick="changeOrdersPage(${i})">${i}</a>
      </li>
    `;
  }

  // Next Button
  html += `
    <li class="page-item">
      <a class="page-link-ramen ${currentPage === totalPages ? 'disabled' : ''}" href="#" onclick="changeOrdersPage(${currentPage + 1})">
        <i class="fas fa-chevron-right"></i>
      </a>
    </li>
  `;

  container.innerHTML = html;
}

function changeOrdersPage(pageNumber) {
  currentPage = pageNumber;
  loadAdminOrders();
}

// Helpers
function getStatusBadgeClass(status) {
  switch (status) {
    case 'Waiting': return 'badge-waiting';
    case 'Cooking': return 'badge-cooking';
    case 'Ready': return 'badge-ready';
    case 'Completed': return 'badge-completed';
    case 'Cancelled': return 'badge-cancelled';
    default: return 'bg-secondary';
  }
}

// 7. Simulate User Payment Flow
async function simulatePaymentFlow(orderId, paymentMethod, totalAmount) {
  let contentHtml = '';
  
  if (paymentMethod === 'QRIS') {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=RamenHouse-Order-${orderId}`;
    contentHtml = `
      <div class="payment-simulation-container text-center py-2">
        <div class="qris-header mb-3 p-2 bg-light rounded d-flex justify-content-between align-items-center" style="border-left: 4px solid #C62828;">
          <span class="fw-bold text-dark fs-5" style="letter-spacing: 2px;">QRIS</span>
          <span class="badge bg-danger">GPN / Link</span>
        </div>
        <p class="text-muted small mb-3">Pindai QR Code di bawah dengan aplikasi E-Wallet atau Mobile Banking Anda untuk menyelesaikan pembayaran.</p>
        
        <div class="qr-code-wrapper p-3 border rounded bg-white d-inline-block shadow-sm mb-3 position-relative" style="border: 2px dashed #C62828 !important;">
          <img src="${qrUrl}" alt="QRIS Code" class="img-fluid" style="width: 220px; height: 220px;">
        </div>
        
        <div class="amount-card p-3 rounded mb-3 bg-light border">
          <div class="small text-muted mb-1">Total Pembayaran</div>
          <h3 class="fw-bold text-primary-ramen mb-0">${formatPrice(totalAmount)}</h3>
          <div class="small text-muted mt-1">Order ID: #RH-${orderId}</div>
        </div>
        
        <div class="alert alert-warning py-2 small mb-4 text-start">
          <i class="fas fa-info-circle me-1"></i> Ini adalah simulasi pembayaran. Klik tombol di bawah untuk menyimulasikan respon transaksi berhasil dari sistem payment gateway.
        </div>

        <button id="btn-simulate-pay-success" class="btn btn-ramen-primary w-100 py-2 fw-bold text-white">
          <i class="fas fa-check-circle me-1"></i> Simulasikan Pembayaran Berhasil
        </button>
      </div>
    `;
  } else if (paymentMethod === 'Bank Transfer') {
    const vaNumber = `80777${String(orderId).padStart(4, '0')}`;
    contentHtml = `
      <div class="payment-simulation-container text-start py-2">
        <div class="mb-4 text-center">
          <h5 class="fw-bold text-dark">Simulasi Transfer Bank / Virtual Account</h5>
          <p class="text-muted small">Kirim pembayaran Anda ke nomor Virtual Account berikut.</p>
        </div>

        <div class="card border shadow-sm rounded p-3 mb-3">
          <div class="mb-3 border-bottom pb-2">
            <span class="small text-muted d-block">Nama Bank</span>
            <span class="fw-bold text-primary" style="font-size: 1.1rem;"><i class="fas fa-university me-1"></i> Bank BCA (Virtual Account)</span>
          </div>

          <div class="mb-3 border-bottom pb-2 d-flex justify-content-between align-items-center">
            <div>
              <span class="small text-muted d-block">Nomor Virtual Account</span>
              <span class="fw-bold fs-5 text-dark" id="va-number-text" style="letter-spacing: 1px;">${vaNumber}</span>
            </div>
            <button class="btn btn-sm btn-outline-secondary py-1" onclick="navigator.clipboard.writeText('${vaNumber}').then(() => { Swal.showValidationMessage('VA copied to clipboard!'); setTimeout(() => Swal.resetValidationMessage(), 2000); })">
              <i class="fas fa-copy"></i> Salin
            </button>
          </div>

          <div class="d-flex justify-content-between align-items-center">
            <div>
              <span class="small text-muted d-block">Total Nominal Transfer</span>
              <span class="fw-bold fs-5 text-primary-ramen">${formatPrice(totalAmount)}</span>
            </div>
            <button class="btn btn-sm btn-outline-secondary py-1" onclick="navigator.clipboard.writeText('${totalAmount}').then(() => { Swal.showValidationMessage('Amount copied to clipboard!'); setTimeout(() => Swal.resetValidationMessage(), 2000); })">
              <i class="fas fa-copy"></i> Salin
            </button>
          </div>
        </div>

        <div class="alert alert-info py-2 small mb-4">
          <i class="fas fa-info-circle me-1"></i> <strong>Instruksi Transfer:</strong><br>
          1. Buka Mobile Banking BCA.<br>
          2. Pilih m-Transfer > BCA Virtual Account.<br>
          3. Input nomor VA di atas.<br>
          4. Periksa nominal pembayaran.<br>
          5. Selesaikan transaksi.
        </div>

        <button id="btn-simulate-pay-success" class="btn btn-ramen-primary w-100 py-2 fw-bold text-white">
          <i class="fas fa-check-circle me-1"></i> Simulasikan Pembayaran Berhasil
        </button>
      </div>
    `;
  }

  Swal.fire({
    html: contentHtml,
    showConfirmButton: false,
    showCloseButton: true,
    width: '450px',
    didOpen: () => {
      const simulateBtn = document.getElementById('btn-simulate-pay-success');
      if (simulateBtn) {
        simulateBtn.addEventListener('click', async () => {
          Swal.showLoading();
          
          const response = await apiRequest(`/orders/${orderId}/pay`, {
            method: 'POST'
          });

          if (response && response.success) {
            Swal.fire({
              title: 'Pembayaran Berhasil!',
              text: 'Simulasi pembayaran sukses diproses. Pesanan Anda segera disiapkan.',
              icon: 'success',
              confirmButtonColor: '#C62828'
            }).then(() => {
              // Reload details modal to reflect updated payment & order status
              viewOrderDetails(orderId);
              // Also refresh main order history table if it exists
              const customerOrdersList = document.getElementById('customer-orders-list');
              if (customerOrdersList) {
                loadCustomerOrders();
              }
            });
          } else {
            Swal.fire({
              title: 'Simulasi Gagal',
              text: response ? response.message : 'Terjadi kesalahan sistem.',
              icon: 'error',
              confirmButtonColor: '#C62828'
            });
          }
        });
      }
    }
  });
}

// Make globally accessible
window.viewOrderDetails = viewOrderDetails;
window.updateOrderStatus = updateOrderStatus;
window.togglePaymentStatus = togglePaymentStatus;
window.changeOrdersPage = changeOrdersPage;
window.simulatePaymentFlow = simulatePaymentFlow;
