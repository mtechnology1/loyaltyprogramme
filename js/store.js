/**
 * LoyalSip Data Store — localStorage persistence layer
 */
const Store = (() => {
  const KEYS = {
    config: 'loyalsip_config',
    customers: 'loyalsip_customers',
    pending: 'loyalsip_pending',
    resolved: 'loyalsip_resolved',
    recentStamps: 'loyalsip_recent_stamps',
  };

  const defaultConfig = {
    shopName: '',
    tagline: '',
    accentColor: '#6F4E37',
    backgroundColor: '#FFF8F0',
    rewardThreshold: 8,
    rewardDescription: 'Free coffee of your choice',
    shopUrl: '',
    setupComplete: false,
  };

  function _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // Config
  function getConfig() { return { ...defaultConfig, ..._get(KEYS.config, {}) }; }
  function saveConfig(partial) { _set(KEYS.config, { ...getConfig(), ...partial }); applyTheme(); }

  // Customers
  function getCustomers() { return _get(KEYS.customers, []); }
  function saveCustomers(list) { _set(KEYS.customers, list); }

  function findCustomer(query) {
    const customers = getCustomers();
    if (query.passCode) return customers.find(c => c.passCode === query.passCode);
    if (query.phone) return customers.find(c => c.phone === query.phone);
    if (query.email) return customers.find(c => c.email && c.email.toLowerCase() === query.email.toLowerCase());
    if (query.id) return customers.find(c => c.id === query.id);
    return null;
  }

  function generatePassCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const customers = getCustomers();
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    } while (customers.some(c => c.passCode === code));
    return code;
  }

  function registerCustomer({ name, phone, email }) {
    const customers = getCustomers();
    // Check existing
    let existing = phone ? customers.find(c => c.phone === phone) : null;
    if (!existing && email) existing = customers.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
    if (existing) return existing;

    const customer = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      phone: phone || '',
      email: email || '',
      passCode: generatePassCode(),
      visits: 0,
      redeemed: 0,
      joinDate: Date.now(),
      lastVisit: null,
      history: [],
    };
    customers.push(customer);
    saveCustomers(customers);
    return customer;
  }

  function addStamp(customerId) {
    const customers = getCustomers();
    const idx = customers.findIndex(c => c.id === customerId);
    if (idx === -1) return null;
    customers[idx].visits += 1;
    customers[idx].lastVisit = Date.now();
    customers[idx].history.push({ type: 'stamp', date: Date.now() });
    saveCustomers(customers);
    addRecentStamp(customers[idx]);
    return customers[idx];
  }

  function redeemReward(customerId) {
    const customers = getCustomers();
    const idx = customers.findIndex(c => c.id === customerId);
    if (idx === -1) return null;
    customers[idx].redeemed += 1;
    customers[idx].visits = 0;
    customers[idx].lastVisit = Date.now();
    customers[idx].history.push({ type: 'redemption', date: Date.now() });
    saveCustomers(customers);
    addRecentStamp(customers[idx], true);
    return customers[idx];
  }

  // Pending requests
  function getPending() { return _get(KEYS.pending, []); }
  function savePending(list) { _set(KEYS.pending, list); }

  function addPendingRequest(customerId, type = 'stamp') {
    const pending = getPending();
    // Remove any existing pending for same customer+type
    const filtered = pending.filter(p => !(p.customerId === customerId && p.type === type));
    filtered.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      customerId,
      type,
      status: 'pending',
      createdAt: Date.now(),
    });
    savePending(filtered);
  }

  function resolvePending(requestId, status) {
    const pending = getPending();
    const idx = pending.findIndex(p => p.id === requestId);
    if (idx === -1) return null;
    const req = pending[idx];
    pending.splice(idx, 1);
    savePending(pending);
    // Store resolved status so customer polling can detect confirmed vs declined
    const resolved = _get(KEYS.resolved, []);
    resolved.push({ ...req, status, resolvedAt: Date.now() });
    // Keep only last 50 resolved entries
    _set(KEYS.resolved, resolved.slice(-50));
    return { ...req, status };
  }

  function cancelPending(customerId) {
    const pending = getPending();
    savePending(pending.filter(p => p.customerId !== customerId));
  }

  function findPendingForCustomer(customerId) {
    return getPending().find(p => p.customerId === customerId && p.status === 'pending');
  }

  function findResolvedForCustomer(customerId) {
    const resolved = _get(KEYS.resolved, []);
    // Find most recent resolved request for this customer
    return resolved.filter(r => r.customerId === customerId).pop() || null;
  }

  function clearResolvedForCustomer(customerId) {
    const resolved = _get(KEYS.resolved, []);
    _set(KEYS.resolved, resolved.filter(r => r.customerId !== customerId));
  }

  // Recent stamps (for barista display)
  function getRecentStamps() { return _get(KEYS.recentStamps, []); }
  function addRecentStamp(customer, isRedemption = false) {
    const recent = getRecentStamps();
    recent.unshift({
      name: customer.name,
      visits: customer.visits,
      isRedemption,
      time: Date.now(),
    });
    _set(KEYS.recentStamps, recent.slice(0, 20));
  }

  // Analytics helpers
  function getAnalytics() {
    const customers = getCustomers();
    const now = Date.now();
    const day14 = 14 * 24 * 60 * 60 * 1000;
    const day30 = 30 * 24 * 60 * 60 * 1000;

    const totalMembers = customers.length;
    const totalVisits = customers.reduce((s, c) => s + c.visits + (c.redeemed * getConfig().rewardThreshold), 0);
    const totalRedeemed = customers.reduce((s, c) => s + c.redeemed, 0);
    const active = customers.filter(c => c.lastVisit && (now - c.lastVisit) < day14).length;
    const atRisk = customers
      .filter(c => c.lastVisit && (now - c.lastVisit) >= day14 && (now - c.lastVisit) < day30)
      .sort((a, b) => a.lastVisit - b.lastVisit);
    const topRegulars = [...customers]
      .sort((a, b) => {
        const aTotal = a.visits + a.redeemed * getConfig().rewardThreshold;
        const bTotal = b.visits + b.redeemed * getConfig().rewardThreshold;
        return bTotal - aTotal;
      })
      .slice(0, 10);

    return { totalMembers, totalVisits, totalRedeemed, active, atRisk, topRegulars };
  }

  // Theme application
  function applyTheme() {
    const cfg = getConfig();
    document.documentElement.style.setProperty('--accent', cfg.accentColor);
    document.documentElement.style.setProperty('--bg', cfg.backgroundColor);
    // Derive text color based on background luminance
    const lum = getLuminance(cfg.backgroundColor);
    document.documentElement.style.setProperty('--text', lum > 0.5 ? '#1a1a1a' : '#f5f5f5');
    document.documentElement.style.setProperty('--text-muted', lum > 0.5 ? '#666' : '#bbb');
    // Derive accent text
    const accentLum = getLuminance(cfg.accentColor);
    document.documentElement.style.setProperty('--accent-text', accentLum > 0.5 ? '#1a1a1a' : '#ffffff');
  }

  function getLuminance(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  return {
    getConfig, saveConfig, defaultConfig,
    getCustomers, saveCustomers, findCustomer, registerCustomer, generatePassCode,
    addStamp, redeemReward,
    getPending, addPendingRequest, resolvePending, cancelPending, findPendingForCustomer, findResolvedForCustomer, clearResolvedForCustomer,
    getRecentStamps,
    getAnalytics,
    applyTheme,
  };
})();
