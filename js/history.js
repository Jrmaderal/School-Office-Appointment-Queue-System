const HistoryModule = (function () {
  let currentPage = 1;
  const perPage = 6;
  let filteredHistory = [];

  let sortKey = 'key';
  let sortDir = 'desc';

  function render() {
    currentPage = 1;
    applyFilters();
  }

  function setSort(key) {
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = key; sortDir = key === 'key' ? 'desc' : 'asc'; }
    applyFilters();
  }

  function clearDateFilter() {
    const f = document.getElementById('historyFrom');
    const t = document.getElementById('historyTo');
    if (f) f.value = '';
    if (t) t.value = '';
    applyFilters();
  }

  function clearAll() {
    if (!confirm('Delete all queue history? This cannot be undone.')) return;
    QueueManager.clearHistory();
    render();
    Notifications.showToast('Cleared', 'Queue history deleted.', 'success');
  }

  function applyFilters() {
    const search = (document.getElementById('historySearch') || {}).value || '';
    const q = search.toLowerCase().trim();

    let list = QueueManager.getHistoryRows();

    const from = (document.getElementById('historyFrom') || {}).value || '';
    const to = (document.getElementById('historyTo') || {}).value || '';
    if (from) list = list.filter(h => h.key >= from);
    if (to) list = list.filter(h => h.key <= to);

    if (q) {
      list = list.filter(h =>
        h.date.toLowerCase().includes(q) ||
        h.day.toLowerCase().includes(q) ||
        String(h.totalVisits).includes(q)
      );
    }

    const numeric = { totalVisits: 1, canceledVisits: 1, served: 1 };
    list.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (!numeric[sortKey]) { av = String(av); bv = String(bv); }
      const c = numeric[sortKey] ? av - bv : av.localeCompare(bv);
      return sortDir === 'asc' ? c : -c;
    });

    filteredHistory = list;
    currentPage = 1;
    renderTable();
    renderPagination();
  }

  function renderTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    const start = (currentPage - 1) * perPage;
    const pageData = filteredHistory.slice(start, start + perPage);

    if (pageData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-cell">
            No history records found
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageData.map((h, i) => `
      <tr>
        <td>${h.date}</td>
        <td>${h.day}</td>
        <td>${h.duration}</td>
        <td>${h.totalVisits}</td>
        <td>${h.canceledVisits}</td>
        <td>
          <button class="btn btn-sm btn-outline" data-action="HistoryModule.showDetails" data-args="${start + i}">Details</button>
        </td>
      </tr>
    `).join('');
  }

  function renderPagination() {
    const info = document.getElementById('paginationInfo');
    const controls = document.getElementById('paginationControls');
    if (!info || !controls) return;

    const total = filteredHistory.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const start = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
    const end = Math.min(currentPage * perPage, total);

    info.textContent = `Showing ${start}–${end} of ${total}`;

    let html = `
      <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-action="HistoryModule.goPage" data-args="${currentPage - 1}">
        <i data-lucide="chevron-left" class="i-16"></i>
      </button>
    `;

    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 5 && Math.abs(i - currentPage) > 2 && i !== 1 && i !== totalPages) {
        if (i === 2 || i === totalPages - 1) html += `<span class="page-gap">…</span>`;
        continue;
      }
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-action="HistoryModule.goPage" data-args="${i}">${i}</button>`;
    }

    html += `
      <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-action="HistoryModule.goPage" data-args="${currentPage + 1}">
        <i data-lucide="chevron-right" class="i-16"></i>
      </button>
    `;

    controls.innerHTML = html;
    if (window.lucide) lucide.createIcons({ nodes: [controls] });
  }

  function goPage(page) {
    const totalPages = Math.max(1, Math.ceil(filteredHistory.length / perPage));
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
    renderPagination();
  }

  function showDetails(index) {
    const h = filteredHistory[index];
    if (!h) return;

    const modal = document.getElementById('historyDetailModal');
    if (!modal) return;

    document.getElementById('detailDate').textContent = h.date;
    document.getElementById('detailDay').textContent = h.day;
    document.getElementById('detailDuration').textContent = h.duration;
    document.getElementById('detailVisits').textContent = h.totalVisits;
    document.getElementById('detailCanceled').textContent = h.canceledVisits;
    document.getElementById('detailServed').textContent = h.served || 0;
    const sk = document.getElementById('detailSkipped');
    if (sk) sk.textContent = h.skipped || 0;
    const bo = document.getElementById('detailOffices');
    if (bo) {
      const rows = QueueManager.getOffices()
        .map(o => ({ name: o.name, c: (h.byOffice || {})[o.id] }))
        .filter(r => r.c)
        .map(r => `<div class="settings-row"><div class="label">${r.name}</div><div>${r.c.served || 0} served · ${(r.c.skipped || 0) + (r.c.canceled || 0)} canceled</div></div>`);
      bo.innerHTML = rows.join('') || '';
    }

    modal.classList.add('show');
  }

  function closeDetails() {
    const modal = document.getElementById('historyDetailModal');
    if (modal) modal.classList.remove('show');
  }

  function exportCSV() {
    QueueManager.exportHistoryCSV(filteredHistory);
    Notifications.showToast('Exported', 'Queue history downloaded as CSV.', 'success');
  }

  return {
    render,
    applyFilters,
    setSort,
    clearDateFilter,
    clearAll,
    goPage,
    showDetails,
    closeDetails,
    exportCSV
  };
})();