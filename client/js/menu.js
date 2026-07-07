// Menu Items Manager (Dual role support: Customer Browser / Admin CRUD Manager)

let currentMenuPage = 1;
const menuLimit = 9; // 9 cards for customer grid, or 10 rows for admin table

function getFallbackImage(categoryName, width = 600) {
  const cat = (categoryName || '').toLowerCase();
  let imgId = '1569718212165-3a8278d5f624'; // Ramen default
  if (cat.includes('drink')) {
    imgId = '1536256263959-770b48d82b0a'; // Matcha
  } else if (cat.includes('side')) {
    imgId = '1563379091339-03b21ab4a4f8'; // Gyoza
  } else if (cat.includes('dessert')) {
    imgId = '1587314168485-3236d6710814'; // Mochi
  }
  return `https://images.unsplash.com/photo-${imgId}?auto=format&fit=crop&q=80&w=${width}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Fetch categories first for filter drop downs/lists
  await loadCategories();

  loadMenu();

  // Keyword search binding
  const searchInput = document.getElementById('menu-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentMenuPage = 1;
      loadMenu();
    });
  }

  // Bind category select filter
  const categorySelect = document.getElementById('menu-category-select');
  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      currentMenuPage = 1;
      loadMenu();
    });
  }

  // Bind Form Submit
  const menuForm = document.getElementById('menu-form');
  if (menuForm) {
    menuForm.addEventListener('submit', handleSaveMenuItem);
  }
});

// 1. Fetch categories
let categoriesList = [];
async function loadCategories() {
  const response = await apiRequest('/menu/categories');
  if (response && response.success) {
    categoriesList = response.data;
    
    // Prefill category select elements in forms and filters
    const filterSelect = document.getElementById('menu-category-select');
    const formSelect = document.getElementById('menu-item-category');

    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">All Categories</option>' + 
        categoriesList.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    }

    if (formSelect) {
      formSelect.innerHTML = '<option value="">Select Category</option>' + 
        categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  }
}

// 2. Fetch and render menu
async function loadMenu() {
  const search = document.getElementById('menu-search')?.value || '';
  const categorySelect = document.getElementById('menu-category-select');
  const category = categorySelect ? categorySelect.value : '';

  const loggedUser = getLoggedInUser();
  const isAdminUser = loggedUser && loggedUser.role === 'admin';

  // Request endpoint
  const endpoint = `/menu?search=${search}&category=${category}&page=${currentMenuPage}&limit=${menuLimit}&admin=${isAdminUser}`;
  const response = await apiRequest(endpoint);

  if (isAdminUser) {
    renderAdminMenuTable(response);
  } else {
    renderCustomerMenuGrid(response);
  }
}

// Render customer grid view
function renderCustomerMenuGrid(response) {
  const container = document.getElementById('menu-grid-container');
  if (!container) return;

  if (!response || !response.success || response.data.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5 text-muted">
        <i class="fas fa-utensils fa-3x mb-3"></i>
        <p>No ramen or menu items found matching your filters.</p>
      </div>
    `;
    return;
  }

  // Get active cart quantities to display
  const cart = getCart();

  let html = '';
  response.data.forEach(item => {
    // Generate spice icons
    let spiceHtml = '';
    if (item.spice_level > 0) {
      spiceHtml = Array(item.spice_level).fill('<i class="fas fa-pepper-hot"></i>').join('');
    }

    // Fallback Unsplash image if database field null
    const fallbackUrl = getFallbackImage(item.category_name, 600);
    const imageUrl = item.image ? `http://localhost:5000/uploads/${item.image}` : fallbackUrl;

    // Find quantity of this item in the cart
    const cartItem = cart.find(c => c.id === item.id);
    const cartQty = cartItem ? cartItem.quantity : 0;
    const qtyBadgeHtml = cartQty > 0 ? `
      <span class="menu-cart-qty">
        <i class="fas fa-shopping-cart"></i> ${cartQty} in cart
      </span>
    ` : '';

    html += `
      <div class="col-lg-4 col-md-6 mb-4">
        <div class="menu-card">
          <div class="menu-img-wrapper" onclick="goToDetail(${item.id})" style="cursor: pointer;">
            <img src="${imageUrl}" onerror="this.src='${fallbackUrl}'" class="menu-img" alt="${item.name}">
            <span class="menu-tag">${item.category_name}</span>
            <span class="menu-rating"><i class="fas fa-star"></i> ${parseFloat(item.rating).toFixed(1)}</span>
            ${qtyBadgeHtml}
          </div>
          <div class="menu-card-body">
            <h5 class="menu-title" onclick="goToDetail(${item.id})" style="cursor: pointer;">${item.name}</h5>
            <p class="menu-desc">${item.description || 'No description available.'}</p>
            <div class="d-flex justify-content-between align-items-center">
              <div class="spice-level-icons">${spiceHtml}</div>
              <span class="badge bg-${item.availability ? 'success' : 'danger'}">${item.availability ? 'Available' : 'Sold Out'}</span>
            </div>
            <div class="menu-footer">
              <span class="menu-price">${formatPrice(item.price)}</span>
              ${item.availability ? `
                <button class="btn-add-cart" onclick="triggerAddToCart(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                  <i class="fas fa-plus"></i>
                </button>
              ` : `
                <button class="btn-add-cart bg-secondary text-white" disabled>
                  <i class="fas fa-ban"></i>
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  renderMenuPagination(response.pagination);
}

// Render Admin inventory tables
function renderAdminMenuTable(response) {
  const container = document.getElementById('admin-menu-list');
  if (!container) return;

  if (!response || !response.success || response.data.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-muted">No items in the menu.</td>
      </tr>
    `;
    return;
  }

  let html = '';
  response.data.forEach(item => {
    const fallbackUrl = getFallbackImage(item.category_name, 150);
    const imageUrl = item.image ? `http://localhost:5000/uploads/${item.image}` : fallbackUrl;
    html += `
      <tr>
        <td>
          <img src="${imageUrl}" onerror="this.src='${fallbackUrl}'" class="rounded border" style="width: 50px; height: 50px; object-fit: cover;">
        </td>
        <td class="fw-semibold">${item.name}</td>
        <td>${item.category_name}</td>
        <td class="fw-bold text-primary-ramen">${formatPrice(item.price)}</td>
        <td><i class="fas fa-star text-warning"></i> ${parseFloat(item.rating).toFixed(1)}</td>
        <td>
          <span class="badge bg-${item.availability ? 'success' : 'danger'}">
            ${item.availability ? 'Available' : 'Unavailable'}
          </span>
        </td>
        <td>${'🌶️'.repeat(item.spice_level) || 'None'}</td>
        <td>
          <button class="btn btn-sm btn-ramen-outline py-1 px-2 me-1" onclick="openEditMenu(${item.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-ramen-primary py-1 px-2" onclick="deleteMenuItem(${item.id})">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      </tr>
    `;
  });

  container.innerHTML = html;
  renderMenuPagination(response.pagination);
}

// Redirect to single view details
function goToDetail(id) {
  window.location.href = `menu-detail.html?id=${id}`;
}

// Add to cart wrap
function triggerAddToCart(item) {
  addToCart(item, 1);
}

// Open Menu modals
function openAddMenu() {
  document.getElementById('menu-form-title').textContent = 'Add Menu Item';
  document.getElementById('menu-item-id').value = '';
  document.getElementById('menu-item-name').value = '';
  document.getElementById('menu-item-description').value = '';
  document.getElementById('menu-item-category').value = '';
  document.getElementById('menu-item-price').value = '0.00';
  document.getElementById('menu-item-spice').value = '0';
  document.getElementById('menu-item-availability').checked = true;
  document.getElementById('menu-item-image').value = '';

  const modal = new bootstrap.Modal(document.getElementById('menu-modal'));
  modal.show();
}

async function openEditMenu(id) {
  const response = await apiRequest(`/menu/${id}`);
  if (!response || !response.success) {
    showToast('error', 'Could not fetch item details.');
    return;
  }

  const item = response.data;
  document.getElementById('menu-form-title').textContent = 'Edit Menu Item';
  document.getElementById('menu-item-id').value = item.id;
  document.getElementById('menu-item-name').value = item.name;
  document.getElementById('menu-item-description').value = item.description || '';
  document.getElementById('menu-item-category').value = item.category_id;
  document.getElementById('menu-item-price').value = item.price;
  document.getElementById('menu-item-spice').value = item.spice_level;
  document.getElementById('menu-item-availability').checked = item.availability === 1;
  document.getElementById('menu-item-image').value = '';

  const modal = new bootstrap.Modal(document.getElementById('menu-modal'));
  modal.show();
}

// Save menu item (using FormData)
async function handleSaveMenuItem(e) {
  e.preventDefault();

  const id = document.getElementById('menu-item-id').value;
  const name = document.getElementById('menu-item-name').value.trim();
  const description = document.getElementById('menu-item-description').value.trim();
  const category_id = document.getElementById('menu-item-category').value;
  const price = document.getElementById('menu-item-price').value;
  const spice_level = document.getElementById('menu-item-spice').value;
  const availability = document.getElementById('menu-item-availability').checked ? 1 : 0;
  const imageFile = document.getElementById('menu-item-image').files[0];

  if (!name || !category_id || price === '') {
    showToast('error', 'Name, category, and price are required.');
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', description);
  formData.append('category_id', category_id);
  formData.append('price', parseFloat(price));
  formData.append('spice_level', parseInt(spice_level));
  formData.append('availability', availability);

  if (imageFile) {
    formData.append('image', imageFile);
  }

  let response;
  if (id) {
    response = await apiRequest(`/menu/${id}`, {
      method: 'PUT',
      body: formData
    });
  } else {
    response = await apiRequest('/menu', {
      method: 'POST',
      body: formData
    });
  }

  if (response && response.success) {
    showToast('success', response.message);

    const modalEl = document.getElementById('menu-modal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    loadMenu();
  } else if (response) {
    showToast('error', response.message || 'Operation failed.');
  }
}

// Delete menu item
function deleteMenuItem(id) {
  Swal.fire({
    title: 'Delete Menu Item',
    text: 'Are you sure you want to delete this menu item?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#C62828',
    cancelButtonColor: '#2D2D2D',
    confirmButtonText: 'Yes, delete!'
  }).then(async (result) => {
    if (result.isConfirmed) {
      const response = await apiRequest(`/menu/${id}`, {
        method: 'DELETE'
      });

      if (response && response.success) {
        showToast('success', response.message);
        loadMenu();
      } else if (response) {
        showToast('error', response.message || 'Deletion failed.');
      }
    }
  });
}

function renderMenuPagination(pagination) {
  const container = document.getElementById('menu-pagination');
  if (!container) return;

  let html = '';
  const totalPages = pagination.totalPages;

  html += `
    <li class="page-item">
      <a class="page-link-ramen ${currentMenuPage === 1 ? 'disabled' : ''}" href="#" onclick="changeMenuPage(${currentMenuPage - 1})">
        <i class="fas fa-chevron-left"></i>
      </a>
    </li>
  `;

  for (let i = 1; i <= totalPages; i++) {
    html += `
      <li class="page-item">
        <a class="page-link-ramen ${currentMenuPage === i ? 'active' : ''}" href="#" onclick="changeMenuPage(${i})">${i}</a>
      </li>
    `;
  }

  html += `
    <li class="page-item">
      <a class="page-link-ramen ${currentMenuPage === totalPages ? 'disabled' : ''}" href="#" onclick="changeMenuPage(${currentMenuPage + 1})">
        <i class="fas fa-chevron-right"></i>
      </a>
    </li>
  `;

  container.innerHTML = html;
}

function changeMenuPage(pageNumber) {
  currentMenuPage = pageNumber;
  loadMenu();
}

// Bind methods to window
window.goToDetail = goToDetail;
window.triggerAddToCart = triggerAddToCart;
window.openAddMenu = openAddMenu;
window.openEditMenu = openEditMenu;
window.deleteMenuItem = deleteMenuItem;
window.changeMenuPage = changeMenuPage;
window.loadMenu = loadMenu;
