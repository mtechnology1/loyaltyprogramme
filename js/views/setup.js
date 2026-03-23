/**
 * Setup Wizard — 3-step onboarding
 * Step 1: Shop name + tagline
 * Step 2: Brand colours
 * Step 3: Reward configuration
 */
function SetupView(container) {
  const config = Store.getConfig();
  let step = 1;
  const data = {
    shopName: config.shopName || '',
    tagline: config.tagline || '',
    accentColor: config.accentColor,
    backgroundColor: config.backgroundColor,
    rewardThreshold: config.rewardThreshold,
    rewardDescription: config.rewardDescription,
  };

  function render() {
    container.innerHTML = `
      <div class="setup-wizard">
        <div class="setup-header">
          <h1>LoyalSip</h1>
          <p class="subtitle">Set up your loyalty programme</p>
          <div class="step-indicator">
            ${[1,2,3].map(s => `<div class="step-dot ${s === step ? 'active' : ''} ${s < step ? 'done' : ''}">${s}</div>`).join('<div class="step-line"></div>')}
          </div>
        </div>
        <div class="setup-body">
          ${step === 1 ? renderStep1() : step === 2 ? renderStep2() : renderStep3()}
        </div>
        <div class="setup-footer">
          ${step > 1 ? '<button class="btn btn-outline" id="prevBtn">Back</button>' : '<div></div>'}
          ${step < 3
            ? '<button class="btn btn-primary" id="nextBtn">Next</button>'
            : '<button class="btn btn-primary" id="finishBtn">Launch Programme</button>'}
        </div>
      </div>
    `;
    bindEvents();
  }

  function renderStep1() {
    return `
      <h2>Your Shop</h2>
      <p class="help-text">Give your loyalty programme a name customers will recognise.</p>
      <div class="form-group">
        <label for="shopName">Shop Name *</label>
        <input type="text" id="shopName" placeholder="e.g. The Daily Grind" value="${esc(data.shopName)}" maxlength="50" autofocus>
      </div>
      <div class="form-group">
        <label for="tagline">Tagline</label>
        <input type="text" id="tagline" placeholder="e.g. Freshly roasted since 2019" value="${esc(data.tagline)}" maxlength="80">
      </div>
      <div class="preview-card mini-preview">
        <strong>${esc(data.shopName) || 'Your Shop Name'}</strong>
        <span>${esc(data.tagline) || 'Your tagline here'}</span>
      </div>
    `;
  }

  function renderStep2() {
    return `
      <h2>Brand Colours</h2>
      <p class="help-text">Choose colours that match your shop's identity.</p>
      <div class="colour-pickers">
        <div class="form-group">
          <label for="accentColor">Accent Colour</label>
          <div class="colour-input-row">
            <input type="color" id="accentColor" value="${data.accentColor}">
            <input type="text" id="accentHex" value="${data.accentColor}" maxlength="7" class="hex-input">
          </div>
        </div>
        <div class="form-group">
          <label for="backgroundColor">Background Colour</label>
          <div class="colour-input-row">
            <input type="color" id="backgroundColor" value="${data.backgroundColor}">
            <input type="text" id="bgHex" value="${data.backgroundColor}" maxlength="7" class="hex-input">
          </div>
        </div>
      </div>
      <div class="preview-card colour-preview" id="colourPreview" style="background:${data.backgroundColor}; color:${Store.getConfig().accentColor};">
        <div class="preview-header" style="background:${data.accentColor}; color: white; padding: 12px; border-radius: 8px 8px 0 0;">
          <strong>${esc(data.shopName)}</strong>
        </div>
        <div style="padding:16px;">
          <div class="stamp-preview-row">
            ${Array(4).fill(0).map((_,i) => `<div class="stamp-dot filled" style="background:${data.accentColor}"></div>`).join('')}
            ${Array(4).fill(0).map(() => `<div class="stamp-dot empty" style="border-color:${data.accentColor}"></div>`).join('')}
          </div>
          <p style="color:${data.accentColor}; margin-top:8px; font-size:13px;">4 / 8 stamps collected</p>
        </div>
      </div>
    `;
  }

  function renderStep3() {
    const presets = [5, 8, 10, 12];
    return `
      <h2>Reward Setup</h2>
      <p class="help-text">How many visits until a customer earns their reward?</p>
      <div class="form-group">
        <label>Stamps needed for reward</label>
        <div class="preset-buttons">
          ${presets.map(n => `<button class="preset-btn ${data.rewardThreshold === n ? 'active' : ''}" data-val="${n}">${n}</button>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label for="rewardDescription">Reward Description</label>
        <input type="text" id="rewardDescription" placeholder="e.g. Free coffee of your choice" value="${esc(data.rewardDescription)}" maxlength="100">
      </div>
      <div class="preview-card reward-preview">
        <div class="stamp-preview-row">
          ${Array(data.rewardThreshold).fill(0).map((_,i) => `<div class="stamp-dot filled"></div>`).join('')}
        </div>
        <p class="reward-text">${esc(data.rewardDescription) || 'Your reward here'}</p>
      </div>
    `;
  }

  function bindEvents() {
    // Step navigation
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const finishBtn = document.getElementById('finishBtn');

    if (prevBtn) prevBtn.onclick = () => { collectData(); step--; render(); };
    if (nextBtn) nextBtn.onclick = () => {
      collectData();
      if (step === 1 && !data.shopName.trim()) {
        shake(document.getElementById('shopName'));
        return;
      }
      step++;
      render();
    };
    if (finishBtn) finishBtn.onclick = () => {
      collectData();
      if (!data.rewardDescription.trim()) {
        shake(document.getElementById('rewardDescription'));
        return;
      }
      Store.saveConfig({ ...data, setupComplete: true });
      Router.navigate('/dashboard');
    };

    // Live preview updates
    if (step === 1) {
      const nameInput = document.getElementById('shopName');
      const tagInput = document.getElementById('tagline');
      const preview = container.querySelector('.mini-preview');
      if (nameInput) nameInput.oninput = () => {
        data.shopName = nameInput.value;
        preview.querySelector('strong').textContent = nameInput.value || 'Your Shop Name';
      };
      if (tagInput) tagInput.oninput = () => {
        data.tagline = tagInput.value;
        preview.querySelector('span').textContent = tagInput.value || 'Your tagline here';
      };
    }

    if (step === 2) {
      const ac = document.getElementById('accentColor');
      const bg = document.getElementById('backgroundColor');
      const acHex = document.getElementById('accentHex');
      const bgHex = document.getElementById('bgHex');

      function updatePreview() {
        const preview = document.getElementById('colourPreview');
        if (!preview) return;
        preview.style.background = data.backgroundColor;
        const header = preview.querySelector('.preview-header');
        header.style.background = data.accentColor;
        preview.querySelectorAll('.stamp-dot.filled').forEach(d => d.style.background = data.accentColor);
        preview.querySelectorAll('.stamp-dot.empty').forEach(d => d.style.borderColor = data.accentColor);
        preview.querySelector('p').style.color = data.accentColor;
      }

      ac.oninput = () => { data.accentColor = ac.value; acHex.value = ac.value; updatePreview(); };
      bg.oninput = () => { data.backgroundColor = bg.value; bgHex.value = bg.value; updatePreview(); };
      acHex.oninput = () => { if (/^#[0-9a-fA-F]{6}$/.test(acHex.value)) { data.accentColor = acHex.value; ac.value = acHex.value; updatePreview(); }};
      bgHex.oninput = () => { if (/^#[0-9a-fA-F]{6}$/.test(bgHex.value)) { data.backgroundColor = bgHex.value; bg.value = bgHex.value; updatePreview(); }};
    }

    if (step === 3) {
      document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.onclick = () => {
          data.rewardThreshold = parseInt(btn.dataset.val);
          render();
        };
      });
      const descInput = document.getElementById('rewardDescription');
      if (descInput) descInput.oninput = () => {
        data.rewardDescription = descInput.value;
        container.querySelector('.reward-text').textContent = descInput.value || 'Your reward here';
      };
    }
  }

  function collectData() {
    if (step === 1) {
      const n = document.getElementById('shopName');
      const t = document.getElementById('tagline');
      if (n) data.shopName = n.value.trim();
      if (t) data.tagline = t.value.trim();
    }
    if (step === 3) {
      const d = document.getElementById('rewardDescription');
      if (d) data.rewardDescription = d.value.trim();
    }
  }

  function shake(el) {
    el.classList.add('shake');
    el.focus();
    setTimeout(() => el.classList.remove('shake'), 500);
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  render();
}
