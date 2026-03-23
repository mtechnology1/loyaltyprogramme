/**
 * LoyalSip Data Store — Supabase persistence layer
 * All read/write methods are async (return Promises).
 */
const Store = (() => {
  const SUPABASE_URL = 'https://bakxitkeaxgnddstynom.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_cYFm4S1-FafXBSBbjrQL3g_wGuInwtO';
  const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

  let _configId = null;

  // ── DB ↔ JS mapping helpers ──

  function configFromDB(row) {
    return {
      shopName: row.shop_name,
      tagline: row.tagline,
      accentColor: row.accent_color,
      backgroundColor: row.background_color,
      rewardThreshold: row.reward_threshold,
      rewardDescription: row.reward_description,
      shopUrl: row.shop_url,
      setupComplete: row.setup_complete,
    };
  }

  function configToDB(cfg) {
    return {
      shop_name: cfg.shopName,
      tagline: cfg.tagline,
      accent_color: cfg.accentColor,
      background_color: cfg.backgroundColor,
      reward_threshold: cfg.rewardThreshold,
      reward_description: cfg.rewardDescription,
      shop_url: cfg.shopUrl,
      setup_complete: cfg.setupComplete,
    };
  }

  function customerFromDB(row) {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone || '',
      email: row.email || '',
      passCode: row.pass_code,
      visits: row.visits,
      redeemed: row.redeemed,
      joinDate: row.join_date,
      lastVisit: row.last_visit,
      history: row.history || [],
    };
  }

  function customerToDB(c) {
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      pass_code: c.passCode,
      visits: c.visits,
      redeemed: c.redeemed,
      join_date: c.joinDate,
      last_visit: c.lastVisit,
      history: c.history,
    };
  }

  function pendingFromDB(row) {
    return {
      id: row.id,
      customerId: row.customer_id,
      type: row.type,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  function resolvedFromDB(row) {
    return {
      id: row.id,
      customerId: row.customer_id,
      type: row.type,
      status: row.status,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
    };
  }

  function stampFromDB(row) {
    return {
      name: row.name,
      visits: row.visits,
      isRedemption: row.is_redemption,
      time: row.time,
    };
  }

  // ── Init ──

  async function init() {
    const config = await getConfig();
    applyTheme(config);
  }

  // ── Config ──

  async function getConfig() {
    const { data } = await _sb.from('config').select('*').limit(1).maybeSingle();
    if (data) {
      _configId = data.id;
      return { ...defaultConfig, ...configFromDB(data) };
    }
    return { ...defaultConfig };
  }

  async function saveConfig(partial) {
    const current = await getConfig();
    const merged = { ...current, ...partial };
    const dbData = configToDB(merged);

    if (_configId) {
      await _sb.from('config').update(dbData).eq('id', _configId);
    } else {
      const { data } = await _sb.from('config').insert(dbData).select().single();
      if (data) _configId = data.id;
    }
    applyTheme(merged);
  }

  // ── Customers ──

  async function getCustomers() {
    const { data } = await _sb.from('customers').select('*');
    return (data || []).map(customerFromDB);
  }

  async function saveCustomers(list) {
    await _sb.from('customers').upsert(list.map(customerToDB));
  }

  async function findCustomer(query) {
    let q = _sb.from('customers').select('*');
    if (query.passCode) q = q.eq('pass_code', query.passCode);
    else if (query.phone) q = q.eq('phone', query.phone);
    else if (query.email) q = q.ilike('email', query.email);
    else if (query.id) q = q.eq('id', query.id);
    else return null;

    const { data } = await q.maybeSingle();
    return data ? customerFromDB(data) : null;
  }

  async function generatePassCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code, exists = true;
    while (exists) {
      code = '';
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      const { data } = await _sb.from('customers').select('id').eq('pass_code', code).maybeSingle();
      exists = !!data;
    }
    return code;
  }

  async function registerCustomer({ name, phone, email }) {
    if (phone) {
      const existing = await findCustomer({ phone });
      if (existing) return existing;
    }
    if (email) {
      const existing = await findCustomer({ email });
      if (existing) return existing;
    }

    const customer = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      phone: phone || '',
      email: email || '',
      passCode: await generatePassCode(),
      visits: 0,
      redeemed: 0,
      joinDate: Date.now(),
      lastVisit: null,
      history: [],
    };

    await _sb.from('customers').insert(customerToDB(customer));
    return customer;
  }

  async function addStamp(customerId) {
    const customer = await findCustomer({ id: customerId });
    if (!customer) return null;

    customer.visits += 1;
    customer.lastVisit = Date.now();
    customer.history.push({ type: 'stamp', date: Date.now() });

    await _sb.from('customers').update({
      visits: customer.visits,
      last_visit: customer.lastVisit,
      history: customer.history,
    }).eq('id', customerId);

    await addRecentStamp(customer);
    return customer;
  }

  async function redeemReward(customerId) {
    const customer = await findCustomer({ id: customerId });
    if (!customer) return null;

    customer.redeemed += 1;
    customer.visits = 0;
    customer.lastVisit = Date.now();
    customer.history.push({ type: 'redemption', date: Date.now() });

    await _sb.from('customers').update({
      visits: customer.visits,
      redeemed: customer.redeemed,
      last_visit: customer.lastVisit,
      history: customer.history,
    }).eq('id', customerId);

    await addRecentStamp(customer, true);
    return customer;
  }

  // ── Pending requests ──

  async function getPending() {
    const { data } = await _sb.from('pending_requests').select('*');
    return (data || []).map(pendingFromDB);
  }

  async function addPendingRequest(customerId, type = 'stamp') {
    await _sb.from('pending_requests')
      .delete()
      .eq('customer_id', customerId)
      .eq('type', type);

    await _sb.from('pending_requests').insert({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      customer_id: customerId,
      type,
      status: 'pending',
      created_at: Date.now(),
    });
  }

  async function resolvePending(requestId, status) {
    const { data: reqData } = await _sb.from('pending_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (!reqData) return null;

    await _sb.from('pending_requests').delete().eq('id', requestId);

    const resolved = {
      id: reqData.id,
      customer_id: reqData.customer_id,
      type: reqData.type,
      status,
      created_at: reqData.created_at,
      resolved_at: Date.now(),
    };
    await _sb.from('resolved_requests').insert(resolved);

    // Keep only last 50 resolved entries
    const { data: all } = await _sb.from('resolved_requests')
      .select('id')
      .order('resolved_at', { ascending: true });
    if (all && all.length > 50) {
      const toDelete = all.slice(0, all.length - 50).map(r => r.id);
      await _sb.from('resolved_requests').delete().in('id', toDelete);
    }

    return resolvedFromDB(resolved);
  }

  async function cancelPending(customerId) {
    await _sb.from('pending_requests').delete().eq('customer_id', customerId);
  }

  async function findPendingForCustomer(customerId) {
    const { data } = await _sb.from('pending_requests')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'pending')
      .maybeSingle();
    return data ? pendingFromDB(data) : null;
  }

  async function findResolvedForCustomer(customerId) {
    const { data } = await _sb.from('resolved_requests')
      .select('*')
      .eq('customer_id', customerId)
      .order('resolved_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? resolvedFromDB(data) : null;
  }

  async function clearResolvedForCustomer(customerId) {
    await _sb.from('resolved_requests').delete().eq('customer_id', customerId);
  }

  // ── Recent stamps ──

  async function getRecentStamps() {
    const { data } = await _sb.from('recent_stamps')
      .select('*')
      .order('time', { ascending: false })
      .limit(20);
    return (data || []).map(stampFromDB);
  }

  async function addRecentStamp(customer, isRedemption = false) {
    await _sb.from('recent_stamps').insert({
      name: customer.name,
      visits: customer.visits,
      is_redemption: isRedemption,
      time: Date.now(),
    });
    // Keep only last 20
    const { data: all } = await _sb.from('recent_stamps')
      .select('id')
      .order('time', { ascending: false });
    if (all && all.length > 20) {
      const toDelete = all.slice(20).map(r => r.id);
      await _sb.from('recent_stamps').delete().in('id', toDelete);
    }
  }

  // ── Analytics ──

  async function getAnalytics() {
    const customers = await getCustomers();
    const config = await getConfig();
    const now = Date.now();
    const day14 = 14 * 24 * 60 * 60 * 1000;
    const day30 = 30 * 24 * 60 * 60 * 1000;

    const totalMembers = customers.length;
    const totalVisits = customers.reduce((s, c) => s + c.visits + (c.redeemed * config.rewardThreshold), 0);
    const totalRedeemed = customers.reduce((s, c) => s + c.redeemed, 0);
    const active = customers.filter(c => c.lastVisit && (now - c.lastVisit) < day14).length;
    const atRisk = customers
      .filter(c => c.lastVisit && (now - c.lastVisit) >= day14 && (now - c.lastVisit) < day30)
      .sort((a, b) => a.lastVisit - b.lastVisit);
    const topRegulars = [...customers]
      .sort((a, b) => {
        const aTotal = a.visits + a.redeemed * config.rewardThreshold;
        const bTotal = b.visits + b.redeemed * config.rewardThreshold;
        return bTotal - aTotal;
      })
      .slice(0, 10);

    return { totalMembers, totalVisits, totalRedeemed, active, atRisk, topRegulars };
  }

  // ── Theme ──

  function applyTheme(cfg) {
    if (!cfg) cfg = defaultConfig;
    document.documentElement.style.setProperty('--accent', cfg.accentColor);
    document.documentElement.style.setProperty('--bg', cfg.backgroundColor);
    const lum = getLuminance(cfg.backgroundColor);
    document.documentElement.style.setProperty('--text', lum > 0.5 ? '#1a1a1a' : '#f5f5f5');
    document.documentElement.style.setProperty('--text-muted', lum > 0.5 ? '#666' : '#bbb');
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
    init,
    getConfig, saveConfig, defaultConfig,
    getCustomers, saveCustomers, findCustomer, registerCustomer, generatePassCode,
    addStamp, redeemReward,
    getPending, addPendingRequest, resolvePending, cancelPending, findPendingForCustomer, findResolvedForCustomer, clearResolvedForCustomer,
    getRecentStamps,
    getAnalytics,
    applyTheme,
  };
})();
