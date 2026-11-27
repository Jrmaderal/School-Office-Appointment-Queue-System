const QueueManager = (function () {
  const STORAGE_KEY = 'school_queue_data';
  const HISTORY_KEY = 'school_queue_history';
  const COUNTERS_KEY = 'school_queue_counters';
  const LOG_KEY = 'school_queue_log';

  const OFFICES = [
    { id: 'registrar', name: 'Registrar', icon: 'file-text', services: ['Transcript Request', 'Enrollment Verification', 'Grade Change', 'Document Release'] },
    { id: 'cashier', name: 'Cashier', icon: 'dollar-sign', services: ['Tuition Payment', 'Fee Payment', 'Refund Request', 'Payment Verification'] },
    { id: 'guidance', name: 'Guidance Office', icon: 'heart', services: ['Counseling Session', 'Career Advice', 'Mental Health Support', 'Scholarship Inquiry'] },
    { id: 'admission', name: 'Admission Office', icon: 'user-plus', services: ['New Student Application', 'Transfer Application', 'Re-admission', 'Document Submission'] }
  ];

  function getDefaultData() {
    return {
      queues: {
        registrar: [],
        cashier: [],
        guidance: [],
        admission: []
      },
      currentlyServing: {
        registrar: null,
        cashier: null,
        guidance: null,
        admission: null
      },
      servedToday: {
        registrar: 0,
        cashier: 0,
        guidance: 0,
        admission: 0
      },
      studentTickets: {} 
    };
  }

  function getData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const data = getDefaultData();
        saveData(data);
        return data;
      }
      const data = JSON.parse(raw);
      data.queues = data.queues || {};
      data.currentlyServing = data.currentlyServing || {};
      data.servedToday = data.servedToday || {};
      data.studentTickets = data.studentTickets || {};

      ['library', 'clinic'].forEach(id => {
        delete data.queues[id];
        delete data.currentlyServing[id];
        delete data.servedToday[id];
        Object.keys(data.studentTickets).forEach(studentId => {
          if (data.studentTickets[studentId].office === id) {
            delete data.studentTickets[studentId];
          }
        });
      });
      saveData(data);
      return data;
    } catch (e) {
      console.error('Error loading queue data', e);
      return getDefaultData();
    }
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

async function syncFromServer() {

    const response = await fetch('/api/tickets');

    if (!response.ok) {
        throw new Error('Cannot load queue records');
    }

    const tickets = await response.json();
    const data = getDefaultData();

    tickets.forEach(ticket => {

        const office = ticket.office;

        if (!data.queues[office]) return;

        data.queues[office].push(ticket);

        if (['waiting', 'serving'].includes(ticket.status)) {

            data.studentTickets[ticket.studentId] = {
                ticketId: ticket.id,
                office: office,
                status: ticket.status
            };
        }

        if (ticket.status === 'serving') {
            data.currentlyServing[office] = ticket;
        }

        if (ticket.status === 'served') {
            data.servedToday[office]++;
        }
    });

    saveData(data);

    return data;
}

  function getCounters() {
    try {
      const raw = localStorage.getItem(COUNTERS_KEY);
      if (!raw) {
        const counters = { registrar: 0, cashier: 0, guidance: 0, admission: 0 };
        localStorage.setItem(COUNTERS_KEY, JSON.stringify(counters));
        return counters;
      }
      const counters = JSON.parse(raw);
      delete counters.library;
      delete counters.clinic;
      localStorage.setItem(COUNTERS_KEY, JSON.stringify(counters));
      return counters;
    } catch (e) {
      return { registrar: 0, cashier: 0, guidance: 0, admission: 0 };
    }
  }

  function saveCounters(counters) {
    localStorage.setItem(COUNTERS_KEY, JSON.stringify(counters));
  }

  function nextNumber(officeId) {
    const counters = getCounters();
    counters[officeId] = (counters[officeId] || 0) + 1;
    saveCounters(counters);
    return String(counters[officeId]).padStart(3, '0');
  }

  function getOffices() {
    return OFFICES;
  }

  function getOffice(id) {
    return OFFICES.find(o => o.id === id);
  }

  function createTicket(studentId, studentName, officeId, service) {
    const data = getData();

    // Prevent multiple active tickets for same office
    const existing = data.studentTickets[studentId];
    if (existing && existing.office === officeId && ['waiting', 'serving'].includes(existing.status)) {
      return { success: false, message: 'You already have an active ticket for this office.' };
    }

    const number = nextNumber(officeId);
    const position = data.queues[officeId].filter(t => t.status === 'waiting').length + 1;
    const estimatedWait = position * 5; // 5 min avg per person

    const ticket = {
      id: `t-${officeId}-${number}-${Date.now()}`,
      number,
      studentName,
      studentId,
      office: officeId,
      service,
      status: 'waiting',
      createdAt: new Date().toISOString(),
      estimatedWait
    };

    data.queues[officeId].push(ticket);
    data.studentTickets[studentId] = {
      ticketId: ticket.id,
      office: officeId,
      number,
      status: 'waiting'
    };
    saveData(data);

    return { success: true, ticket, position, estimatedWait };
  }

  function getStudentTicket(studentId) {
    const data = getData();
    const ref = data.studentTickets[studentId];
    if (!ref) return null;

    const queue = data.queues[ref.office] || [];
    const ticket = queue.find(t => t.id === ref.ticketId);
    if (!ticket || !['waiting', 'serving'].includes(ticket.status)) {
      delete data.studentTickets[studentId];
      saveData(data);
      return null;
    }
    return ticket;
  }

  function getQueuePosition(ticket) {
    if (!ticket || ticket.status !== 'waiting') return 0;
    const data = getData();
    const waiting = data.queues[ticket.office].filter(t => t.status === 'waiting');
    const idx = waiting.findIndex(t => t.id === ticket.id);
    return idx >= 0 ? idx : 0;
  }

  function getCurrentlyServing(officeId) {
    const data = getData();
    return data.currentlyServing[officeId];
  }

  function getWaitingCount(officeId) {
    const data = getData();
    return (data.queues[officeId] || []).filter(t => t.status === 'waiting').length;
  }

  function getQueueForOffice(officeId) {
    const data = getData();
    return data.queues[officeId] || [];
  }

  function callNext(officeId, ticketId) {
    const data = getData();
    const queue = data.queues[officeId];
    const next = ticketId
      ? queue.find(t => t.id === ticketId && t.status === 'waiting')
      : queue.find(t => t.status === 'waiting');
    if (!next) return { success: false, message: 'No students waiting.' };
    let prevServed = null;

    // Mark previous serving as served if still serving
    if (data.currentlyServing[officeId]) {
      const prev = queue.find(t => t.id === data.currentlyServing[officeId].id);
      if (prev && prev.status === 'serving') {
        prev.status = 'served';
        prev.servedAt = new Date().toISOString();
        data.servedToday[officeId] = (data.servedToday[officeId] || 0) + 1;
        if (data.studentTickets[prev.studentId]) delete data.studentTickets[prev.studentId];
        prevServed = prev;
      }
    }

    next.status = 'serving';
    next.calledAt = new Date().toISOString();
    data.currentlyServing[officeId] = { id: next.id, number: next.number, studentName: next.studentName };

    if (data.studentTickets[next.studentId]) {
      data.studentTickets[next.studentId].status = 'serving';
    }

    saveData(data);
    if (prevServed) addToHistory(prevServed, 'served');
    return { success: true, ticket: next };
  }

  function serveTicket(officeId, ticketId) {
    const data = getData();
    const ticket = data.queues[officeId].find(t => t.id === ticketId);
    if (!ticket) return { success: false, message: 'Ticket not found.' };

    ticket.status = 'served';
    ticket.servedAt = new Date().toISOString();
    data.servedToday[officeId] = (data.servedToday[officeId] || 0) + 1;

    if (data.currentlyServing[officeId] && data.currentlyServing[officeId].id === ticketId) {
      data.currentlyServing[officeId] = null;
    }

    if (data.studentTickets[ticket.studentId]) {
      delete data.studentTickets[ticket.studentId];
    }

    saveData(data);
    addToHistory(ticket, 'served');
    return { success: true, ticket };
  }

  function skipTicket(officeId, ticketId) {
    const data = getData();
    const ticket = data.queues[officeId].find(t => t.id === ticketId);
    if (!ticket) return { success: false, message: 'Ticket not found.' };

    ticket.status = 'skipped';
    ticket.skippedAt = new Date().toISOString();

    if (data.currentlyServing[officeId] && data.currentlyServing[officeId].id === ticketId) {
      data.currentlyServing[officeId] = null;
    }

    if (data.studentTickets[ticket.studentId]) {
      delete data.studentTickets[ticket.studentId];
    }

    saveData(data);
    addToHistory(ticket, 'skipped');
    return { success: true, ticket };
  }

  /** Student cancels their own waiting ticket */
  function cancelTicket(studentId, ticketId) {
    const data = getData();
    const ref = data.studentTickets[studentId];
    if (!ref || ref.ticketId !== ticketId) return { success: false, message: 'Ticket not found.' };
    const ticket = (data.queues[ref.office] || []).find(t => t.id === ticketId);
    if (!ticket) return { success: false, message: 'Ticket not found.' };
    if (ticket.status !== 'waiting') {
      return { success: false, message: 'This ticket is already being served and can no longer be canceled.' };
    }
    ticket.status = 'canceled';
    ticket.canceledAt = new Date().toISOString();
    delete data.studentTickets[studentId];
    saveData(data);
    addToHistory(ticket, 'canceled');
    return { success: true, ticket };
  }

  function getStudentHistory(studentId) {
    return getLog()
      .filter(l => l.studentId === studentId)
      .sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  }

  function transferTicket(officeId, ticketId, targetOfficeId) {
    const data = getData();
    const ticket = data.queues[officeId].find(t => t.id === ticketId);
    if (!ticket) return { success: false, message: 'Ticket not found.' };
    if (officeId === targetOfficeId) return { success: false, message: 'Same office selected.' };

    // Remove from current
    data.queues[officeId] = data.queues[officeId].filter(t => t.id !== ticketId);

    if (data.currentlyServing[officeId] && data.currentlyServing[officeId].id === ticketId) {
      data.currentlyServing[officeId] = null;
    }

    // Create new number in target
    const newNumber = nextNumber(targetOfficeId);
    const newTicket = {
      ...ticket,
      id: `t-${targetOfficeId}-${newNumber}-${Date.now()}`,
      number: newNumber,
      office: targetOfficeId,
      status: 'waiting',
      transferredFrom: officeId,
      transferredAt: new Date().toISOString(),
      estimatedWait: (data.queues[targetOfficeId].filter(t => t.status === 'waiting').length + 1) * 5
    };

    data.queues[targetOfficeId].push(newTicket);

    if (data.studentTickets[ticket.studentId]) {
      data.studentTickets[ticket.studentId] = {
        ticketId: newTicket.id,
        office: targetOfficeId,
        number: newNumber,
        status: 'waiting'
      };
    }

    saveData(data);
    return { success: true, ticket: newTicket };
  }

  function getStats() {
    const data = getData();
    let totalWaiting = 0;
    let totalServing = 0;
    let totalServed = 0;

    Object.keys(data.queues).forEach(officeId => {
      totalWaiting += data.queues[officeId].filter(t => t.status === 'waiting').length;
      if (data.currentlyServing[officeId]) totalServing++;
      totalServed += data.servedToday[officeId] || 0;
    });

    return {
      totalWaiting,
      totalServing,
      totalServed,
      avgWait: totalWaiting > 0 ? Math.round((totalWaiting * 5) / Object.keys(data.queues).length) : 0
    };
  }

  function getOfficeStats(officeId) {
    const data = getData();
    const queue = data.queues[officeId] || [];
    return {
      waiting: queue.filter(t => t.status === 'waiting').length,
      serving: data.currentlyServing[officeId] ? 1 : 0,
      served: data.servedToday[officeId] || 0,
      total: queue.length
    };
  }

  // ---------- History & Log ----------
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function pad(n) { return String(n).padStart(2, '0'); }

  function dateKey(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatDate(d) {
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
  }

  function formatDuration(ms) {
    if (!ms || ms < 0) return '0 min';
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec} sec`;
    const mins = Math.round(totalSec / 60);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  /** Per-ticket outcome log (used by Reports & Analytics) */
  function getLog() {
    return readJSON(LOG_KEY, []);
  }

  /** Daily summaries (used by Queue History) */
  function getHistory() {
    const list = readJSON(HISTORY_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function addToHistory(ticket, action) {
    if (!ticket) return;
    const now = new Date();
    const endedAt = now.toISOString();
    const created = ticket.createdAt ? new Date(ticket.createdAt) : now;
    const called = ticket.calledAt ? new Date(ticket.calledAt) : null;
    const waitMs = called ? Math.max(0, called - created) : Math.max(0, now - created);
    const serviceMs = (action === 'served' && called) ? Math.max(0, now - called) : 0;

    // 1) per-ticket log
    const log = getLog();
    log.push({
      id: ticket.id,
      number: ticket.number,
      studentName: ticket.studentName,
      studentId: ticket.studentId,
      office: ticket.office,
      service: ticket.service,
      status: action,
      createdAt: ticket.createdAt || endedAt,
      calledAt: ticket.calledAt || null,
      endedAt,
      waitMs,
      serviceMs
    });
    localStorage.setItem(LOG_KEY, JSON.stringify(log));

    // 2) daily summary
    const key = dateKey(now);
    const history = getHistory();
    let day = history.find(h => h.key === key);
    if (!day) {
      day = {
        key,
        date: formatDate(now),
        day: DAY_NAMES[now.getDay()],
        totalVisits: 0,
        served: 0,
        skipped: 0,
        canceled: 0,
        totalServiceMs: 0,
        totalWaitMs: 0,
        firstAt: endedAt,
        lastAt: endedAt,
        byOffice: {}
      };
      history.push(day);
    }

    day.totalVisits += 1;
    if (action === 'served') day.served += 1;
    else if (action === 'skipped') day.skipped += 1;
    else if (action === 'canceled') day.canceled += 1;
    day.totalServiceMs += serviceMs;
    day.totalWaitMs += waitMs;
    day.lastAt = endedAt;
    day.byOffice[ticket.office] = day.byOffice[ticket.office] || { served: 0, skipped: 0, canceled: 0 };
    day.byOffice[ticket.office][action] = (day.byOffice[ticket.office][action] || 0) + 1;

    // Canceled visits = skipped (no-show) + canceled
    saveHistory(history);
  }

  /** History rows, newest first, with display-ready fields */
  function getHistoryRows() {
    return getHistory()
      .slice()
      .sort((a, b) => b.key.localeCompare(a.key))
      .map(h => {
        const served = h.served || 0;
        const avgMs = served > 0 ? h.totalServiceMs / served : 0;
        return {
          ...h,
          duration: served > 0 ? formatDuration(avgMs) : '—',
          canceledVisits: (h.skipped || 0) + (h.canceled || 0)
        };
      });
  }

  function exportHistoryCSV(rows) {
    const history = rows || getHistoryRows();
    const headers = ['Date', 'Day', 'Avg Duration', 'Total Visits', 'Served', 'Canceled Visits'];
    const rowsCsv = history.map(h => [h.date, h.day, h.duration, h.totalVisits, h.served || 0, h.canceledVisits]);
    const csv = [headers.join(','), ...rowsCsv.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `queue-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(LOG_KEY);
  }

  /** Real analytics computed from the log + live queues */
  function getAnalytics() {
    const log = getLog();
    const data = getData();
    const served = log.filter(l => l.status === 'served');
    const skipped = log.filter(l => l.status === 'skipped');
    const canceled = log.filter(l => l.status === 'canceled');

    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const avgWaitMs = avg(served.map(l => l.waitMs));
    const avgServiceMs = avg(served.map(l => l.serviceMs));
    const finished = served.length + skipped.length;
    const noShowRate = finished > 0 ? Math.round((skipped.length / finished) * 100) : 0;

    // Active tickets still in queues
    let waiting = 0;
    const activeTickets = [];
    Object.keys(data.queues).forEach(id => {
      (data.queues[id] || []).forEach(t => {
        if (t.status === 'waiting') waiting++;
        if (['waiting', 'serving'].includes(t.status)) activeTickets.push(t);
      });
    });

    // Served per office
    const perOffice = {};
    OFFICES.forEach(o => { perOffice[o.id] = 0; });
    served.forEach(l => { perOffice[l.office] = (perOffice[l.office] || 0) + 1; });

    // Ticket volume by hour (all tickets ever created: finished + active)
    const hours = new Array(24).fill(0);
    log.forEach(l => { hours[new Date(l.createdAt).getHours()]++; });
    activeTickets.forEach(t => { hours[new Date(t.createdAt).getHours()]++; });

    return {
      servedCount: served.length,
      skippedCount: skipped.length,
      canceledCount: canceled.length,
      waitingCount: waiting,
      avgWaitMs,
      avgServiceMs,
      noShowRate,
      perOffice,
      hours,
      hasData: log.length > 0 || activeTickets.length > 0
    };
  }

  function resetDemoData() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(COUNTERS_KEY);
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(LOG_KEY);
    localStorage.removeItem('school_queue_notifications');
    return getData();
  }

  return {
    syncFromServer,
    getOffices,
    getOffice,
    createTicket,
    getStudentTicket,
    getQueuePosition,
    getCurrentlyServing,
    getWaitingCount,
    getQueueForOffice,
    callNext,
    serveTicket,
    skipTicket,
    transferTicket,
    cancelTicket,
    getStudentHistory,
    getStats,
    getOfficeStats,
    getHistory,
    getHistoryRows,
    getLog,
    getAnalytics,
    formatDuration,
    clearHistory,
    exportHistoryCSV,
    resetDemoData,
    getData
  };
})();