/**
 * Customer Check-in View — Registration + Returning customer login
 * Matches reference design: coffee icon, wallet hint, styled stamps, inline wallet card
 */
function CheckinView(container, params) {
  const config = Store.getConfig();
  let mode = 'phone'; // 'phone' or 'email'
  let state = 'form';  // 'form', 'register', 'waiting', 'confirmed', 'declined', 'reward', etc.
  let customer = null;
  let contactValue = '';
  let pollInterval = null;
  let isFirstStamp = false;

  function shopHeader(small) {
    return `
      <div class="checkin-header">
        <div class="shop-icon">&#9749;</div>
        <h1${small ? ' class="shop-name-sm"' : ''}>${esc(config.shopName)}</h1>
        ${config.tagline ? `<p class="tagline">${esc(config.tagline)}</p>` : ''}
      </div>
    `;
  }

  function poweredFooter() {
    return '<p class="powered-footer">Powered by LoyalSip</p>';
  }

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
    updateNav();
  }

  function renderForm() {
    container.innerHTML = `
      <div class="checkin-container">
        ${shopHeader()}
        <div class="checkin-card">
          <h2>Welcome</h2>
          <p>Got a wallet pass? Show it to the barista. New or returning? Use below.</p>

          <div class="wallet-hint-card">
            <div class="wallet-hint-icon">&#128179;</div>
            <div class="wallet-hint-text">
              <strong>Have your loyalty pass?</strong>
              <span>Open your wallet, show the QR code to the barista</span>
            </div>
          </div>

          <div class="divider-or"><span>or</span></div>

          <div class="toggle-row">
            <button class="toggle-btn ${mode === 'phone' ? 'active' : ''}" id="togglePhone">&#128241; Phone</button>
            <button class="toggle-btn ${mode === 'email' ? 'active' : ''}" id="toggleEmail">&#9993; Email</button>
          </div>
          ${mode === 'phone' ? `
            <div class="form-group">
              <input type="tel" id="phoneInput" placeholder="Phone number" autofocus>
            </div>
          ` : `
            <div class="form-group">
              <input type="email" id="emailInput" placeholder="your@email.com" autofocus>
            </div>
          `}
          <button class="btn btn-primary btn-block" id="checkinBtn">Continue</button>
        </div>
        ${poweredFooter()}
      </div>
    `;

    document.getElementById('togglePhone').onclick = () => { mode = 'phone'; render(); };
    document.getElementById('toggleEmail').onclick = () => { mode = 'email'; render(); };
    document.getElementById('checkinBtn').onclick = handleCheckin;

    const input = document.getElementById('phoneInput') || document.getElementById('emailInput');
    if (input) input.onkeydown = (e) => { if (e.key === 'Enter') handleCheckin(); };
  }

  function handleCheckin() {
    const phoneInput = document.getElementById('phoneInput');
    const emailInput = document.getElementById('emailInput');

    if (mode === 'phone') {
      const phone = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';
      if (phone.length < 7) { shake(phoneInput); return; }
      contactValue = phoneInput.value;
      customer = Store.findCustomer({ phone });
      if (customer) {
        handleReturning(customer);
      } else {
        state = 'register';
        render();
      }
    } else {
      const email = emailInput ? emailInput.value.trim() : '';
      if (!email.includes('@') || email.length < 5) { shake(emailInput); return; }
      contactValue = email;
      customer = Store.findCustomer({ email });
      if (customer) {
        handleReturning(customer);
      } else {
        state = 'register';
        render();
      }
    }
  }

  function handleReturning(c) {
    customer = c;
    isFirstStamp = false;
    const threshold = config.rewardThreshold;
    Store.clearResolvedForCustomer(customer.id);
    if (customer.visits > 0 && customer.visits % threshold === 0) {
      state = 'reward';
      render();
      return;
    }
    Store.addPendingRequest(customer.id, 'stamp');
    state = 'waiting';
    render();
  }

  function renderRegister() {
    container.innerHTML = `
      <div class="checkin-container">
        ${shopHeader()}
        <div class="checkin-card">
          <div class="card-emoji">&#127881;</div>
          <h2>Welcome aboard!</h2>
          <p>Earn a <strong class="accent-text">${esc(config.rewardDescription)}</strong> every ${config.rewardThreshold} visits</p>
          <div class="form-group">
            <input type="text" id="nameInput" placeholder="Your first name" maxlength="30" autofocus>
          </div>
          <button class="btn btn-primary btn-block" id="registerBtn">Join & Get First Stamp</button>
          <a href="#" class="back-link-center" id="backToForm">&larr; Back</a>
        </div>
        ${poweredFooter()}
      </div>
    `;

    const nameInput = document.getElementById('nameInput');
    document.getElementById('registerBtn').onclick = () => {
      const name = nameInput.value.trim();
      if (!name) { shake(nameInput); return; }
      const contactData = mode === 'phone'
        ? { phone: contactValue.replace(/\D/g, '') }
        : { email: contactValue.trim() };
      customer = Store.registerCustomer({ name, ...contactData });
      customer = Store.addStamp(customer.id);
      isFirstStamp = true;
      state = 'confirmed';
      render();
    };
    nameInput.onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('registerBtn').click(); };
    document.getElementById('backToForm').onclick = (e) => { e.preventDefault(); state = 'form'; render(); };
  }

  function renderWaiting() {
    const threshold = config.rewardThreshold;
    container.innerHTML = `
      <div class="checkin-container">
        ${shopHeader()}
        <div class="checkin-card waiting-card">
          <div class="spinner-accent"></div>
          <h2>Hey, ${esc(customer.name)}!</h2>
          <p>Waiting for barista...</p>
          ${renderStampCard(customer.visits, threshold)}
          <button class="btn btn-outline" id="cancelBtn">Cancel</button>
        </div>
        ${poweredFooter()}
      </div>
    `;

    document.getElementById('cancelBtn').onclick = () => {
      Store.cancelPending(customer.id);
      state = 'form';
      render();
    };

    pollInterval = setInterval(() => {
      const pending = Store.findPendingForCustomer(customer.id);
      if (!pending) {
        clearInterval(pollInterval);
        pollInterval = null;
        const resolved = Store.findResolvedForCustomer(customer.id);
        Store.clearResolvedForCustomer(customer.id);
        customer = Store.findCustomer({ id: customer.id });
        if (resolved && resolved.status === 'declined') {
          state = 'declined';
        } else {
          isFirstStamp = false;
          state = 'confirmed';
        }
        render();
      }
    }, 1000);
  }

  function renderConfirmed() {
    const threshold = config.rewardThreshold;
    const stamps = customer.visits % threshold;
    const displayStamps = stamps === 0 && customer.visits > 0 ? threshold : stamps;
    const remaining = threshold - displayStamps;

    if (isFirstStamp) {
      // First stamp — show inline wallet card
      container.innerHTML = `
        <div class="checkin-container">
          ${shopHeader(true)}
          <div class="checkin-card">
            <div class="card-emoji">&#9989;</div>
            <h2>First stamp collected!</h2>
            <p>Save your pass — never type your details again</p>

            <div class="loyalty-card-preview">
              <div class="lcp-header">
                <div>
                  <div class="lcp-label">LOYALTY CARD</div>
                  <div class="lcp-shop">${esc(config.shopName)}</div>
                </div>
                <div class="lcp-icon">&#9749;</div>
              </div>
              <div class="lcp-meta">
                <div><div class="lcp-label">MEMBER</div><div class="lcp-value">${esc(customer.name)}</div></div>
                <div class="lcp-stamps-col"><div class="lcp-label">STAMPS</div><div class="lcp-value">${displayStamps}/${threshold}</div></div>
              </div>
              <div class="lcp-qr-area">
                <div id="inlineQR" class="lcp-qr"></div>
                <div class="lcp-code">${customer.passCode}</div>
                <div class="lcp-hint">Barista scans this</div>
              </div>
            </div>

            <button class="btn btn-dark btn-block" id="savePassBtn">Save Loyalty Pass</button>
            <p class="save-hint">Downloads your pass with QR code — add to home screen</p>
            <a href="#" class="skip-link" id="skipBtn">Skip</a>
          </div>
          ${poweredFooter()}
        </div>
      `;

      // Generate inline QR
      const qrEl = document.getElementById('inlineQR');
      if (qrEl && typeof QRCode !== 'undefined') {
        new QRCode(qrEl, {
          text: 'loyalsip:' + customer.passCode,
          width: 160,
          height: 160,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M,
        });
      }

      document.getElementById('savePassBtn').onclick = () => {
        Router.navigate('/wallet/' + customer.passCode);
      };
      document.getElementById('skipBtn').onclick = (e) => {
        e.preventDefault();
        state = 'form';
        render();
      };
    } else {
      // Subsequent stamps — simple confirmation
      container.innerHTML = `
        <div class="checkin-container">
          ${shopHeader()}
          <div class="checkin-card">
            <div class="card-emoji">&#9989;</div>
            <h2>Stamp collected!</h2>
            <p>Visit #${customer.visits}, ${esc(customer.name)}</p>
            ${renderStampCard(displayStamps, threshold)}
            <p class="stamps-remaining">${remaining > 0 ? remaining + ' more to go' : 'Reward ready!'}</p>
            <button class="btn btn-primary" id="doneBtn">Done</button>
          </div>
          ${poweredFooter()}
        </div>
      `;
      document.getElementById('doneBtn').onclick = () => { state = 'form'; render(); };
    }
  }

  function renderDeclined() {
    container.innerHTML = `
      <div class="checkin-container">
        ${shopHeader()}
        <div class="checkin-card declined-card">
          <div class="card-emoji">&#10060;</div>
          <h2>Request declined</h2>
          <p>The barista was unable to confirm your check-in. Please speak to a member of staff or try again.</p>
          <button class="btn btn-primary btn-block" id="retryBtn">Try Again</button>
        </div>
        ${poweredFooter()}
      </div>
    `;
    document.getElementById('retryBtn').onclick = () => { state = 'form'; render(); };
  }

  function renderReward() {
    container.innerHTML = `
      <div class="checkin-container">
        ${shopHeader()}
        <div class="checkin-card reward-card">
          <div class="card-emoji">&#127873;</div>
          <h2>You've earned a reward!</h2>
          <p>${esc(config.rewardDescription)}</p>
          ${renderStampCard(config.rewardThreshold, config.rewardThreshold)}
          <button class="btn btn-reward btn-block" id="redeemBtn">Redeem Now</button>
        </div>
        ${poweredFooter()}
      </div>
    `;
    document.getElementById('redeemBtn').onclick = () => {
      Store.clearResolvedForCustomer(customer.id);
      Store.addPendingRequest(customer.id, 'redemption');
      state = 'redeem-waiting';
      render();
    };
  }

  function renderRedemptionWaiting() {
    container.innerHTML = `
      <div class="checkin-container">
        ${shopHeader()}
        <div class="checkin-card waiting-card reward-waiting">
          <div class="spinner-gold"></div>
          <h2>Redeeming your reward...</h2>
          <p>${esc(config.rewardDescription)}</p>
          <button class="btn btn-outline" id="cancelRedeemBtn">Cancel</button>
        </div>
        ${poweredFooter()}
      </div>
    `;

    document.getElementById('cancelRedeemBtn').onclick = () => {
      Store.cancelPending(customer.id);
      state = 'form';
      render();
    };

    pollInterval = setInterval(() => {
      const pending = Store.findPendingForCustomer(customer.id);
      if (!pending) {
        clearInterval(pollInterval);
        pollInterval = null;
        const resolved = Store.findResolvedForCustomer(customer.id);
        Store.clearResolvedForCustomer(customer.id);
        customer = Store.findCustomer({ id: customer.id });
        if (resolved && resolved.status === 'declined') {
          state = 'redeem-declined';
        } else {
          state = 'celebration';
        }
        render();
      }
    }, 1000);
  }

  function renderCelebration() {
    container.innerHTML = `
      <div class="checkin-container">
        ${shopHeader()}
        <div class="checkin-card celebration-card">
          <div class="card-emoji">&#127881;</div>
          <h2>Congratulations, ${esc(customer.name)}!</h2>
          <p>Your reward has been redeemed. Enjoy your ${esc(config.rewardDescription)}!</p>
          ${renderStampCard(0, config.rewardThreshold)}
          <p class="stamps-remaining">Your card has been reset — start collecting again!</p>
          <button class="btn btn-primary btn-block" id="celebrationDone">Done</button>
        </div>
        ${poweredFooter()}
      </div>
    `;
    document.getElementById('celebrationDone').onclick = () => { state = 'form'; render(); };
  }

  function renderRedemptionDeclined() {
    container.innerHTML = `
      <div class="checkin-container">
        ${shopHeader()}
        <div class="checkin-card declined-card">
          <div class="card-emoji">&#10060;</div>
          <h2>Redemption declined</h2>
          <p>The barista was unable to confirm your reward. Please speak to a member of staff.</p>
          <button class="btn btn-primary btn-block" id="retryRedeemBtn">Back</button>
        </div>
        ${poweredFooter()}
      </div>
    `;
    document.getElementById('retryRedeemBtn').onclick = () => { state = 'form'; render(); };
  }

  function renderStampCard(filled, total) {
    let html = '<div class="stamp-card">';
    for (let i = 0; i < total; i++) {
      if (i < filled) {
        html += '<div class="stamp collected"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4 5.6 21.2 8 14 2 9.2h7.6z" fill="currentColor"/></svg></div>';
      } else {
        html += '<div class="stamp empty"></div>';
      }
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
