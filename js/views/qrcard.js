/**
 * QR Code Card — Printable branded counter card
 */
function QRCardView(container) {
  const config = Store.getConfig();

  container.innerHTML = `
    <div class="qrcard-container">
      <div class="qrcard-controls">
        <a href="#/dashboard" class="back-link">&larr; Dashboard</a>
        <button class="btn btn-primary" id="printCardBtn">Print Card</button>
      </div>

      <div class="qr-counter-card" id="printableCard">
        <div class="qr-card-header">
          <h1>${esc(config.shopName)}</h1>
          ${config.tagline ? `<p>${esc(config.tagline)}</p>` : ''}
        </div>
        <div class="qr-card-body">
          <div id="shopQR" class="shop-qr"></div>
          <p class="qr-scan-text">Scan to join our loyalty programme!</p>
        </div>
        <div class="qr-card-footer">
          <p>Collect ${config.rewardThreshold} stamps &rarr; ${esc(config.rewardDescription)}</p>
        </div>
      </div>
    </div>
  `;

  // Generate QR code
  const qrContainer = document.getElementById('shopQR');
  const url = config.shopUrl || window.location.origin + window.location.pathname + '#/checkin';
  if (qrContainer && typeof QRCode !== 'undefined') {
    new QRCode(qrContainer, {
      text: url,
      width: 200,
      height: 200,
      colorDark: config.accentColor,
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
  }

  // Print
  document.getElementById('printCardBtn').onclick = () => {
    const card = document.getElementById('printableCard');
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${esc(config.shopName)} - Loyalty QR Card</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .card { width: 350px; border: 2px solid ${config.accentColor}; border-radius: 16px; overflow: hidden; text-align: center; }
          .card-header { background: ${config.accentColor}; color: white; padding: 24px 16px; }
          .card-header h1 { font-size: 24px; margin-bottom: 4px; }
          .card-header p { font-size: 14px; opacity: 0.9; }
          .card-body { padding: 24px; background: white; }
          .card-body img { width: 200px; height: 200px; }
          .card-body canvas { width: 200px !important; height: 200px !important; }
          .scan-text { margin-top: 12px; font-size: 16px; font-weight: 600; color: ${config.accentColor}; }
          .card-footer { padding: 16px; background: ${config.backgroundColor}; font-size: 14px; color: #333; border-top: 1px solid #eee; }
          @media print { body { margin: 0; } .card { border: 2px solid ${config.accentColor}; } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="card-header">
            <h1>${esc(config.shopName)}</h1>
            ${config.tagline ? `<p>${esc(config.tagline)}</p>` : ''}
          </div>
          <div class="card-body">
            ${qrContainer.innerHTML}
            <p class="scan-text">Scan to join our loyalty programme!</p>
          </div>
          <div class="card-footer">
            <p>Collect ${config.rewardThreshold} stamps &rarr; ${esc(config.rewardDescription)}</p>
          </div>
        </div>
        <script>window.onload = () => window.print();<\/script>
      </body>
      </html>
    `);
    win.document.close();
  };

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}
