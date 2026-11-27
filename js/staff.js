/**
 * Staff Dashboard & Queue Management Module
 */

const StaffModule = (function () {
  let currentOfficeFilter = 'all';
  let selectedTicketForTransfer = null;
  let searchTerm = '';

  function renderDashboard() {
    const stats = QueueManager.getStats();

    document.querySelectorAll('[data-stat="totalWaiting"]').forEach(el => { el.textContent = stats.totalWaiting; });
    document.querySelectorAll('[data-stat="serving"]').forEach(el => { el.textContent = stats.totalServing; });
    document.querySelectorAll('[data-stat="served"]').forEach(el => { el.textContent = stats.totalServed; });
    document.querySelectorAll('[data-stat="avgWait"]').forEach(el => { el.textContent = stats.avgWait + ' min'; });

    renderServingPanel();
    renderStaffQueueTable();
  }

  function renderServingPanel() {
    const panel = document.getElementById('servingPanel');
    if (!panel) return;
    const rows = [];
    QueueManager.getOffices().forEach(o => {
      const t = QueueManager.getQueueForOffice(o.id).find(x => x.status === 'serving');
      if (!t) return;
      rows.push(`
        <div class="serving-row">
          <div class="serving-row-num">#${t.number}</div>
          <div class="serving-row-info">
            <strong>${t.studentName}</strong>
            <span>${o.name} · ${t.service}</span>
          </div>
          <div class="action-btns">
            <button class="btn btn-sm btn-success" data-action="StaffModule.serve" data-args="${o.id}|${t.id}">Serve</button>
            <button class="btn btn-sm btn-warning" data-action="StaffModule.skip" data-args="${o.id}|${t.id}">Skip</button>
          </div>
        </div>`);
    });
    panel.innerHTML = rows.length ? rows.join('') : '<p class="muted-text pad">No ticket is being served right now. Use Call Next to start.</p>';
  }

  function setSearch() {
    const el = document.getElementById('staffQueueSearch');
    searchTerm = el ? el.value.toLowerCase().trim() : '';
    renderStaffQueueTable();
  }

  function renderStaffQueueTable() {
    const bodies = document.querySelectorAll('.staff-queue-body');
    if (!bodies.length) return;

    const offices = QueueManager.getOffices();
    let allTickets = [];

    offices.forEach(o => {
      const queue = QueueManager.getQueueForOffice(o.id);
      queue.forEach(t => {
        if (['waiting', 'serving'].includes(t.status)) {
          allTickets.push({ ...t, officeName: o.name });
        }
      });
    });

    allTickets.sort((a, b) => {
      if (a.status === 'serving' && b.status !== 'serving') return -1;
      if (b.status === 'serving' && a.status !== 'serving') return 1;
      return a.number.localeCompare(b.number);
    });

    if (currentOfficeFilter !== 'all') {
      allTickets = allTickets.filter(t => t.office === currentOfficeFilter);
    }

    if (searchTerm) {
      allTickets = allTickets.filter(t =>
        t.studentName.toLowerCase().includes(searchTerm) ||
        t.number.includes(searchTerm.replace('#', '')) ||
        t.service.toLowerCase().includes(searchTerm) ||
        t.officeName.toLowerCase().includes(searchTerm)
      );
    }

    const emptyHtml = `
      <tr>
        <td colspan="6" class="empty-cell">
          No students in queue
        </td>
      </tr>
    `;

    const rowsHtml = allTickets.length === 0 ? emptyHtml : allTickets.map(t => `
      <tr>
        <td><strong>#${t.number}</strong></td>
        <td>${t.studentName}</td>
        <td>${t.service}</td>
        <td>${t.officeName}</td>
        <td><span class="status ${t.status}">${t.status}</span></td>
        <td>
          <div class="action-btns">
            ${t.status === 'waiting' ? `
              <button class="btn btn-sm btn-primary" data-action="StaffModule.callSpecific" data-args="${t.office}|${t.id}">Call</button>
            ` : ''}
            ${t.status === 'serving' ? `
              <button class="btn btn-sm btn-success" data-action="StaffModule.serve" data-args="${t.office}|${t.id}">Serve</button>
            ` : ''}
            <button class="btn btn-sm btn-warning" data-action="StaffModule.skip" data-args="${t.office}|${t.id}">Skip</button>
            <button class="btn btn-sm btn-outline" data-action="StaffModule.openTransfer" data-args="${t.office}|${t.id}">Transfer</button>
          </div>
        </td>
      </tr>
    `).join('');

    bodies.forEach(tbody => { tbody.innerHTML = rowsHtml; });
  }

  function setOfficeFilter(officeId) {
    currentOfficeFilter = officeId;
    document.querySelectorAll('[data-office-filter]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.officeFilter === officeId);
    });
    renderStaffQueueTable();
  }


async function updateTicketStatus(ticketId, status) {

    try {

        const response = await fetch(
            `/api/tickets/${ticketId}/status`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: status
                })
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            Notifications.showToast(
                'Error',
                result.message,
                'danger'
            );

            return null;
        }

        await QueueManager.syncFromServer();

        renderDashboard();
        renderNowServing();

        return result.ticket;

    } catch (error) {

        console.error(error);

        Notifications.showToast(
            'Connection Error',
            'Cannot connect to the server.',
            'danger'
        );

        return null;
    }
}

async function callNext(officeId) {

    const data = QueueManager.getData();

    if (typeof officeId !== 'string' || officeId === 'all') {

        const office = QueueManager.getOffices().find(o =>
            !data.currentlyServing[o.id] &&
            data.queues[o.id].some(t => t.status === 'waiting')
        );

        officeId = office ? office.id : null;
    }

    if (!officeId || !data.queues[officeId]) {
        Notifications.showToast(
            'No queue',
            'No available waiting tickets.',
            'warning'
        );
        return;
    }

    const ticket = data.queues[officeId].find(
        t => t.status === 'waiting'
    );

    if (!ticket) {
        Notifications.showToast(
            'No queue',
            'No students waiting.',
            'warning'
        );
        return;
    }

    const result = await updateTicketStatus(
        ticket.id,
        'serving'
    );

    if (result) {
        Notifications.showToast(
            'Now calling',
            `Ticket #${result.number}`,
            'success'
        );
    }
}

  function callNextSelected() {
    const select = document.getElementById('servingOfficeSelect');
    callNext(select ? select.value : undefined);
  }

  
  async function callSpecific(officeId, ticketId) {

    const ticket = await updateTicketStatus(
        ticketId,
        'serving'
    );

    if (ticket) {
        Notifications.showToast(
            'Now calling',
            `Ticket #${ticket.number}`,
            'success'
        );
    }
  }

  async function serve(officeId, ticketId) {

    const ticket = await updateTicketStatus(
        ticketId,
        'served'
    );

    if (ticket) {
        Notifications.showToast(
            'Transaction completed',
            `Ticket #${ticket.number} served.`,
            'success'
        );
    }
  }

  
  async function skip(officeId, ticketId) {

    const ticket = await updateTicketStatus(
        ticketId,
        'skipped'
    );

    if (ticket) {
        Notifications.showToast(
            'Ticket skipped',
            `Ticket #${ticket.number} skipped.`,
            'warning'
        );
    }
}


  function openTransfer(officeId, ticketId) {
    selectedTicketForTransfer = { officeId, ticketId };
    const modal = document.getElementById('transferModal');
    if (!modal) return;

    const select = document.getElementById('transferOfficeSelect');
    if (select) {
      const offices = QueueManager.getOffices().filter(o => o.id !== officeId);
      select.innerHTML = offices.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
    }
    modal.classList.add('show');
  }

  
  async function confirmTransfer() {

      if (!selectedTicketForTransfer) return;

      const target = document.getElementById(
          'transferOfficeSelect'
      ).value;

      const ticketId = selectedTicketForTransfer.ticketId;

      try {

          const response = await fetch(
              `/api/tickets/${ticketId}/transfer`,
              {
                  method: 'PATCH',
                  headers: {
                      'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                      targetOffice: target
                  })
              }
          );

          const result = await response.json();

          if (!response.ok || !result.success) {

              Notifications.showToast(
                  'Transfer failed',
                  result.message,
                  'danger'
              );

              return;
          }

          closeTransferModal();

          await QueueManager.syncFromServer();

          const office = QueueManager.getOffice(target);

          Notifications.notifyTransferred(
              result.ticket.number,
              office.name
          );

          Notifications.showToast(
              'Transferred',
              `Ticket moved to ${office.name} as #${result.ticket.number}`,
              'success'
          );

          renderDashboard();

      } catch (error) {

          console.error(error);

          Notifications.showToast(
              'Transfer failed',
              'Cannot connect to the server.',
              'danger'
          );
      }
  }


  function closeTransferModal() {
    const modal = document.getElementById('transferModal');
    if (modal) modal.classList.remove('show');
    selectedTicketForTransfer = null;
  }

  function renderNowServing() {
    const officeSelect = document.getElementById('servingOfficeSelect');
    let officeId = officeSelect ? officeSelect.value : 'registrar';

    const office = QueueManager.getOffice(officeId);
    const serving = QueueManager.getCurrentlyServing(officeId);
    const waiting = QueueManager.getWaitingCount(officeId);
    const queue = QueueManager.getQueueForOffice(officeId);
    const nextTickets = queue.filter(t => t.status === 'waiting').slice(0, 4);
    const recentServed = queue.filter(t => t.status === 'served').slice(-5).reverse();

    const numEl = document.getElementById('currentServingNumber');
    const officeEl = document.getElementById('currentServingOffice');
    const waitEl = document.getElementById('servingWaitingCount');

    if (numEl) numEl.textContent = serving ? `#${serving.number}` : '—';
    if (officeEl) officeEl.textContent = office ? office.name : '';
    if (waitEl) waitEl.textContent = waiting;

    const nextEl = document.getElementById('nextNumbers');
    if (nextEl) {
      if (nextTickets.length === 0) {
        nextEl.innerHTML = '<p class="muted-text">No more tickets</p>';
      } else {
        nextEl.innerHTML = nextTickets.map((t, i) => `
          <div class="next-number-chip ${i === 0 ? 'current' : ''}">#${t.number}</div>
        `).join('');
      }
    }

    const recentEl = document.getElementById('recentServedList');
    if (recentEl) {
      if (recentServed.length === 0) {
        recentEl.innerHTML = '<p class="muted-text pad">None yet today</p>';
      } else {
        recentEl.innerHTML = recentServed.map(t => `
          <div class="recent-served-item">
            <span class="num">#${t.number}</span>
            <span>${t.studentName}</span>
          </div>
        `).join('');
      }
    }
  }

  function initOfficeSelect() {
    const select = document.getElementById('servingOfficeSelect');
    if (!select || select.options.length) return;
    select.innerHTML = QueueManager.getOffices().map(o => `<option value="${o.id}">${o.name}</option>`).join('');
  }

  return {
    renderDashboard,
    renderServingPanel,
    setSearch,
    renderStaffQueueTable,
    setOfficeFilter,
    callNext,
    callNextSelected,
    callSpecific,
    serve,
    skip,
    openTransfer,
    confirmTransfer,
    closeTransferModal,
    renderNowServing,
    initOfficeSelect
  };
})();