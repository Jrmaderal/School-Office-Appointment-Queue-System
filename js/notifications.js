const Notifications = (function () {
  const STORAGE_KEY = 'school_queue_notifications';
  let toastContainer = null;

  function ensureContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function showToast(title, message, type = 'info', duration = 4000) {
    const container = ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
      info: 'info',
      success: 'check-circle',
      warning: 'alert-triangle',
      danger: 'x-circle'
    };

    toast.innerHTML = `
      <div class="toast-icon">
        <i data-lucide="${icons[type] || 'info'}" class="i-20"></i>
      </div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" aria-label="Close">
        <i data-lucide="x" class="i-16"></i>
      </button>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons({ nodes: [toast] });

    const close = () => {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 250);
    };

    toast.querySelector('.toast-close').addEventListener('click', close);
    if (duration > 0) setTimeout(close, duration);

    // Also save to notification list
    addNotification(title, message, type);
  }

  function getNotifications() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveNotifications(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
  }

  function addNotification(title, message, type = 'info') {
    const list = getNotifications();
    list.unshift({
      id: Date.now(),
      title,
      message,
      type,
      read: false,
      time: new Date().toISOString()
    });
    saveNotifications(list);
    updateBadge();
    renderPanel();
  }

  function markAllRead() {
    const list = getNotifications().map(n => ({ ...n, read: true }));
    saveNotifications(list);
    updateBadge();
    renderPanel();
  }

  function deleteNotification(id) {
    const list = getNotifications().filter(n => String(n.id) !== String(id));
    saveNotifications(list);
    updateBadge();
    renderPanel();
  }

  function clearNotifications() {
    saveNotifications([]);
    updateBadge();
    renderPanel();
  }

  function updateBadge() {
    const unread = getNotifications().filter(n => !n.read).length;
    const badge = document.getElementById('notifBadge');
    if (badge) {
      if (unread > 0) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  function renderPanel() {
    const listEl = document.getElementById('notificationList');
    if (!listEl) return;

    const list = getNotifications();
    if (list.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state compact">
          <i data-lucide="bell-off" class="i-32 icon-muted"></i>
          <p class="empty-note">No notifications yet</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons({ nodes: [listEl] });
      return;
    }

    listEl.innerHTML = list.map(n => {
      const iconMap = { info: 'blue', success: 'green', warning: 'orange', danger: 'red' };
      const iconName = { info: 'info', success: 'check-circle', warning: 'alert-triangle', danger: 'x-circle' };
      const timeAgo = formatTimeAgo(n.time);
      return `
        <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
          <div class="notification-icon ${iconMap[n.type] || 'blue'}">
            <i data-lucide="${iconName[n.type] || 'info'}" class="i-16"></i>
          </div>
          <div class="notification-text">
            <p><strong>${n.title}</strong> — ${n.message}</p>
            <div class="notification-time">${timeAgo}</div>
          </div>
          <button class="notification-delete" type="button" data-delete-id="${n.id}" aria-label="Delete notification">
            <i data-lucide="trash-2" class="i-16"></i>
          </button>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-delete-id]').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNotification(button.dataset.deleteId);
      });
    });

    if (window.lucide) lucide.createIcons({ nodes: [listEl] });
  }

  function formatTimeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // Queue-specific helpers
  function notifyCalled(number, office) {
    showToast('Your number is called!', `Ticket #${number} — please proceed to ${office}.`, 'success', 6000);
  }

  function notifyAlmost(number) {
    showToast('Almost your turn', `Ticket #${number} — only 2 students ahead.`, 'warning', 5000);
  }

  function notifyServed(number) {
    showToast('Ticket served', `Ticket #${number} has been completed.`, 'success');
  }

  function notifySkipped(number) {
    showToast('Ticket skipped', `Ticket #${number} was skipped. Please get a new ticket if needed.`, 'danger');
  }

  function notifyTransferred(number, office) {
    showToast('Ticket transferred', `Ticket #${number} moved to ${office}.`, 'info');
  }

  function init() {
    updateBadge();
    renderPanel();

    const notifBtn = document.getElementById('notifBtn');
    const panel = document.getElementById('notificationPanel');
    if (notifBtn && panel) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('show');
        markAllRead();
      });
      document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && !notifBtn.contains(e.target)) {
          panel.classList.remove('show');
        }
      });
    }

    const markReadBtn = document.getElementById('markAllRead');
    if (markReadBtn) {
      markReadBtn.addEventListener('click', markAllRead);
    }

    const clearBtn = document.getElementById('clearNotifications');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearNotifications();
      });
    }
  }

  return {
    showToast,
    notifyCalled,
    notifyAlmost,
    notifyServed,
    notifySkipped,
    notifyTransferred,
    updateBadge,
    renderPanel,
    deleteNotification,
    clearNotifications,
    init
  };
})();