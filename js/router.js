/**
 * LoyalSip Hash Router (async-aware)
 */
const Router = (() => {
  const routes = {};
  let currentCleanup = null;

  function register(path, handler) {
    routes[path] = handler;
  }

  function navigate(path) {
    window.location.hash = '#' + path;
  }

  async function handleRoute() {
    if (currentCleanup) { currentCleanup(); currentCleanup = null; }

    const hash = window.location.hash.slice(1) || '/';
    const [path, ...queryParts] = hash.split('?');
    const params = new URLSearchParams(queryParts.join('?'));

    // Check if setup is needed
    const config = await Store.getConfig();
    if (!config.setupComplete && path !== '/setup') {
      navigate('/setup');
      return;
    }

    const app = document.getElementById('app');
    app.innerHTML = '';
    app.className = '';

    const handler = routes[path];
    if (handler) {
      const cleanup = await handler(app, params);
      if (typeof cleanup === 'function') currentCleanup = cleanup;
    } else {
      // Try prefix matching for parameterized routes
      for (const [route, h] of Object.entries(routes)) {
        if (route.includes(':')) {
          const routeParts = route.split('/');
          const pathParts = path.split('/');
          if (routeParts.length === pathParts.length) {
            const routeParams = {};
            let match = true;
            for (let i = 0; i < routeParts.length; i++) {
              if (routeParts[i].startsWith(':')) {
                routeParams[routeParts[i].slice(1)] = pathParts[i];
              } else if (routeParts[i] !== pathParts[i]) {
                match = false; break;
              }
            }
            if (match) {
              const cleanup = await h(app, params, routeParams);
              if (typeof cleanup === 'function') currentCleanup = cleanup;
              return;
            }
          }
        }
      }
      app.innerHTML = '<div class="container"><h2>Page not found</h2><a href="#/dashboard">Go to Dashboard</a></div>';
    }
  }

  function init() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  return { register, navigate, init };
})();
