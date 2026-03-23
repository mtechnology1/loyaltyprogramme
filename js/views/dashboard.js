/**
 * Owner Dashboard — Overview metrics, customer list, settings
 */
async function DashboardView(container, params) {
  const tab = params.get('tab') || 'overview';
  const config = await Store.getConfig();

  async function render() {
    container.innerHTML = `
      <div class="dashboard">
        <div class="dash-header">
          <h1>${esc(config.shopName)}</h1>
          <div class="dash-actions">
            <a href="#/barista" class="btn btn-primary">Barista Station</a>
            <a href="#/qrcard" class="btn btn-outline">QR Card</a>
          </div>
        </div>
        <nav class="dash-tabs">
          <a class="tab ${tab === 'overview' ? 'active' : ''}" href="#/dashboard?tab=overview">Overview</a>
          <a class="tab ${tab === 'customers' ? 'active' : ''}" href="#/dashboard?tab=customers">Customers</a>
          <a class="tab ${tab === 'settings' ? 'active' : ''}" href="#/dashboard?tab=settings">Settings</a>
        </nav>
        <div class="dash-content" id="dashContent"></div>
      </div>
    `;

    const content = document.getElementById('dashContent');
    if (tab === 'overview') await renderOverview(content);
    else if (tab === 'customers') await renderCustomers(content);
    else if (tab === 'settings') renderSettings(content);
  }

  async function renderOverview(el) {
    const a = await Store.getAnalytics();

    el.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${a.totalMembers}</div><div class="stat-label">Members</div></div>
        <div class="stat-card"><div class="stat-value">${a.totalVisits}</div><div class="stat-label">Total Visits</div></div>
        <div class="stat-card"><div class="stat-value">${a.totalRedeemed}</div><div class="stat-label">Rewards Redeemed</div></div>
        <div class="stat-card accent-card"><div class="stat-value">${a.active}</div><div class="stat-label">Active (14d)</div></div>
      </div>

      ${a.atRisk.length > 0 ? `
        <div class="dash-section">
          <h2>&#9888; At-Risk Customers</h2>
          <p class="section-desc">Haven't visited in 2+ weeks</p>
          <div class="customer-list">
            ${a.atRisk.map(c => {
              const days = Math.floor((Date.now() - c.lastVisit) / 86400000);
              return `<div class="customer-row warning-row">
                <span class="customer-name">${esc(c.name)}</span>
                <span class="customer-contact">${c.phone || c.email}</span>
                <span class="days-ago">${days} days ago</span>
              </div>`;
            }).join('')}
          </div>
        </div>
      ` : ''}

      ${a.topRegulars.length > 0 ? `
        <div class="dash-section">
          <h2>&#11088; Top Regulars</h2>
          <div class="customer-list">
            ${a.topRegulars.map((c, i) => {
              const totalV = c.visits + c.redeemed * config.rewardThreshold;
              const lastStr = c.lastVisit ? timeAgo(c.lastVisit) : 'never';
              return `<div class="customer-row">
                <span class="rank">#${i + 1}</span>
                <span class="customer-name">${esc(c.name)}</span>
                <span class="visit-count">${totalV} visits</span>
                <span class="last-visit">Last: ${lastStr}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
      ` : '<div class="dash-section empty-state"><p>No customers yet. Share your QR code to get started!</p></div>'}
    `;
  }

  async function renderCustomers(el) {
    const customers = await Store.getCustomers();
    let sortField = 'lastVisit';
    let sortDir = -1;

    function renderList() {
      const sorted = [...customers].sort((a, b) => {
        let aVal = a[sortField], bVal = b[sortField];
        if (sortField === 'totalVisits') {
          aVal = a.visits + a.redeemed * config.rewardThreshold;
          bVal = b.visits + b.redeemed * config.rewardThreshold;
        }
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === 'string') return sortDir * aVal.localeCompare(bVal);
        return sortDir * (aVal - bVal);
      });

      el.innerHTML = `
        <div class="customer-table-wrap">
          ${customers.length === 0 ? '<p class="empty-state">No customers enrolled yet.</p>' : `
            <table class="customer-table">
              <thead>
                <tr>
                  <th data-sort="name">Name</th>
                  <th data-sort="phone">Contact</th>
                  <th>Pass Code</th>
                  <th data-sort="totalVisits">Visits</th>
                  <th data-sort="lastVisit">Last Visit</th>
                  <th data-sort="joinDate">Joined</th>
                </tr>
              </thead>
              <tbody>
                ${sorted.map(c => {
                  const totalV = c.visits + c.redeemed * config.rewardThreshold;
                  return `<tr>
                    <td>${esc(c.name)}</td>
                    <td>${esc(c.phone || c.email)}</td>
                    <td><code>${c.passCode}</code></td>
                    <td>${totalV} (${c.visits}/${config.rewardThreshold})</td>
                    <td>${c.lastVisit ? formatDate(c.lastVisit) : '—'}</td>
                    <td>${formatDate(c.joinDate)}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          `}
        </div>
      `;

      el.querySelectorAll('[data-sort]').forEach(th => {
        th.style.cursor = 'pointer';
        th.onclick = () => {
          if (sortField === th.dataset.sort) sortDir *= -1;
          else { sortField = th.dataset.sort; sortDir = -1; }
          renderList();
        };
      });
    }
    renderList();
  }

  function renderSettings(el) {
    const cfg = config;
    el.innerHTML = `
      <div class="settings-form">
        <div class="form-group">
          <label for="setName">Shop Name</label>
          <input type="text" id="setName" value="${esc(cfg.shopName)}" maxlength="50">
        </div>
        <div class="form-group">
          <label for="setTagline">Tagline</label>
          <input type="text" id="setTagline" value="${esc(cfg.tagline)}" maxlength="80">
        </div>
        <div class="form-group">
          <label for="setAccent">Accent Colour</label>
          <div class="colour-input-row">
            <input type="color" id="setAccent" value="${cfg.accentColor}">
            <input type="text" id="setAccentHex" value="${cfg.accentColor}" maxlength="7" class="hex-input">
          </div>
        </div>
        <div class="form-group">
          <label for="setBg">Background Colour</label>
          <div class="colour-input-row">
            <input type="color" id="setBg" value="${cfg.backgroundColor}">
            <input type="text" id="setBgHex" value="${cfg.backgroundColor}" maxlength="7" class="hex-input">
          </div>
        </div>
        <div class="form-group">
          <label for="setThreshold">Reward Threshold (stamps)</label>
          <select id="setThreshold">
            ${[5,8,10,12].map(n => `<option value="${n}" ${cfg.rewardThreshold === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="setReward">Reward Description</label>
          <input type="text" id="setReward" value="${esc(cfg.rewardDescription)}" maxlength="100">
        </div>
        <div class="form-group">
          <label for="setUrl">Shop URL (for QR code)</label>
          <input type="url" id="setUrl" value="${esc(cfg.shopUrl)}" placeholder="https://yourshop.com/loyalty">
        </div>
        <button class="btn btn-primary" id="saveSettingsBtn">Save Settings</button>
        <div id="settingsToast" class="settings-toast hidden"></div>
      </div>
    `;

    // Colour sync
    const acInput = document.getElementById('setAccent');
    const acHex = document.getElementById('setAccentHex');
    const bgInput = document.getElementById('setBg');
    const bgHex = document.getElementById('setBgHex');
    acInput.oninput = () => acHex.value = acInput.value;
    acHex.oninput = () => { if (/^#[0-9a-fA-F]{6}$/.test(acHex.value)) acInput.value = acHex.value; };
    bgInput.oninput = () => bgHex.value = bgInput.value;
    bgHex.oninput = () => { if (/^#[0-9a-fA-F]{6}$/.test(bgHex.value)) bgInput.value = bgHex.value; };

    document.getElementById('saveSettingsBtn').onclick = async () => {
      const btn = document.getElementById('saveSettingsBtn');
      btn.disabled = true;
      btn.textContent = 'Saving...';
      await Store.saveConfig({
        shopName: document.getElementById('setName').value.trim(),
        tagline: document.getElementById('setTagline').value.trim(),
        accentColor: acInput.value,
        backgroundColor: bgInput.value,
        rewardThreshold: parseInt(document.getElementById('setThreshold').value),
        rewardDescription: document.getElementById('setReward').value.trim(),
        shopUrl: document.getElementById('setUrl').value.trim(),
      });
      btn.disabled = false;
      btn.textContent = 'Save Settings';
      const toast = document.getElementById('settingsToast');
      toast.textContent = 'Settings saved!';
      toast.className = 'settings-toast show';
      setTimeout(() => toast.className = 'settings-toast hidden', 2000);
      const header = container.querySelector('.dash-header h1');
      if (header) header.textContent = document.getElementById('setName').value.trim();
    };
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  await render();
}
