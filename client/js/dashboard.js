// Admin Dashboard Analytics & Charts Controller

let salesChart = null;
let revenueChart = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.toLowerCase().endsWith('dashboard.html')) return;

  loadDashboardData();
});

async function loadDashboardData() {
  const response = await apiRequest('/orders/admin/stats');
  if (!response || !response.success) {
    showToast('error', 'Failed to retrieve dashboard metrics.');
    return;
  }

  const { cards, recentOrders, charts } = response.data;

  // 1. Populate Metric Cards
  if (document.getElementById('total-menu-count')) {
    document.getElementById('total-menu-count').textContent = cards.totalMenu;
  }
  if (document.getElementById('total-ingredients-count')) {
    document.getElementById('total-ingredients-count').textContent = cards.totalIngredients;
  }
  if (document.getElementById('today-orders-count')) {
    document.getElementById('today-orders-count').textContent = cards.todayOrders;
  }
  if (document.getElementById('monthly-revenue-count')) {
    document.getElementById('monthly-revenue-count').textContent = formatPrice(cards.monthlyRevenue);
  }
  if (document.getElementById('total-customers-count')) {
    document.getElementById('total-customers-count').textContent = cards.totalCustomers;
  }
  if (document.getElementById('low-stock-count')) {
    document.getElementById('low-stock-count').textContent = cards.lowStockIngredients;
  }

  // 2. Populate Recent Orders List Table
  const ordersContainer = document.getElementById('recent-orders-list');
  if (ordersContainer) {
    if (recentOrders.length === 0) {
      ordersContainer.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No recent orders found.</td></tr>';
    } else {
      let ordersHtml = '';
      recentOrders.forEach(order => {
        ordersHtml += `
          <tr>
            <td class="fw-bold">#RH-${order.id}</td>
            <td>${order.name}</td>
            <td>${new Date(order.order_date).toLocaleDateString()}</td>
            <td class="fw-bold text-primary-ramen">${formatPrice(order.total_price)}</td>
            <td>
              <span class="badge-ramen ${getStatusBadgeClass(order.status)}">${order.status}</span>
            </td>
            <td>
              <span class="badge bg-${order.payment_status === 'Paid' ? 'success' : 'warning'}">${order.payment_status}</span>
            </td>
          </tr>
        `;
      });
      ordersContainer.innerHTML = ordersHtml;
    }
  }

  // 3. Render Visual Analytics Charts
  renderSalesCharts(charts);
}

function renderSalesCharts(chartData) {
  // Sales Chart (Daily Sales Count & Revenue over last 7 Days)
  const salesCtx = document.getElementById('salesLineChart');
  if (salesCtx) {
    // Fill in empty records if dates are missing
    const labels = chartData.dailySales.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
    const revenues = chartData.dailySales.map(d => parseFloat(d.revenue || 0));
    const counts = chartData.dailySales.map(d => parseInt(d.count || 0));

    if (salesChart) salesChart.destroy();
    
    salesChart = new Chart(salesCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Daily Revenue ($)',
            data: revenues,
            borderColor: '#C62828',
            backgroundColor: 'rgba(198, 40, 40, 0.1)',
            fill: true,
            tension: 0.3,
            yAxisID: 'y'
          },
          {
            label: 'Orders Count',
            data: counts,
            borderColor: '#2D2D2D',
            backgroundColor: 'rgba(45, 45, 45, 0.05)',
            borderDash: [5, 5],
            fill: false,
            tension: 0.1,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            ticks: {
              callback: function(value) { return '$' + value; }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false } // Only show grid lines for left y-axis
          }
        }
      }
    });
  }

  // Monthly Revenue Chart (Bar Chart for last 6 Months)
  const revCtx = document.getElementById('revenueBarChart');
  if (revCtx) {
    const labels = chartData.monthlyRevenue.map(m => {
      const parts = m.month.split('-');
      const date = new Date(parts[0], parts[1] - 1);
      return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    });
    const revenues = chartData.monthlyRevenue.map(m => parseFloat(m.revenue || 0));

    if (revenueChart) revenueChart.destroy();

    revenueChart = new Chart(revCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Monthly Completed Revenue ($)',
          data: revenues,
          backgroundColor: 'rgba(198, 40, 40, 0.85)',
          borderRadius: 8,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) { return '$' + value; }
            }
          }
        }
      }
    });
  }
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
