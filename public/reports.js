var Reports = {

  currentAgency: null,

  getDateRange: function() {
    var from = document.getElementById('report-from').value;
    var to = document.getElementById('report-to').value;
    if (!from || !to) {
      var now = new Date();
      var y = now.getFullYear();
      var m = String(now.getMonth() + 1).padStart(2, '0');
      from = y + '-' + m + '-01';
      to = now.toISOString().split('T')[0];
      document.getElementById('report-from').value = from;
      document.getElementById('report-to').value = to;
    }
    return { from: from, to: to };
  },

  getData: async function(agency, from, to) {
    var allPatrols = await LocalDB.getAll('patrols');
    var allObs = await LocalDB.getAll('observations');
    var allUsers = await LocalDB.getAll('users');
    var userMap = {};
    allUsers.forEach(function(u) { userMap[u.id] = u; });

    var patrols = allPatrols.filter(function(p) {
      return p.start_time && p.start_time >= from && p.start_time <= to + 'T23:59:59Z';
    });

    var obs = allObs.filter(function(o) {
      return o.recorded_at && o.recorded_at >= from && o.recorded_at <= to + 'T23:59:59Z';
    });

    if (agency === 'gbrmpa') {
      obs = obs.filter(function(o) { return o.type === 'marine' || o.type === 'water_quality'; });
    }
    if (agency === 'niaa') {
      // all obs
    }
    if (agency === 'qpws') {
      obs = obs.filter(function(o) { return o.type !== 'marine'; });
    }

    return { patrols: patrols, obs: obs, userMap: userMap };
  },

  preview: async function(agency) {
    Reports.currentAgency = agency;
    var range = Reports.getDateRange();
    var data = await Reports.getData(agency, range.from, range.to);
    var html = Reports.buildPreviewHTML(agency, data, range);
    document.getElementById('report-modal-title').textContent = Reports.agencyLabel(agency) + ' — Preview';
    document.getElementById('report-modal-body').innerHTML = html;
    document.getElementById('report-modal-export-btn').onclick = function() { Reports.export(agency); };
    document.getElementById('report-modal').classList.remove('hidden');
  },

  closePreview: function() {
    document.getElementById('report-modal').classList.add('hidden');
  },

  agencyLabel: function(agency) {
    return { niaa: 'NIAA', gbrmpa: 'GBRMPA', qpws: 'QPWS' }[agency] || agency.toUpperCase();
  },

  buildPreviewHTML: function(agency, data, range) {
    var html = '<div class="preview-section">';
    html += '<div class="preview-meta"><b>Organisation:</b> Lama Lama Rangers — Yintjingga Aboriginal Corporation</div>';
    html += '<div class="preview-meta"><b>Period:</b> ' + range.from + ' to ' + range.to + '</div>';
    html += '<div class="preview-meta"><b>Generated:</b> ' + new Date().toLocaleDateString() + '</div>';
    html += '</div>';

    // Patrol log table
    html += '<div class="preview-section"><div class="preview-heading">Patrol Log (' + data.patrols.length + ' patrols)</div>';
    if (data.patrols.length === 0) {
      html += '<p class="preview-empty">No patrols in this period.</p>';
    } else {
      html += '<table class="preview-table"><thead><tr><th>Date</th><th>Ranger</th><th>Type</th><th>Status</th></tr></thead><tbody>';
      data.patrols.forEach(function(p) {
        var ranger = data.userMap[p.ranger_id] ? data.userMap[p.ranger_id].name : 'Ranger';
        var date = p.start_time ? p.start_time.split('T')[0] : '--';
        html += '<tr><td>' + date + '</td><td>' + escapeHTML(ranger) + '</td><td>' + escapeHTML(p.patrol_type.replace('_', ' ')) + '</td><td>' + escapeHTML(p.status) + '</td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '</div>';

    // Observations table
    var obsLabel = agency === 'gbrmpa' ? 'Marine Observations' : 'Observations';
    html += '<div class="preview-section"><div class="preview-heading">' + obsLabel + ' (' + data.obs.length + ')</div>';
    if (data.obs.length === 0) {
      html += '<p class="preview-empty">No observations in this period.</p>';
    } else {
      html += '<table class="preview-table"><thead><tr><th>Date</th><th>Type</th><th>Detail</th><th>GPS</th></tr></thead><tbody>';
      data.obs.forEach(function(o) {
        var d = typeof o.data === 'string' ? JSON.parse(o.data) : o.data;
        var detail = '';
        if (o.type === 'weed') detail = escapeHTML(d.species || '') + ' — ' + escapeHTML(d.density || '');
        else if (o.type === 'feral_animal') detail = escapeHTML(String(d.count)) + ' ' + escapeHTML(d.species || '') + ' — ' + escapeHTML(d.behaviour || '');
        else if (o.type === 'marine') detail = escapeHTML(String(d.count)) + ' ' + escapeHTML((d.species || '').replace(/_/g, ' ')) + ' — ' + escapeHTML(d.activity || '');
        else if (o.type === 'water_quality') detail = 'pH ' + escapeHTML(String(d.ph || '?')) + ', ' + escapeHTML((d.visual || '').replace(/_/g, ' '));
        else if (o.type === 'cultural_site') detail = 'Condition: ' + escapeHTML(d.site_condition || '') + ' — ' + escapeHTML(d.access_status || '');
        var gps = o.lat ? o.lat.toFixed(4) + ', ' + o.lng.toFixed(4) : '--';
        var date = o.recorded_at ? o.recorded_at.split('T')[0] : '--';
        html += '<tr><td>' + date + '</td><td>' + escapeHTML(o.type.replace('_', ' ')) + '</td><td>' + detail + '</td><td>' + gps + '</td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '</div>';

    return html;
  },

  export: async function(agency) {
    var range = Reports.getDateRange();
    var data = await Reports.getData(agency, range.from, range.to);
    Reports.generatePDF(agency, data, range);
    Reports.closePreview();
  },

  exportAll: async function() {
    Toast.show('Generating all 3 reports...', 'info');
    var range = Reports.getDateRange();
    var agencies = ['niaa', 'gbrmpa', 'qpws'];
    for (var i = 0; i < agencies.length; i++) {
      var data = await Reports.getData(agencies[i], range.from, range.to);
      Reports.generatePDF(agencies[i], data, range);
      await new Promise(function(r) { setTimeout(r, 500); });
    }
    Toast.show('All 3 reports exported!', 'success');
  },

  generatePDF: function(agency, data, range) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 16;

    // Header bar
    var headerColors = { niaa: [26, 74, 163], gbrmpa: [26, 122, 74], qpws: [139, 69, 19] };
    var col = headerColors[agency] || [26, 46, 58];
    doc.setFillColor(col[0], col[1], col[2]);
    doc.rect(0, 0, pageW, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('LamaTrak — ' + Reports.agencyLabel(agency) + ' Report', margin, 11);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Lama Lama Rangers · Yintjingga Aboriginal Corporation · Port Stewart, Cape York', margin, 18);
    doc.text('Period: ' + range.from + ' to ' + range.to + '   |   Generated: ' + new Date().toLocaleDateString(), margin, 24);

    // Reset text colour
    doc.setTextColor(26, 46, 58);
    var y = 36;

    // Helper: section heading
    function sectionHead(title) {
      doc.setFillColor(238, 242, 246);
      doc.rect(margin, y, pageW - margin * 2, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(26, 46, 58);
      doc.text(title, margin + 2, y + 5);
      y += 10;
    }

    // Patrol log table
    sectionHead('Patrol Log (' + data.patrols.length + ' patrols)');
    if (data.patrols.length > 0) {
      var patrolRows = data.patrols.map(function(p) {
        var ranger = data.userMap[p.ranger_id] ? data.userMap[p.ranger_id].name : 'Ranger';
        var date = p.start_time ? p.start_time.split('T')[0] : '--';
        var start = p.start_time ? p.start_time.split('T')[1].substring(0, 5) : '--';
        var end = p.end_time ? p.end_time.split('T')[1].substring(0, 5) : 'Active';
        var gps = p.start_lat ? p.start_lat.toFixed(4) + ', ' + p.start_lng.toFixed(4) : '--';
        return [date, ranger, p.patrol_type.replace(/_/g, ' '), start + ' – ' + end, gps, p.status];
      });
      doc.autoTable({
        startY: y,
        head: [['Date', 'Ranger', 'Type', 'Hours', 'GPS Start', 'Status']],
        body: patrolRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: col, textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawPage: function(d) { y = d.cursor.y + 6; }
      });
      y = doc.lastAutoTable.finalY + 6;
    } else {
      doc.setFontSize(9); doc.setTextColor(140, 160, 180);
      doc.text('No patrols recorded in this period.', margin, y); y += 8;
      doc.setTextColor(26, 46, 58);
    }

    // Observations table
    var obsTitle = agency === 'gbrmpa' ? 'Marine & Water Observations' : 'Observations (' + data.obs.length + ')';
    sectionHead(obsTitle);
    if (data.obs.length > 0) {
      var obsRows = data.obs.map(function(o) {
        var d = typeof o.data === 'string' ? JSON.parse(o.data) : o.data;
        var detail = '';
        if (o.type === 'weed') detail = (d.species || '') + ' — ' + (d.density || '');
        else if (o.type === 'feral_animal') detail = d.count + 'x ' + (d.species || '') + ' — ' + (d.behaviour || '');
        else if (o.type === 'marine') detail = d.count + 'x ' + (d.species || '').replace(/_/g, ' ') + ' — ' + (d.activity || '');
        else if (o.type === 'water_quality') detail = 'pH ' + (d.ph || '?') + ', ' + (d.visual || '').replace(/_/g, ' ');
        else if (o.type === 'cultural_site') detail = (d.site_condition || '') + ' — ' + (d.access_status || '');
        var gps = o.lat ? o.lat.toFixed(4) + ', ' + o.lng.toFixed(4) : '--';
        var date = o.recorded_at ? o.recorded_at.split('T')[0] : '--';
        return [date, o.type.replace(/_/g, ' '), detail, gps];
      });
      doc.autoTable({
        startY: y,
        head: [['Date', 'Type', 'Detail', 'GPS']],
        body: obsRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: col, textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 2: { cellWidth: 80 } }
      });
      y = doc.lastAutoTable.finalY + 6;
    } else {
      doc.setFontSize(9); doc.setTextColor(140, 160, 180);
      doc.text('No observations recorded in this period.', margin, y); y += 8;
      doc.setTextColor(26, 46, 58);
    }

    // Footer
    var pageCount = doc.internal.getNumberOfPages();
    for (var i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(140, 160, 180);
      doc.text('LamaTrak v1.0 — EWB Challenge 2026 — Team 2, Design Area 4', margin, 290);
      doc.text('Page ' + i + ' of ' + pageCount, pageW - margin, 290, { align: 'right' });
    }

    doc.save('LamaTrak-' + agency.toUpperCase() + '-' + range.from + '-to-' + range.to + '.pdf');
    Toast.show(Reports.agencyLabel(agency) + ' report exported!', 'success');
  }
};

// Set default dates on page load
document.addEventListener('DOMContentLoaded', function() {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var fromInput = document.getElementById('report-from');
  var toInput = document.getElementById('report-to');
  if (fromInput) fromInput.value = y + '-' + m + '-01';
  if (toInput) toInput.value = now.toISOString().split('T')[0];
});