/**
 * Wallet Pass View — Customer's digital loyalty card with QR code
 */
async function WalletView(container, params, routeParams) {
  const passCode = routeParams ? routeParams.code : '';
  const config = await Store.getConfig();
  const customer = await Store.findCustomer({ passCode });

  if (!customer) {
    container.innerHTML = `
      <div class="container">
        <h2>Pass not found</h2>
        <p>This wallet pass code is invalid or expired.</p>
        <a href="#/checkin" class="btn btn-primary">Check In</a>
      </div>
    `;
    return;
  }

  const threshold = config.rewardThreshold;
  const stamps = customer.visits % threshold;
  const displayStamps = stamps === 0 && customer.visits > 0 ? threshold : stamps;
  const isRewardReady = customer.visits > 0 && stamps === 0;

  container.innerHTML = `
    <div class="wallet-container">
      <div class="wallet-card">
        <div class="wallet-header">
          <h1>${esc(config.shopName)}</h1>
          ${config.tagline ? `<p class="wallet-tagline">${esc(config.tagline)}</p>` : ''}
        </div>
        <div class="wallet-body">
          <p class="wallet-greeting">Hi ${esc(customer.name)}!</p>
          <div class="stamp-card wallet-stamps">
            ${renderStamps(displayStamps, threshold)}
          </div>
          <p class="wallet-progress">${displayStamps} / ${threshold} stamps</p>
          ${isRewardReady ? `
            <div class="wallet-reward-badge">
              <span>&#127873;</span> Reward ready!
            </div>
          ` : `
            <p class="wallet-remaining">${threshold - displayStamps} more until: ${esc(config.rewardDescription)}</p>
          `}
          <div class="wallet-qr" id="walletQR"></div>
          <p class="wallet-code">${customer.passCode}</p>
          <p class="wallet-hint">Show this QR code to the barista</p>
        </div>
        <div class="wallet-footer">
          <button class="btn btn-primary" id="savePassBtn">Save to Home Screen</button>
          <a href="#/checkin" class="skip-link">Back to check-in</a>
        </div>
      </div>
    </div>
  `;

  // Generate QR code
  const qrContainer = document.getElementById('walletQR');
  if (qrContainer && typeof QRCode !== 'undefined') {
    new QRCode(qrContainer, {
      text: 'loyalsip:' + customer.passCode,
      width: 180,
      height: 180,
      colorDark: config.accentColor,
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  }

  // Save button — share or bookmark instruction
  document.getElementById('savePassBtn').onclick = () => {
    if (navigator.share) {
      navigator.share({
        title: config.shopName + ' Loyalty Pass',
        text: 'My loyalty card for ' + config.shopName,
        url: window.location.href,
      }).catch(() => {});
    } else {
      alert('Bookmark this page or add it to your home screen to save your pass!');
    }
  };

  function renderStamps(filled, total) {
    let html = '';
    for (let i = 0; i < total; i++) {
      html += `<div class="stamp ${i < filled ? 'collected' : 'empty'}">
        ${i < filled ? '&#10003;' : (i + 1)}
      </div>`;
    }
    return html;
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}
