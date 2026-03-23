/**
 * Customer Check-in View — Registration + Returning customer login
 */
async function CheckinView(container, params) {
  const config = await Store.getConfig();
  let mode = 'phone';
  let state = 'form';
  let customer = null;
  let contactValue = '';
  let pollInterval = null;

  function render() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    container.className = 'checkin-page';
    if (state === 'form') renderForm();
    else if (state === 'register') renderRegister();
    else if (state === 'waiting') renderWaiting();
    else if (state === 'confirmed') renderConfirmed();
    else if (state === 'declined') renderDeclined();
    else if (state === 'reward') renderReward();
    else if (state === 'redeem-waiting') renderRedemptionWaiting();
    else if (state === 'celebration') renderCelebration();
    else if (state === 'redeem-declined') renderRedemptionDeclined();
  }

  function renderForm() {
    container.innerHTML = `
      <div class="checkin-container">
        <div class="checkin-header">
          <h1>${esc(config.shopName)}</h1>
          ${config.tagline ? `<p class="tagline">${esc(config.tagline)}</p>` : ''}
        </div>
        <div class="checkin-card">
          <h2>Welcome!</h2>
          <p>Check in to collect your stamp</p>
          <div class="toggle-row">
            <button class="toggle-btn ${mode === 'phone' ? 'active' : ''}" id="togglePhone">Phone</button>
            <button class="toggle-btn ${mode === 'email' ? 'active' : ''}" id="toggleEmail">Email</button>
          </div>
          ${mode === 'phone' ? `
            <div class="form-group">
              <input type="tel" id="phoneInput" placeholder="Your phone number" autofocus>
            </div>
          ` : `
            <div class="form-group">
              <input type="email" id="emailInput" placeholder="your@email.com" autofocus>
            </div>
          `}
          <button class="btn btn-primary btn-block" id="checkinBtn">Check In</button>
        </div>
        <p class="checkin-footer">${esc(config.rewardDescription)} after ${config.rewardThreshold} visits!</p>
      </div>
    `;

    document.getElementById('togglePhone').onclick = () => { mode = 'phone'; render(); };
    document.getElementById('toggleEmail').onclick = () => { mode = 'email'; render(); };
    document.getElementById('checkinBtn').onclick = handleCheckin;

    const input = document.getElementById('phoneInput') || document.getElementById('emailInput');
    if (input) input.onkeydown = (e) => { if (e.key === 'Enter') handleCheckin(); };
  }

  async function handleCheckin() {
    const phoneInput = document.getElementById('phoneInput');
    const emailInput = document.getElementById('emailInput');

    if (mode === 'phone') {
      const phone = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';
      if (phone.length < 7) { shake(phoneInput); return; }
      contactValue = phoneInput.value;
      customer = await Store.findCustomer({ phone });
      if (customer) {
        await handleReturning(customer);
      } else {
        state = 'register';
        render();
      }
    } else {
      const email = emailInput ? emailInput.value.trim() : '';
      if (!email.includes('@') || email.length < 5) { shake(emailInput); return; }
      contactValue = email;
      customer = await Store.findCustomer({ email });
      if (customer) {
        await handleReturning(customer);
      } else {
        state = 'register';
        render();
      }
    }
  }

  async function handleReturning(c) {
    customer = c;
    const threshold = config.rewardThreshold;
    await Store.clearResolvedForCustomer(customer.id);
    if (customer.visits > 0 && customer.visits % threshold === 0) {
      state = 'reward';
      render();
      return;
    }
    await Store.addPendingRequest(customer.id, 'stamp');
    state = 'waiting';
    render();
  }

  function renderRegister() {
    container.innerHTML = `
      <div class="checkin-container">
        <div class="checkin-header">
          <h1>${esc(config.shopName)}</h1>
        </div>
        <div class="checkin-card">
          <h2>Join our loyalty programme!</h2>
          <p>Enter your first name to get started</p>
          <div class="form-group">
            <input type="text" id="nameInput" placeholder="Your first name" maxlength="30" autofocus>
          </div>
          <button class="btn btn-primary btn-block" id="registerBtn">Join & Get First Stamp</button>
        </div>
      </div>
    `;

    const nameInput = document.getElementById('nameInput');
    document.getElementById('registerBtn').onclick = async () => {
      const name = nameInput.value.trim();
      if (!name) { shake(nameInput); return; }
      const btn = document.getElementById('registerBtn');
      btn.disabled = true;
      btn.textContent = 'Joining...';
      const contactData = mode === 'phone'
        ? { phone: contactValue.replace(/\D/g, '') }
        : { email: contactValue.trim() };
      customer = await Store.registerCustomer({ name, ...contactData });
      customer = await Store.addStamp(customer.id);
      state = 'confirmed';
      render();
    };
    nameInput.onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('registerBtn').click(); };
  }

  function renderWaiting() {
    container.innerHTML = `
      <div class="checkin-container">
        <div class="checkin-header">
          <h1>${esc(config.shopName)}</h1>
        </div>
        <div class="checkin-card waiting-card">
          <div class="spinner"></div>
          <h2>Waiting for barista...</h2>
          <p>Hi ${esc(customer.name)}, your check-in request has been sent</p>
          <p class="waiting-progress">${customer.visits} / ${config.rewardThreshold} stamps so far</p>
          <button class="btn btn-outline" id="cancelBtn">Cancel</button>
        </div>
      </div>
    `;

    document.getElementById('cancelBtn').onclick = async () => {
      await Store.cancelPending(customer.id);
      state = 'form';
      render();
    };

    pollInterval = setInterval(async () => {
      const pending = await Store.findPendingForCustomer(customer.id);
      if (!pending) {
        clearInterval(pollInterval);
        pollInterval = null;
        const resolved = await Store.findResolvedForCustomer(customer.id);
        await Store.clearResolvedForCustomer(customer.id);
        customer = await Store.findCustomer({ id: customer.id });
        if (resolved && resolved.status === 'declined') {
          state = 'declined';
        } else {
          state = 'confirmed';
        }
        render();
      }
    }, 1500);
  }

  function renderConfirmed() {
    const threshold = config.rewardThreshold;
    const stamps = customer.visits % threshold;
    const displayStamps = stamps === 0 && customer.visits > 0 ? threshold : stamps;
    const remaining = threshold - displayStamps;

    container.innerHTML = `
      <div class="checkin-container">
        <div class="checkin-header">
          <h1>${esc(config.shopName)}</h1>
        </div>
        <div class="checkin-card confirmed-card">
          <div class="confirm-icon">&#10003;</div>
          <h2>Stamp collected!</h2>
          <p>Visit #${customer.visits} — ${remaining > 0 ? remaining + ' more until your reward!' : 'You\'ve earned your reward!'}</p>
          ${renderStampCard(displayStamps, threshold)}
          <div class="confirmed-actions">
            <a href="#/wallet/${customer.passCode}" class="btn btn-primary btn-block">View Wallet Pass</a>
            <button class="btn btn-outline btn-block" id="doneBtn">Done</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('doneBtn').onclick = () => { state = 'form'; render(); };
  }

  function renderDeclined() {
    container.innerHTML = `
      <div class="checkin-container">
        <div class="checkin-header">
          <h1>${esc(config.shopName)}</h1>
        </div>
        <div class="checkin-card declined-card">
          <div class="declined-icon">&#10007;</div>
          <h2>Request declined</h2>
          <p>The barista was unable to confirm your check-in. Please speak to a member of staff or try again.</p>
          <button class="btn btn-primary btn-block" id="retryBtn">Try Again</button>
        </div>
      </div>
    `;

    document.getElementById('retryBtn').onclick = () => { state = 'form'; render(); };
  }

  function renderReward() {
    container.innerHTML = `
      <div class="checkin-container">
        <div class="checkin-header">
          <h1>${esc(config.shopName)}</h1>
        </div>
        <div class="checkin-card reward-card">
          <div class="reward-icon">&#127873;</div>
          <h2>You've earned a reward!</h2>
          <p>${esc(config.rewardDescription)}</p>
          ${renderStampCard(config.rewardThreshold, config.rewardThreshold)}
          <button class="btn btn-reward btn-block" id="redeemBtn">Redeem Now</button>
        </div>
      </div>
    `;

    document.getElementById('redeemBtn').onclick = async () => {
      await Store.clearResolvedForCustomer(customer.id);
      await Store.addPendingRequest(customer.id, 'redemption');
      state = 'redeem-waiting';
      render();
    };
  }

  function renderRedemptionWaiting() {
    container.innerHTML = `
      <div class="checkin-container">
        <div class="checkin-header">
          <h1>${esc(config.shopName)}</h1>
        </div>
        <div class="checkin-card waiting-card reward-waiting">
          <div class="spinner gold-spinner"></div>
          <h2>Redeeming your reward...</h2>
          <p>${esc(config.rewardDescription)}</p>
          <button class="btn btn-outline" id="cancelRedeemBtn">Cancel</button>
        </div>
      </div>
    `;

    document.getElementById('cancelRedeemBtn').onclick = async () => {
      await Store.cancelPending(customer.id);
      state = 'form';
      render();
    };

    pollInterval = setInterval(async () => {
      const pending = await Store.findPendingForCustomer(customer.id);
      if (!pending) {
        clearInterval(pollInterval);
        pollInterval = null;
        const resolved = await Store.findResolvedForCustomer(customer.id);
        await Store.clearResolvedForCustomer(customer.id);
        customer = await Store.findCustomer({ id: customer.id });
        if (resolved && resolved.status === 'declined') {
          state = 'redeem-declined';
        } else {
          state = 'celebration';
        }
        render();
      }
    }, 1500);
  }

  function renderCelebration() {
    container.innerHTML = `
      <div class="checkin-container">
        <div class="checkin-header">
          <h1>${esc(config.shopName)}</h1>
        </div>
        <div class="checkin-card celebration-card">
          <div class="celebration-icon">&#127881;</div>
          <h2>Congratulations, ${esc(customer.name)}!</h2>
          <p>Your reward has been redeemed. Enjoy your ${esc(config.rewardDescription)}!</p>
          ${renderStampCard(0, config.rewardThreshold)}
          <p class="restart-text">Your card has been reset — start collecting again!</p>
          <button class="btn btn-primary btn-block" id="celebrationDone">Done</button>
        </div>
      </div>
    `;

    document.getElementById('celebrationDone').onclick = () => { state = 'form'; render(); };
  }

  function renderRedemptionDeclined() {
    container.innerHTML = `
      <div class="checkin-container">
        <div class="checkin-header">
          <h1>${esc(config.shopName)}</h1>
        </div>
        <div class="checkin-card declined-card">
          <div class="declined-icon">&#10007;</div>
          <h2>Redemption declined</h2>
          <p>The barista was unable to confirm your reward. Please speak to a member of staff.</p>
          <button class="btn btn-primary btn-block" id="retryRedeemBtn">Back</button>
        </div>
      </div>
    `;

    document.getElementById('retryRedeemBtn').onclick = () => { state = 'form'; render(); };
  }

  function renderStampCard(filled, total) {
    let html = '<div class="stamp-card">';
    for (let i = 0; i < total; i++) {
      html += `<div class="stamp ${i < filled ? 'collected' : 'empty'}">
        ${i < filled ? '&#10003;' : (i + 1)}
      </div>`;
    }
    html += '</div>';
    return html;
  }

  function shake(el) {
    if (!el) return;
    el.classList.add('shake');
    el.focus();
    setTimeout(() => el.classList.remove('shake'), 500);
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  render();

  return () => { if (pollInterval) clearInterval(pollInterval); };
}
