/**
 * LoyalSip — Main App Entry Point
 * Registers routes and initializes the application
 */
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme
  Store.applyTheme();

  // Register routes
  Router.register('/setup', SetupView);
  Router.register('/dashboard', DashboardView);
  Router.register('/checkin', CheckinView);
  Router.register('/wallet/:code', WalletView);
  Router.register('/barista', BaristaView);
  Router.register('/qrcard', QRCardView);

  // Default route
  Router.register('/', (container) => {
    const config = Store.getConfig();
    if (config.setupComplete) {
      Router.navigate('/dashboard');
    } else {
      Router.navigate('/setup');
    }
  });

  // Start router
  Router.init();
});
