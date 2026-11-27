const StudentModule = (function () {
  let selectedOffice = null;
  let selectedService = null;
  let lastStatus = null;
  let almostNotified = null;

  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  function getTicketInfo() {
    const user = Auth.getCurrentUser();
    const ticket = QueueManager.getStudentTicket(user.id);
    if (!ticket) return null;
    const position = QueueManager.getQueuePosition(ticket);
    const serving = QueueManager.getCurrentlyServing(ticket.office);
    return {
      ticket,
      office: QueueManager.getOffice(ticket.office),
      position,
      servingNum: serving ? serving.number : '—',
      wait: Math.max(position * 5, 0)
    };
  }


  function renderDashboard() {
    renderStats();
    renderActiveTicket();
    renderOfficeOverview();
    renderRecentActivity();
  }

  function renderStats() {
    const user = Auth.getCurrentUser();
    const info = getTicketInfo();
    const history = QueueManager.getStudentHistory(user.id);
    const set = (name, val) => {
      document.querySelectorAll(`[data-stat="${name}"]`).forEach(el => { el.textContent = val; });
    };
    set('myStatus', info ? cap(info.ticket.status) : 'No ticket');
    set('myPosition', info ? (info.ticket.status === 'serving' ? 'Now' : info.position + 1) : '—');
    set('myWait', info ? (info.ticket.status === 'serving' ? 'Now' : info.wait + ' min') : '—');
    set('myCompleted', history.filter(h => h.status === 'served').length);
  }

  function ticketActions(ticket) {
    return ticket.status === 'waiting'
      ? `<button class="btn btn-sm btn-danger-outline" data-action="StudentModule.cancelTicket" data-args="${ticket.id}">Cancel Ticket</button>`
      : '';
  }

  function renderActiveTicket() {
    const container = document.getElementById('activeTicketArea');
    if (!container) return;

    const info = getTicketInfo();
    if (!info) {
      container.innerHTML = `
        <div class="card mb-3">
          <div class="card-body text-center empty-card">
            <i data-lucide="ticket" class="i-48 icon-muted"></i>
            <h3>No Active Ticket</h3>
            <p class="muted-text">Get a queue ticket for any school office to start.</p>
            <button class="btn btn-primary" data-action="App.navigate" data-args="get-ticket">
              <i data-lucide="plus" class="i-16"></i>
              Get Queue Ticket
            </button>
          </div>
        </div>`;
      if (window.lucide) lucide.createIcons({ nodes: [container] });
      return;
    }

    const { ticket, office, position, servingNum, wait } = info;
    container.innerHTML = `
      <div class="active-ticket-box mb-3">
        <div class="ticket-header">
          <h3>Your Active Ticket</h3>
          <span class="status ${ticket.status}">${cap(ticket.status)}</span>
        </div>
        <div class="ticket-card">
          <div class="ticket-sub">${office ? office.name : ticket.office}</div>
          <div class="ticket-number">#${ticket.number}</div>
          <div class="ticket-service">${ticket.service}</div>
          <div class="ticket-meta">
            <div class="ticket-meta-item">
              <span class="ticket-meta-label">Now Serving</span>
              <span class="ticket-meta-value">#${servingNum}</span>
            </div>
            <div class="ticket-meta-item">
              <span class="ticket-meta-label">Students Ahead</span>
              <span class="ticket-meta-value">${ticket.status === 'serving' ? 0 : position}</span>
            </div>
            <div class="ticket-meta-item">
              <span class="ticket-meta-label">Est. Wait</span>
              <span class="ticket-meta-value">${ticket.status === 'serving' ? 'Now' : wait + ' min'}</span>
            </div>
          </div>
        </div>
        <div class="ticket-actions">${ticketActions(ticket)}</div>
      </div>`;
  }

  function renderOfficeOverview() {
    const el = document.getElementById('officeOverview');
    if (!el) return;
    el.innerHTML = QueueManager.getOffices().map(o => `
      <div class="overview-row">
        <div class="overview-icon"><i data-lucide="${o.icon}" class="i-18"></i></div>
        <div class="overview-info">
          <strong>${o.name}</strong>
          <span>${o.services.length} services</span>
        </div>
        <span class="overview-count">${QueueManager.getWaitingCount(o.id)} waiting</span>
      </div>`).join('');
    if (window.lucide) lucide.createIcons({ nodes: [el] });
  }

  function renderRecentActivity() {
    const el = document.getElementById('recentActivity');
    if (!el) return;
    const user = Auth.getCurrentUser();
    const rows = QueueManager.getStudentHistory(user.id).slice(0, 4);
    const office = id => (QueueManager.getOffice(id) || {}).name || id;

    el.innerHTML = rows.length === 0
      ? '<p class="muted-text pad">No activity yet. Get a ticket to join a queue.</p>'
      : rows.map(r => `
        <div class="activity-row">
          <div class="activity-icon"><i data-lucide="ticket" class="i-16"></i></div>
          <div class="activity-body">
            <div class="activity-title">#${r.number} · ${r.service}</div>
            <div class="activity-sub">${office(r.office)} · ${new Date(r.endedAt).toLocaleString()}</div>
          </div>
          <span class="status ${r.status}">${r.status}</span>
        </div>`).join('');
    if (window.lucide) lucide.createIcons({ nodes: [el] });
  }

  //Office selection and ticket creation

  function renderOffices() {
    const el = document.getElementById('officesList');
    if (!el) return;
    el.innerHTML = QueueManager.getOffices().map(o => `
      <div class="card office-detail">
        <div class="card-body">
          <div class="office-detail-head">
            <div class="overview-icon"><i data-lucide="${o.icon}" class="i-20"></i></div>
            <div>
              <h4>${o.name}</h4>
              <p class="muted-text">${QueueManager.getWaitingCount(o.id)} waiting</p>
            </div>
          </div>
          <ul class="service-bullets">${o.services.map(s => `<li>${s}</li>`).join('')}</ul>
          <button class="btn btn-sm btn-primary" data-action="StudentModule.quickSelect" data-args="${o.id}">Get ticket</button>
        </div>
      </div>`).join('');
    if (window.lucide) lucide.createIcons({ nodes: [el] });
  }

  function quickSelect(officeId) {
    App.navigate('get-ticket');
    selectOffice(officeId);
  }

  // Get ticket

  function renderGetTicket() {
    selectedOffice = null;
    selectedService = null;

    const officeGrid = document.getElementById('officeGrid');
    if (!officeGrid) return;

    officeGrid.innerHTML = QueueManager.getOffices().map(o => `
      <div class="office-card" data-office="${o.id}" data-action="StudentModule.selectOffice" data-args="${o.id}">
        <i data-lucide="${o.icon}" class="i-28"></i>
        <h4>${o.name}</h4>
        <p>${QueueManager.getWaitingCount(o.id)} waiting</p>
      </div>`).join('');
    if (window.lucide) lucide.createIcons({ nodes: [officeGrid] });

    const serviceArea = document.getElementById('serviceArea');
    if (serviceArea) serviceArea.innerHTML = '<p class="muted-text">Select an office first</p>';

    const submitBtn = document.getElementById('submitTicketBtn');
    if (submitBtn) submitBtn.disabled = true;
  }

  function selectOffice(officeId) {
    selectedOffice = officeId;
    selectedService = null;

    document.querySelectorAll('.office-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.office === officeId);
    });

    const office = QueueManager.getOffice(officeId);
    const serviceArea = document.getElementById('serviceArea');
    if (!serviceArea || !office) return;

    serviceArea.innerHTML = `
      <div class="service-list">
        ${office.services.map(s => `
          <div class="service-item" data-service="${s}" data-action="StudentModule.selectService" data-args="${s}">
            <div class="radio"></div>
            <div class="service-info">
              <h4>${s}</h4>
              <p>Estimated 5–10 minutes</p>
            </div>
          </div>`).join('')}
      </div>`;

    const submitBtn = document.getElementById('submitTicketBtn');
    if (submitBtn) submitBtn.disabled = true;
  }

  function selectService(service) {
    selectedService = service;
    document.querySelectorAll('.service-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.service === service);
    });
    const submitBtn = document.getElementById('submitTicketBtn');
    if (submitBtn) submitBtn.disabled = false;
  }

  
async function submitTicket() {

    if (!selectedOffice || !selectedService) {
        Notifications.showToast(
            'Missing selection',
            'Please select an office and service.',
            'warning'
        );
        return;
    }

    const user = Auth.getCurrentUser();
    const button = document.getElementById('submitTicketBtn');

    if (button) button.disabled = true;

    try {
      
        const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                studentId: user.id,
                studentName: user.name,
                office: selectedOffice,
                service: selectedService
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            Notifications.showToast(
                'Cannot create ticket',
                result.message,
                'danger'
            );
            return;
        }

        Notifications.showToast(
            'Ticket created!',
            `Your number is #${result.ticket.number}`,
            'success'
        );

        showTicketModal(
            result.ticket,
            result.position,
            result.estimatedWait
        );

    } catch (error) {

        console.error(error);

        Notifications.showToast(
            'Connection error',
            'Cannot connect to the server.',
            'danger'
        );

    } finally {
        if (button) button.disabled = false;
    }
}

  function showTicketModal(ticket, position, wait) {
    const office = QueueManager.getOffice(ticket.office);
    const overlay = document.getElementById('ticketModal');
    if (!overlay) return;

    document.getElementById('modalTicketNumber').textContent = `#${ticket.number}`;
    document.getElementById('modalOffice').textContent = office ? office.name : ticket.office;
    document.getElementById('modalService').textContent = ticket.service;
    document.getElementById('modalPosition').textContent = position;
    document.getElementById('modalWait').textContent = `${wait} min`;
    overlay.classList.add('show');
  }

  function closeTicketModal() {
    const overlay = document.getElementById('ticketModal');
    if (overlay) overlay.classList.remove('show');
    App.navigate('my-queue');
  }

  function renderMyQueue() {
    const container = document.getElementById('myQueueContent');
    if (!container) return;

    const info = getTicketInfo();
    if (!info) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="inbox" class="i-48"></i>
          <h3>No active queue</h3>
          <p>You don't have an active ticket. Get one to join a queue.</p>
          <button class="btn btn-primary mt-2" data-action="App.navigate" data-args="get-ticket">Get Queue Ticket</button>
        </div>`;
      if (window.lucide) lucide.createIcons({ nodes: [container] });
      return;
    }

    const { ticket, office, position, servingNum, wait } = info;
    const totalWaiting = QueueManager.getWaitingCount(ticket.office);
    const progress = ticket.status === 'serving'
      ? 100
      : totalWaiting > 0 ? Math.max(0, 100 - (position / (totalWaiting + 1)) * 100) : 100;
    const note = ticket.status === 'serving'
      ? 'Please proceed to the counter.'
      : position === 0 ? 'You are next! Please stay nearby.'
      : `${position} student(s) ahead of you.`;

    container.innerHTML = `
      <div class="ticket-card mb-3">
        <div class="ticket-top">
          <div class="ticket-sub">${office ? office.name : ticket.office}</div>
          <span class="status ${ticket.status} on-dark">${ticket.status}</span>
        </div>
        <div class="ticket-number">#${ticket.number}</div>
        <div class="ticket-service">${ticket.service}</div>
        <div class="ticket-meta">
          <div class="ticket-meta-item">
            <span class="ticket-meta-label">Now Serving</span>
            <span class="ticket-meta-value">#${servingNum}</span>
          </div>
          <div class="ticket-meta-item">
            <span class="ticket-meta-label">Your Position</span>
            <span class="ticket-meta-value">${ticket.status === 'serving' ? 'Serving now' : position + 1}</span>
          </div>
          <div class="ticket-meta-item">
            <span class="ticket-meta-label">Est. Wait</span>
            <span class="ticket-meta-value">${ticket.status === 'serving' ? 'Now' : wait + ' min'}</span>
          </div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="progress-head">
            <span>Queue Progress</span>
            <span class="muted-text">${Math.round(progress)}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" data-progress="${Math.round(progress)}"></div></div>
          <p class="progress-note">${note}</p>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><h3 class="card-title">Ticket Details</h3></div>
        <div class="card-body">
          <div class="settings-row"><div class="label">Ticket Number</div><div class="text-strong">#${ticket.number}</div></div>
          <div class="settings-row"><div class="label">Office</div><div>${office ? office.name : ticket.office}</div></div>
          <div class="settings-row"><div class="label">Service</div><div>${ticket.service}</div></div>
          <div class="settings-row"><div class="label">Status</div><div><span class="status ${ticket.status}">${ticket.status}</span></div></div>
          <div class="settings-row"><div class="label">Issued At</div><div>${new Date(ticket.createdAt).toLocaleString()}</div></div>
        </div>
      </div>
      <div class="ticket-actions">${ticketActions(ticket)}</div>`;

    const fill = container.querySelector('.progress-fill');
    if (fill) fill.style.width = fill.dataset.progress + '%';
  }

  
  async function cancelTicket(ticketId) {

      if (!confirm('Cancel your queue ticket? You will lose your place in line.')) return;

      try {

          const response = await fetch(`/api/tickets/${ticketId}/status`, {
              method: 'PATCH',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  status: 'cancelled'
              })
          });

          const result = await response.json();

          if (!response.ok || result.success === false) {
              Notifications.showToast(
                  'Cannot cancel',
                  result.message || 'Cancellation failed',
                  'danger'
              );
              return;
          }

          Notifications.showToast(
              'Ticket canceled',
              'Your queue ticket was successfully canceled.',
              'warning'
          );

          lastStatus = null;
          refresh();

      } catch (error) {

          console.error(error);

          Notifications.showToast(
              'Error',
              'Cannot connect to the server.',
              'danger'
          );
      }
  }


  function renderHistory() {
    const body = document.getElementById('studentHistoryBody');
    if (!body) return;
    const user = Auth.getCurrentUser();
    const rows = QueueManager.getStudentHistory(user.id);
    const office = id => (QueueManager.getOffice(id) || {}).name || id;

    body.innerHTML = rows.length === 0
      ? '<tr><td colspan="6" class="empty-cell">No previous transactions yet</td></tr>'
      : rows.map(r => `
        <tr>
          <td>${new Date(r.endedAt).toLocaleString()}</td>
          <td><strong>#${r.number}</strong></td>
          <td>${office(r.office)}</td>
          <td>${r.service}</td>
          <td><span class="status ${r.status}">${r.status}</span></td>
          <td>${QueueManager.formatDuration(r.waitMs)}</td>
        </tr>`).join('');
  }

  function refresh() {
    const page = App.currentPage;
    if (page === 'dashboard') renderDashboard();
    if (page === 'my-queue') renderMyQueue();
    if (page === 'my-history') renderHistory();
    if (page === 'offices') renderOffices();
    if (page === 'get-ticket') {
      document.querySelectorAll('.office-card').forEach(c => {
        const p = c.querySelector('p');
        if (p) p.textContent = `${QueueManager.getWaitingCount(c.dataset.office)} waiting`;
      });
    }
    checkQueueUpdates();
  }

  function checkQueueUpdates() {
    const user = Auth.getCurrentUser();
    if (!user || user.role !== 'student') return;

    const ticket = QueueManager.getStudentTicket(user.id);
    if (!ticket) { lastStatus = null; return; }

    if (ticket.status === 'serving' && lastStatus === 'waiting') {
      const office = QueueManager.getOffice(ticket.office);
      Notifications.notifyCalled(ticket.number, office ? office.name : ticket.office);
    } else if (ticket.status === 'waiting' && QueueManager.getQueuePosition(ticket) === 2 && almostNotified !== ticket.id) {
      almostNotified = ticket.id;
      Notifications.notifyAlmost(ticket.number);
    }
    lastStatus = ticket.status;
  }

  return {
    renderDashboard,
    renderOffices,
    quickSelect,
    renderGetTicket,
    selectOffice,
    selectService,
    submitTicket,
    closeTicketModal,
    renderMyQueue,
    cancelTicket,
    renderHistory,
    refresh,
    checkQueueUpdates
  };
})();
