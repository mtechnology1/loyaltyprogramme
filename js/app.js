/**
 * LoyalSip — Main App Entry Point
 * Registers routes, renders bottom nav, initializes the application
 */

/** Render bottom navigation bar */
function renderBottomNav() {
  if (document.getElementById('bottomNav')) return;
  const nav = document.createElement('nav');
  nav.id = 'bottomNav';
  nav.className = 'bottom-nav';
  nav.innerHTML = `
    <a href="#/checkin" class="nav-item" data-route="/checkin">
      <span class="nav-icon">&#128241;</span>
      <span class="nav-label">Customer</span>
    </a>
    <a href="#/barista" class="nav-item" data-route="/barista">
      <span class="nav-icon">&#9749;</span>
      <span class="nav-label">Barista</span>
      <span class="nav-badge" id="baristaBadge" style="display:none"></span>
    </a>
    <a href="#/dashboard" class="nav-item" data-route="/dashboard">
      <span class="nav-icon">&#128202;</span>
      <span class="nav-label">Dashboard</span>
    </a>
  `;
  document.body.appendChild(nav);
}

/** Update active state + badge count on bottom nav */
function updateNav() {
  const nav = document.getElementById('bottomNav');
  if (!nav) return;
  const config = Store.getConfig();
  if (!config.setupComplete) { nav.style.display = 'none'; return; }
  nav.style.display = '';

  const hash = window.location.hash.slice(1) || '/';
  nav.querySelectorAll('.nav-item').forEach(item => {
    const route = item.dataset.route;
    item.classList.toggle('active', hash.startsWith(route));
  });

  // Barista badge
  const pending = Store.getPending().filter(p => p.status === 'pending');
  const badge = document.getElementById('baristaBadge');
  if (badge) {
    if (pending.length > 0) {
      badge.textContent = pending.length;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }
}

// Poll badge count
setInterval(updateNav, 2000);

document.addEventListener('DOMContentLoaded', () => {
  Store.applyTheme();

  Router.register('/setup', SetupView);
  Router.register('/dashboard', DashboardView);
  Router.register('/checkin', CheckinView);
  Router.register('/wallet/:code', WalletView);
  Router.register('/barista', BaristaView);
  Router.register('/qrcard', QRCardView);

  Router.register('/', (container) => {
    const config = Store.getConfig();
    if (config.setupComplete) {
      Router.navigate('/checkin');
    } else {
      Router.navigate('/setup');
    }
  });

  renderBottomNav();
  Router.init();
});
