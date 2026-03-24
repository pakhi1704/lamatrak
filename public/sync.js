var SyncEngine = {
  isOnline: navigator.onLine, isSyncing: false, syncInterval: null, lastSync: null, syncLog: [],

  init: function() {
    window.addEventListener('online', function() { SyncEngine.isOnline = true; SyncEngine.updateUI(); SyncEngine.autoSync(); });
    window.addEventListener('offline', function() { SyncEngine.isOnline = false; SyncEngine.updateUI(); });
    SyncEngine.syncInterval = setInterval(function() { if (SyncEngine.isOnline && !SyncEngine.isSyncing) SyncEngine.autoSync(); }, 30000);
    SyncEngine.updateUI();
  },

  updateUI: function() {
    var dot = document.getElementById('sync-dot');
    var text = document.getElementById('sync-text');
    var dotL = document.querySelector('#sync-status-login .sync-dot');
    var textL = document.getElementById('sync-text-login');
    if (SyncEngine.isSyncing) {
      if (dot) dot.className = 'sync-dot syncing'; if (text) text.textContent = 'Syncing...';
    } else if (SyncEngine.isOnline) {
      if (dot) dot.className = 'sync-dot'; if (text) text.textContent = 'Online';
      if (dotL) dotL.className = 'sync-dot'; if (textL) textL.textContent = 'Online';
    } else {
      if (dot) dot.className = 'sync-dot offline'; if (text) text.textContent = 'Offline';
      if (dotL) dotL.className = 'sync-dot offline'; if (textL) textL.textContent = 'Offline';
    }
  },

  autoSync: async function() {
    if (SyncEngine.isSyncing || !SyncEngine.isOnline) return;
    var count = await LocalDB.getUnsyncedCount();
    if (count === 0) return;
    await SyncEngine.pushToServer();
  },

  manualSync: async function() {
    if (SyncEngine.isSyncing) { Toast.show('Sync in progress...', 'warning'); return; }
    if (!SyncEngine.isOnline) { Toast.show('No connection - data saved offline', 'warning'); return; }
    await SyncEngine.pushToServer();
  },

  pushToServer: async function() {
    SyncEngine.isSyncing = true; SyncEngine.updateUI();
    try {
      var data = await LocalDB.getUnsyncedData();
      var total = data.patrols.length + data.observations.length + data.tracks.length + data.checkins.length;
      if (total === 0) { SyncEngine.isSyncing = false; SyncEngine.updateUI(); Toast.show('Up to date', 'success'); return; }
      var token = localStorage.getItem('lamatrak_token') || '';
      var userData = JSON.parse(localStorage.getItem('lamatrak_user') || '{}');
      data.user_id = userData.id || '';
      var response = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(data) });
      if (!response.ok) throw new Error('Sync failed: ' + response.status);
      var result = await response.json();
      if (data.patrols.length) await LocalDB.markSynced('patrols', data.patrols.map(function(p) { return p.id; }));
      if (data.observations.length) await LocalDB.markSynced('observations', data.observations.map(function(o) { return o.id; }));
      if (data.tracks.length) await LocalDB.markSynced('tracks', data.tracks.map(function(t) { return t.id; }));
      if (data.checkins.length) await LocalDB.markSynced('checkins', data.checkins.map(function(c) { return c.id; }));
      SyncEngine.lastSync = new Date().toISOString();
      SyncEngine.syncLog.unshift({ time: SyncEngine.lastSync, pushed: total, conflicts: result.results && result.results.conflicts ? result.results.conflicts.length : 0 });
      if (SyncEngine.syncLog.length > 50) SyncEngine.syncLog.length = 50;
      Toast.show('Synced ' + total + ' records', 'success');
      if (typeof App !== 'undefined' && App.updateDashboard) App.updateDashboard();
    } catch (err) {
      SyncEngine.syncLog.unshift({ time: new Date().toISOString(), error: err.message });
      Toast.show('Sync failed - will retry', 'error');
    } finally { SyncEngine.isSyncing = false; SyncEngine.updateUI(); }
  }
};

var Toast = {
  el: null, timeout: null,
  show: function(message, type) {
    type = type || 'info';
    if (!Toast.el) { Toast.el = document.createElement('div'); Toast.el.className = 'toast'; document.body.appendChild(Toast.el); }
    clearTimeout(Toast.timeout);
    Toast.el.textContent = message; Toast.el.className = 'toast ' + type;
    requestAnimationFrame(function() { Toast.el.classList.add('show'); });
    Toast.timeout = setTimeout(function() { Toast.el.classList.remove('show'); }, 3000);
  }
};