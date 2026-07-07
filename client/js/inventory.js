// Inventory Control Manager

let currentInvPage = 1;
const invLimit = 10;

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.toLowerCase().endsWith('inventory.html')) return;

  loadInventory();

  // Search and Filter bindings
  const searchInput = document.getElementById('inv-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentInvPage = 1;
      loadInventory();
    });
  }

  const categoryFilter = document.getElementById('inv-category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      currentInvPage = 1;
      loadInventory();
    });
  }

  const statusFilter = document.getElementById('inv-status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      currentInvPage = 1;
      loadInventory();
    });
  }

  // Bind Submit buttons
  const ingredientForm = document.getElementById('ingredient-form');
  if (ingredientForm) {
    ingredientForm.addEventListener('submit', handleSaveIngredient);
  }
});

// 1. Fetch and render inventory table
async function loadInventory() {
  const container = document.getElementById('inventory-list');
  if (!container) return;

  const search = document.getElementById('inv-search')?.value || '';
  const category = document.getElementById('inv-category-filter')?.value || '';
  const status = document.getElementById('inv-status-filter')?.value || '';

  const response = await apiRequest(
    `/inventory?search=${search}&category=${category}&status=${status}&page=${currentInvPage}&limit=${invLimit}`
  );

  if (!response || !response.success || response.data.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4 text-muted">No inventory items found.</td>
      </tr>
    `;
    return;
  }

  let html = '';
  response.data.forEach(item => {
    html += `
      <tr>
        <td class="fw-semibold">${item.name}</td>
        <td>${item.category}</td>
        <td class="fw-bold">${parseFloat(item.stock).toFixed(2)}</td>
        <td>${item.unit}</td>
        <td>${item.supplier || '-'}</td>
        <td class="fw-semibold">${formatPrice(item.purchase_price)}</td>
        <td>${new Date(item.last_updated).toLocaleDateString()}</td>
        <td>
          <span class="badge-ramen ${getIngredientBadgeClass(item.status)}">${item.status}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-ramen-outline py-1 px-2 me-1" onclick="openEditIngredient(${item.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-ramen-primary py-1 px-2" onclick="deleteIngredient(${item.id})">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      </tr>
    `;
  });

  container.innerHTML = html;
  renderInventoryPagination(response.pagination);
}

// 2. Open Add Modal
function openAddIngredient() {
  document.getElementById('ingredient-form-title').textContent = 'Add Ingredient';
  document.getElementById('ingredient-id').value = '';
  document.getElementById('ingredient-name').value = '';
  document.getElementById('ingredient-category').value = '';
  document.getElementById('ingredient-stock').value = '0';
  document.getElementById('ingredient-unit').value = '';
  document.getElementById('ingredient-supplier').value = '';
  document.getElementById('ingredient-price').value = '0';

  const modal = new bootstrap.Modal(document.getElementById('ingredient-modal'));
  modal.show();
}

// 3. Open Edit Modal
async function openEditIngredient(id) {
  const response = await apiRequest(`/inventory/${id}`);
  if (!response || !response.success) {
    showToast('error', 'Could not load ingredient details.');
    return;
  }

  const item = response.data;
  document.getElementById('ingredient-form-title').textContent = 'Edit Ingredient';
  document.getElementById('ingredient-id').value = item.id;
  document.getElementById('ingredient-name').value = item.name;
  document.getElementById('ingredient-category').value = item.category;
  document.getElementById('ingredient-stock').value = item.stock;
  document.getElementById('ingredient-unit').value = item.unit;
  document.getElementById('ingredient-supplier').value = item.supplier || '';
  document.getElementById('ingredient-price').value = item.purchase_price;

  const modal = new bootstrap.Modal(document.getElementById('ingredient-modal'));
  modal.show();
}

// 4. Handle Create/Update Form Submission
async function handleSaveIngredient(e) {
  e.preventDefault();

  const id = document.getElementById('ingredient-id').value;
  const name = document.getElementById('ingredient-name').value.trim();
  const category = document.getElementById('ingredient-category').value;
  const stock = document.getElementById('ingredient-stock').value;
  const unit = document.getElementById('ingredient-unit').value.trim();
  const supplier = document.getElementById('ingredient-supplier').value.trim();
  const purchase_price = document.getElementById('ingredient-price').value;

  if (!name || !category || stock === '' || !unit || purchase_price === '') {
    showToast('error', 'Please fill all required fields.');
    return;
  }

  const payload = {
    name,
    category,
    stock: parseFloat(stock),
    unit,
    supplier,
    purchase_price: parseFloat(purchase_price)
  };

  let response;
  if (id) {
    // Update
    response = await apiRequest(`/inventory/${id}`, {
      method: 'PUT',
      body: payload
    });
  } else {
    // Create
    response = await apiRequest('/inventory', {
      method: 'POST',
      body: payload
    });
  }

  if (response && response.success) {
    showToast('success', response.message);
    
    // Hide Modal
    const modalEl = document.getElementById('ingredient-modal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    // Refresh table
    loadInventory();
  } else if (response) {
    showToast('error', response.message || 'Operation failed.');
  }
}

// 5. Delete Ingredient
function deleteIngredient(id) {
  Swal.fire({
    title: 'Delete Ingredient',
    text: 'Are you sure you want to delete this ingredient? This action cannot be undone.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#C62828',
    cancelButtonColor: '#2D2D2D',
    confirmButtonText: 'Yes, delete!'
  }).then(async (result) => {
    if (result.isConfirmed) {
      const response = await apiRequest(`/inventory/${id}`, {
        method: 'DELETE'
      });

      if (response && response.success) {
        showToast('success', response.message);
        loadInventory();
      } else if (response) {
        showToast('error', response.message || 'Failed to delete ingredient.');
      }
    }
  });
}

// Pagination setup
function renderInventoryPagination(pagination) {
  const container = document.getElementById('inventory-pagination');
  if (!container) return;

  let html = '';
  const totalPages = pagination.totalPages;

  html += `
    <li class="page-item">
      <a class="page-link-ramen ${currentInvPage === 1 ? 'disabled' : ''}" href="#" onclick="changeInvPage(${currentInvPage - 1})">
        <i class="fas fa-chevron-left"></i>
      </a>
    </li>
  `;

  for (let i = 1; i <= totalPages; i++) {
    html += `
      <li class="page-item">
        <a class="page-link-ramen ${currentInvPage === i ? 'active' : ''}" href="#" onclick="changeInvPage(${i})">${i}</a>
      </li>
    `;
  }

  html += `
    <li class="page-item">
      <a class="page-link-ramen ${currentInvPage === totalPages ? 'disabled' : ''}" href="#" onclick="changeInvPage(${currentInvPage + 1})">
        <i class="fas fa-chevron-right"></i>
      </a>
    </li>
  `;

  container.innerHTML = html;
}

function changeInvPage(pageNumber) {
  currentInvPage = pageNumber;
  loadInventory();
}

function getIngredientBadgeClass(status) {
  switch (status) {
    case 'Available': return 'badge-available';
    case 'Low Stock': return 'badge-lowstock';
    case 'Out of Stock': return 'badge-outofstock';
    default: return 'bg-secondary';
  }
}

// Bind to window for HTML calls
window.openAddIngredient = openAddIngredient;
window.openEditIngredient = openEditIngredient;
window.deleteIngredient = deleteIngredient;
window.changeInvPage = changeInvPage;
