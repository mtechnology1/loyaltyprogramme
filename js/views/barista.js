/**
 * Barista Station — Instant stamp via pass code + manual check-in approval queue
 */
function BaristaView(container) {
  let pollInterval = null;
  let toastTimeout = null;
  let config = null;

  async function render() {
    config = await Store.getConfig();
    const pending = (await Store.getPending()).filter(p => p.type === 'stamp' && p.status === 'pending');
    const redemptions = (await Store.getPending()).filter(p => p.type === 'redemption' && p.status === 'pending');
    const recent = (await Store.getRecentStamps()).slice(0, 10);

    // Resolve customer names for pending/redemption items
    const pendingItems = [];
    for (const p of pending) {
      const c = await Store.findCustomer({ id: p.customerId });
      if (c) pendingItems.push({ req: p, customer: c });
    }
    const redemptionItems = [];
    for (const r of redemptions) {
      const c = await Store.findCustomer({ id: r.customerId });
      if (c) redemptionItems.push({ req: r, customer: c });
    }

    container.innerHTML = `
      <div class="barista-container">
        <div class="barista-header">
          <h1>Barista Station</h1>
          <a href="#/dashboard" class="back-link">&larr; Dashboard</a>
        </div>

        <div class="barista-section scan-section">
          <h2>Scan / Enter Pass Code</h2>
          <div class="passcode-input-row">
            <input type="text" id="passCodeInput" placeholder="6-character code" maxlength="20" autofocus>
            <button class="btn btn-primary" id="stampBtn">Stamp</button>
          </div>
          <div id="stampToast" class="stamp-toast hidden"></div>
        </div>

        ${redemptionItems.length > 0 ? `
          <div class="barista-section redemption-section">
            <h2>&#127873; Reward Redemptions</h2>
            ${redemptionItems.map(({ req: r, customer: c }) => `
              <div class="pending-card redemption-card">
                <div class="pending-info">
                  <strong>${esc(c.name)}</strong>
                  <span class="reward-badge">&#127873; ${esc(config.rewardDescription)}</span>
                </div>
                <div class="pending-actions">
                  <button class="btn btn-reward btn-sm" data-action="confirm-redeem" data-id="${r.id}" data-cid="${c.id}">Give Reward & Reset</button>
                  <button class="btn btn-danger btn-sm" data-action="decline-redeem" data-id="${r.id}">Decline</button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${pendingItems.length > 0 ? `
          <div class="barista-section queue-section">
            <h2>Pending Check-ins (${pendingItems.length})</h2>
            ${pendingItems.map(({ req: p, customer: c }) => {
              const totalVisits = c.visits + c.redeemed * config.rewardThreshold;
              const nextVisit = totalVisits + 1;
              const isRewardVisit = c.visits + 1 === config.rewardThreshold;
              return `
                <div class="pending-card ${isRewardVisit ? 'reward-pending' : ''}">
                  <div class="pending-info">
                    <strong>${esc(c.name)}</strong>
                    <span>${c.phone || c.email}</span>
                    <span class="visit-badge">Visit #${nextVisit}${isRewardVisit ? ' &#127873; REWARD!' : ''}</span>
                  </div>
                  <div class="pending-actions">
                    <button class="btn btn-success btn-sm" data-action="confirm" data-id="${p.id}" data-cid="${c.id}">Confirm</button>
                    <button class="btn btn-danger btn-sm" data-action="decline" data-id="${p.id}">Decline</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        ${recent.length > 0 ? `
          <div class="barista-section recent-section">
            <h2>Recent Activity</h2>
            ${recent.map(r => `
              <div class="recent-item ${r.isRedemption ? 'recent-redemption' : ''}">
                <span>${r.isRedemption ? '&#127873;' : '&#10003;'} ${esc(r.name)}</span>
                <span>${r.isRedemption ? 'Reward redeemed' : 'Stamp #' + r.visits}</span>
                <span class="recent-time">${timeAgo(r.time)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const input = document.getElementById('passCodeInput');
    const stampBtn = document.getElementById('stampBtn');

    stampBtn.onclick = () => handlePassCode(input);
    input.onkeydown = (e) => { if (e.key === 'Enter') handlePassCode(input); };

    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.onclick = async () => {
        const action = btn.dataset.action;
        const reqId = btn.dataset.id;
        const custId = btn.dataset.cid;

        if (action === 'confirm') {
          await Store.resolvePending(reqId, 'confirmed');
          const c = await Store.addStamp(custId);
          if (c) showToast(`&#10003; Stamp #${c.visits} for ${esc(c.name)}${c.visits % config.rewardThreshold === 0 ? ' &#127873; REWARD!' : ''}`, c.visits % config.rewardThreshold === 0);
        } else if (action === 'decline') {
          await Store.resolvePending(reqId, 'declined');
          showToast('&#10007; Check-in declined', false, true);
        } else if (action === 'confirm-redeem') {
          await Store.resolvePending(reqId, 'confirmed');
          const c = await Store.redeemReward(custId);
          if (c) showToast(`&#127873; Reward redeemed for ${esc(c.name)} — card reset!`, true);
        } else if (action === 'decline-redeem') {
          await Store.resolvePending(reqId, 'declined');
          showToast('&#10007; Redemption declined', false, true);
        }
        render();
      };
    });
  }

  async function handlePassCode(input) {
    let code = input.value.trim().toUpperCase();
    if (code.startsWith('LOYALSIP:')) code = code.substring(9);
    if (code.length !== 6) {
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 500);
      return;
    }
    const customer = await Store.findCustomer({ passCode: code });
    if (!customer) {
      showToast('&#10007; No customer found with that code', false, true);
      input.value = '';
      return;
    }
    const updated = await Store.addStamp(customer.id);
    const isReward = updated.visits % config.rewardThreshold === 0;
    showToast(
      `&#10003; Stamp #${updated.visits} for ${esc(updated.name)}${isReward ? ' &#127873; REWARD!' : ''}`,
      isReward
    );
    input.value = '';
    input.focus();
    render();
  }

  function showToast(html, isSpecial = false, isError = false) {
    const toast = document.getElementById('stampToast');
    if (!toast) return;
    toast.innerHTML = html;
    toast.className = `stamp-toast ${isSpecial ? 'reward-toast' : ''} ${isError ? 'error-toast' : ''} show`;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.className = 'stamp-toast hidden';
    }, 3000);
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  render();

  // Poll for new requests
  pollInterval = setInterval(render, 3000);

  return () => {
    if (pollInterval) clearInterval(pollInterval);
    if (toastTimeout) clearTimeout(toastTimeout);
  };
}
