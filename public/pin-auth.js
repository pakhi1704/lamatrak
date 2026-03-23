/* ═══════════════════════════════════════════════════════════
   LamaTrak — PIN Authentication Module
   Drop this file into /public/ and add <script src="/pin-auth.js"></script>
   BEFORE <script src="/app.js"></script> in index.html
   ═══════════════════════════════════════════════════════════ */

var PinAuth = {

  /* ── State ── */
  selectedUserId: null,
  selectedUserName: null,
  selectedUserRole: null,
  enteredPin: '',
  isSettingPin: false,
  pendingNewPin: '',
  maxAttempts: 5,
  attempts: 0,
  lockoutUntil: null,

  /* ── SHA-256 hash (Web Crypto API) ── */
  hashPin: async function(pin) {
    var enc = new TextEncoder();
    var data = enc.encode('lamatrak-salt-v1:' + pin);
    var hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(function(b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  },

  /* ── Storage keys ── */
  pinKey: function(userId) { return 'pin_hash_' + userId; },
  lockKey: function(userId) { return 'pin_lock_' + userId; },
  attemptsKey: function(userId) { return 'pin_attempts_' + userId; },

  /* ── Check if user has a PIN set ── */
  hasPin: function(userId) {
    return !!localStorage.getItem(PinAuth.pinKey(userId));
  },

  /* ── Save a PIN ── */
  savePin: async function(userId, pin) {
    var hash = await PinAuth.hashPin(pin);
    localStorage.setItem(PinAuth.pinKey(userId), hash);
    localStorage.removeItem(PinAuth.attemptsKey(userId));
    localStorage.removeItem(PinAuth.lockKey(userId));
  },

  /* ── Verify a PIN ── */
  verifyPin: async function(userId, pin) {
    var stored = localStorage.getItem(PinAuth.pinKey(userId));
    if (!stored) return false;
    var hash = await PinAuth.hashPin(pin);
    return hash === stored;
  },

  /* ── Lockout helpers ── */
  isLockedOut: function(userId) {
    var until = parseInt(localStorage.getItem(PinAuth.lockKey(userId)) || '0');
    return Date.now() < until;
  },

  getLockoutRemaining: function(userId) {
    var until = parseInt(localStorage.getItem(PinAuth.lockKey(userId)) || '0');
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  },

  recordFailedAttempt: function(userId) {
    var attempts = parseInt(localStorage.getItem(PinAuth.attemptsKey(userId)) || '0') + 1;
    localStorage.setItem(PinAuth.attemptsKey(userId), attempts);
    if (attempts >= PinAuth.maxAttempts) {
      var lockUntil = Date.now() + 5 * 60 * 1000; // 5 min lockout
      localStorage.setItem(PinAuth.lockKey(userId), lockUntil);
      localStorage.setItem(PinAuth.attemptsKey(userId), '0');
    }
    return attempts;
  },

  clearAttempts: function(userId) {
    localStorage.removeItem(PinAuth.attemptsKey(userId));
    localStorage.removeItem(PinAuth.lockKey(userId));
  },

  /* ════════════════════════════════════════════════
     UI — called from updated login screen
     ════════════════════════════════════════════════ */

  /* Step 1: Ranger selected, show PIN pad */
  showPinPad: function(userId, userName, userRole, opts) {
    opts = opts || {};
    PinAuth.selectedUserId = userId;
    PinAuth.selectedUserName = userName;
    PinAuth.selectedUserRole = userRole;
    PinAuth.enteredPin = '';
    PinAuth.isSettingPin = false;
    PinAuth.pendingNewPin = '';

    // Check lockout
    if (PinAuth.isLockedOut(userId)) {
      PinAuth.renderPinScreen('locked');
      PinAuth.startLockoutCountdown(userId);
      return;
    }

    var hasPin = PinAuth.hasPin(userId);
    if (!hasPin || opts.forceSetup) {
      PinAuth.isSettingPin = true;
      PinAuth.renderPinScreen('setup');
    } else {
      PinAuth.renderPinScreen('enter');
    }
  },

  /* Render the full PIN screen overlay */
  renderPinScreen: function(mode) {
    var existing = document.getElementById('pin-overlay');
    if (existing) existing.remove();

    var titles = {
      enter:  'Enter your PIN',
      setup:  'Create your PIN',
      confirm:'Confirm your PIN',
      locked: 'Account Locked'
    };

    var subtitles = {
      enter:  PinAuth.selectedUserName,
      setup:  'First time? Set a 4-digit PIN to secure your account',
      confirm:'Re-enter your PIN to confirm',
      locked: 'Too many failed attempts'
    };

    var overlay = document.createElement('div');
    overlay.id = 'pin-overlay';
    overlay.innerHTML = [
      '<div class="pin-bg">',
        '<div class="pin-content">',

          /* Avatar / Icon */
          '<div class="pin-avatar">',
            '<div class="pin-avatar-inner">',
              PinAuth.getAvatarInitials(PinAuth.selectedUserName),
            '</div>',
            '<div class="pin-avatar-ring"></div>',
          '</div>',

          /* Title */
          '<div class="pin-title">' + (titles[mode] || 'PIN') + '</div>',
          '<div class="pin-subtitle">' + (subtitles[mode] || '') + '</div>',

          /* Dots */
          mode !== 'locked' ? [
            '<div class="pin-dots" id="pin-dots">',
              '<div class="pin-dot" id="pd0"></div>',
              '<div class="pin-dot" id="pd1"></div>',
              '<div class="pin-dot" id="pd2"></div>',
              '<div class="pin-dot" id="pd3"></div>',
            '</div>',
            '<div class="pin-error" id="pin-error"></div>',

            /* Numpad */
            '<div class="pin-pad">',
              [1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(function(k) {
                if (k === '') return '<div class="pin-key pin-key--empty"></div>';
                return '<button class="pin-key' + (k === '⌫' ? ' pin-key--del' : '') + '" ' +
                  'onclick="PinAuth.pressKey(\'' + k + '\', this)">' + k + '</button>';
              }).join(''),
            '</div>',

            /* Back link */
            '<button class="pin-back-link" onclick="PinAuth.goBack()">← Change ranger</button>',
          ].join('') : [
            '<div class="pin-lockout-timer" id="pin-lockout-timer">--:--</div>',
            '<div class="pin-lockout-msg">Wait for the timer to unlock your account</div>',
            '<button class="pin-back-link" onclick="PinAuth.goBack()">← Choose different ranger</button>',
          ].join(''),

        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('pin-overlay--visible'); });
  },

  getAvatarInitials: function(name) {
    if (!name) return 'R';
    var parts = name.trim().split(' ');
    if (parts.length >= 2) return parts[0][0].toUpperCase() + parts[1][0].toUpperCase();
    return parts[0][0].toUpperCase();
  },

pressKey: function(key, btn) {
    if (key === '⌫') {
      PinAuth.enteredPin = PinAuth.enteredPin.slice(0, -1);
      PinAuth.updateDots();
      return;
    }
    if (PinAuth.enteredPin.length >= 4) return;
    PinAuth.enteredPin += String(key);
    PinAuth.updateDots();

    if (btn) {
      btn.classList.add('pin-key--pressed');
      setTimeout(function() { btn.classList.remove('pin-key--pressed'); }, 150);
    }

    if (PinAuth.enteredPin.length === 4) {
      setTimeout(function() { PinAuth.handleComplete(); }, 200);
    }
  },

  updateDots: function() {
    for (var i = 0; i < 4; i++) {
      var dot = document.getElementById('pd' + i);
      if (dot) dot.classList.toggle('pin-dot--filled', i < PinAuth.enteredPin.length);
    }
  },

  handleComplete: async function() {
    var userId = PinAuth.selectedUserId;

    /* ── Setting up PIN ── */
    if (PinAuth.isSettingPin && !PinAuth.pendingNewPin) {
      PinAuth.pendingNewPin = PinAuth.enteredPin;
      PinAuth.enteredPin = '';
      PinAuth.renderPinScreen('confirm');
      return;
    }

    /* ── Confirming new PIN ── */
    if (PinAuth.isSettingPin && PinAuth.pendingNewPin) {
      if (PinAuth.enteredPin !== PinAuth.pendingNewPin) {
        PinAuth.showError("PINs don't match — try again");
        PinAuth.pendingNewPin = '';
        PinAuth.enteredPin = '';
        setTimeout(function() { PinAuth.renderPinScreen('setup'); }, 1200);
        return;
      }
      await PinAuth.savePin(userId, PinAuth.enteredPin);
      PinAuth.showSuccess('PIN set! Logging in...');
      setTimeout(function() { PinAuth.completeLogin(); }, 800);
      return;
    }

    /* ── Verifying existing PIN ── */
    if (PinAuth.isLockedOut(userId)) {
      PinAuth.renderPinScreen('locked');
      PinAuth.startLockoutCountdown(userId);
      return;
    }

    var ok = await PinAuth.verifyPin(userId, PinAuth.enteredPin);
    if (ok) {
      PinAuth.clearAttempts(userId);
      PinAuth.showSuccess('Welcome back!');
      setTimeout(function() { PinAuth.completeLogin(); }, 600);
    } else {
      var attempts = PinAuth.recordFailedAttempt(userId);
      var remaining = PinAuth.maxAttempts - attempts;
      if (PinAuth.isLockedOut(userId)) {
        PinAuth.renderPinScreen('locked');
        PinAuth.startLockoutCountdown(userId);
      } else {
        PinAuth.showError('Wrong PIN' + (remaining <= 2 ? ' — ' + remaining + ' attempt' + (remaining === 1 ? '' : 's') + ' left' : ''));
        PinAuth.enteredPin = '';
        setTimeout(function() { PinAuth.updateDots(); }, 100);
      }
    }
  },

  showError: function(msg) {
    var dots = document.getElementById('pin-dots');
    var errEl = document.getElementById('pin-error');
    if (dots) { dots.classList.add('pin-dots--shake'); setTimeout(function() { dots.classList.remove('pin-dots--shake'); }, 600); }
    if (errEl) { errEl.textContent = msg; errEl.classList.add('pin-error--visible'); }
    // Flash dots red
    for (var i = 0; i < 4; i++) {
      var d = document.getElementById('pd' + i);
      if (d) { d.classList.add('pin-dot--error'); setTimeout(function(dot) { dot.classList.remove('pin-dot--error', 'pin-dot--filled'); }.bind(null, d), 600); }
    }
  },

  showSuccess: function(msg) {
    var dots = document.getElementById('pin-dots');
    var errEl = document.getElementById('pin-error');
    if (errEl) { errEl.textContent = msg; errEl.style.color = 'var(--success)'; errEl.classList.add('pin-error--visible'); }
    for (var i = 0; i < 4; i++) {
      var d = document.getElementById('pd' + i);
      if (d) d.classList.add('pin-dot--success');
    }
    if (dots) dots.classList.add('pin-dots--success');
  },

  startLockoutCountdown: function(userId) {
    var timerEl = document.getElementById('pin-lockout-timer');
    if (!timerEl) return;
    var tick = function() {
      var secs = PinAuth.getLockoutRemaining(userId);
      if (!document.getElementById('pin-lockout-timer')) return;
      if (secs <= 0) {
        PinAuth.showPinPad(userId, PinAuth.selectedUserName, PinAuth.selectedUserRole);
        return;
      }
      var m = Math.floor(secs / 60), s = secs % 60;
      timerEl.textContent = m + ':' + String(s).padStart(2, '0');
      setTimeout(tick, 1000);
    };
    tick();
  },

  completeLogin: function() {
    // Mirror what App.login() does but skip the select reading
    currentUser = { id: PinAuth.selectedUserId, name: PinAuth.selectedUserName, role: PinAuth.selectedUserRole };
    activeSite = document.getElementById('login-site').value;
    localStorage.setItem('lamatrak_user', JSON.stringify(currentUser));
    localStorage.setItem('lamatrak_site', activeSite);
    var overlay = document.getElementById('pin-overlay');
    if (overlay) { overlay.classList.add('pin-overlay--exit'); setTimeout(function() { overlay.remove(); }, 400); }
    App.enterDashboard();
  },

  goBack: function() {
    PinAuth.enteredPin = '';
    PinAuth.pendingNewPin = '';
    PinAuth.isSettingPin = false;
    var overlay = document.getElementById('pin-overlay');
    if (overlay) { overlay.classList.add('pin-overlay--exit'); setTimeout(function() { overlay.remove(); }, 300); }
  },

  /* Called by the login button (replaces App.login) */
  initiateLogin: function() {
    var sel = document.getElementById('login-user');
    var userId = sel.value;
    var txt = sel.options[sel.selectedIndex].text;
    var name = txt.split(' (')[0];
    var role = 'ranger';
    if (txt.indexOf('elder') > -1) role = 'elder';
    else if (txt.indexOf('senior') > -1) role = 'senior_ranger';
    PinAuth.showPinPad(userId, name, role);
  },

  /* Admin reset: PinAuth.resetPin('u-ranger-001') from console */
  resetPin: function(userId) {
    localStorage.removeItem(PinAuth.pinKey(userId));
    localStorage.removeItem(PinAuth.attemptsKey(userId));
    localStorage.removeItem(PinAuth.lockKey(userId));
    console.log('PIN reset for', userId);
  }
};