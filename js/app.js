const App = (function () {
  const PAGES = {
    staff: {
      dashboard: 'Dashboard',
      'queue-management': 'Queue Management',
      'now-serving': 'Now Serving',
      'queue-history': 'Queue History',
      reports: 'Reports & Analytics',
      settings: 'Settings',
      help: 'Help & Support'
    },
    student: {
      dashboard: 'Dashboard',
      offices: 'Offices & Services',
      'get-ticket': 'Get Queue Ticket',
      'my-queue': 'My Queue',
      'my-history': 'My History',
      settings: 'Settings',
      help: 'Help & Support'
    }
  };

  const STORAGE_PREFIX = 'school_queue_';
  let role = null;
  let user = null;
  let currentPage = 'dashboard';
  let initialized = false;


  function getModule(name) {
    switch (name) {
      case 'App': return App;
      case 'Auth': return Auth;
      case 'QueueManager': return typeof QueueManager !== 'undefined' ? QueueManager : null;
      case 'StaffModule': return typeof StaffModule !== 'undefined' ? StaffModule : null;
      case 'StudentModule': return typeof StudentModule !== 'undefined' ? StudentModule : null;
      case 'HistoryModule': return typeof HistoryModule !== 'undefined' ? HistoryModule : null;
      case 'ReportsModule': return typeof ReportsModule !== 'undefined' ? ReportsModule : null;
      default: return null;
    }
  }

  function runAction(el, path, e) {
    const [modName, fnName] = (path || '').split('.');
    const mod = getModule(modName);
    if (!mod || typeof mod[fnName] !== 'function') return;
    const args = el.dataset.args !== undefined
      ? el.dataset.args.split('|').map(a => (/^-?\d+$/.test(a) ? Number(a) : a))
      : [];
    mod[fnName](...args, el, e);
  }

  function bindActions() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || el.disabled) return;
      if (el.tagName === 'A') e.preventDefault();
      runAction(el, el.dataset.action, e);
    });

    ['input', 'change'].forEach(type => {
      document.addEventListener(type, (e) => {
        const el = e.target.closest('[data-input-action]');
        if (el) runAction(el, el.dataset.inputAction, e);
      });
    });
  }


  function greeting() {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  }

  function setWelcome() {
    const el = document.getElementById('welcomeMessage');
    if (!el || !user) return;
    let text = `${greeting()}, ${user.name}!`;
    if (role === 'staff') {
      const office = user.office && QueueManager.getOffice(user.office);
      text += ` Staff ID ${user.id}${office ? ' · ' + office.name : ''}`;
    } else {
      text += ` Student ID ${user.id}`;
    }
    el.textContent = text;
  }

  function fillProfile() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('profileName', user.name);
    set('profileId', user.id);
    set('profileEmail', user.email);
    set('profileRole', role === 'staff' ? 'Staff' : 'Student');
  }

  function toggleSwitch(el) {
    el.classList.toggle('active');
  }

  function resetData() {
    if (role !== 'staff') return;
    if (!confirm('Reset all queue data, history and reports?')) return;
    QueueManager.resetDemoData();
    Notifications.showToast('Reset', 'Queue data cleared.', 'success');
    navigate('dashboard');
  }

  function init() {
    if (initialized) return;
    role = document.body.dataset.role;
    if (!Auth.requireRole(role)) return;
    initialized = true;
    user = Auth.getCurrentUser();

    bindActions();

    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = role === 'staff' ? 'Staff' : 'Student';
    if (avatarEl) avatarEl.textContent = user.avatar || user.name.slice(0, 2).toUpperCase();
    fillProfile();

    // Sidebar toggle
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const closeMobile = () => {
      sidebar.classList.remove('mobile-open');
      if (overlay) overlay.classList.remove('show');
    };

    if (toggle && sidebar) {
      toggle.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.toggle('mobile-open');
          if (overlay) overlay.classList.toggle('show');
        } else {
          sidebar.classList.toggle('collapsed');
        }
      });
    }
    if (overlay) overlay.addEventListener('click', closeMobile);

    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.dataset.page);
        if (window.innerWidth <= 768) closeMobile();
      });
    });

    // User dropdown
    const userMenu = document.getElementById('userMenu');
    const userDropdown = document.getElementById('userDropdown');
    if (userMenu && userDropdown) {
      userMenu.addEventListener('click', (e) => {
        // let dropdown items (data-action) reach the delegated handler and close the menu
        if (e.target.closest('[data-action]')) return;
        e.stopPropagation();
        userDropdown.classList.toggle('show');
      });
      document.addEventListener('click', () => userDropdown.classList.remove('show'));
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => { e.preventDefault(); Auth.logout(); });
    }

    Notifications.init();

    navigate(window.location.hash.slice(1) || 'dashboard');

    window.addEventListener('hashchange', () => {
      const page = window.location.hash.slice(1);
      if (page && page !== currentPage) navigate(page);
    });

    // Live refresh: timer + changes made in another tab (e.g. staff acting on a student's ticket)
    setInterval(refresh, 8000);
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.indexOf(STORAGE_PREFIX) === 0) {
        refresh();
        Notifications.updateBadge();
        Notifications.renderPanel();
      }
    });

    if (window.lucide) lucide.createIcons();
  }

  function refresh() {
    if (role === 'staff') {
      if (currentPage === 'dashboard' || currentPage === 'queue-management') StaffModule.renderDashboard();
      if (currentPage === 'now-serving') StaffModule.renderNowServing();
      if (currentPage === 'queue-history') HistoryModule.render();
      if (currentPage === 'reports') ReportsModule.render();
    } else {
      StudentModule.refresh();
    }
    if (window.lucide) lucide.createIcons();
  }

  function navigate(page) {
    const pages = PAGES[role];
    if (!pages || !pages[page]) page = 'dashboard';

    currentPage = page;
    if (window.location.hash.slice(1) !== page) window.location.hash = page;

    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = pages[page];
    document.title = `${pages[page]} — School Queue (${role === 'staff' ? 'Staff' : 'Student'})`;

    document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
    const section = document.getElementById(`page-${page}`);
    if (section) section.classList.remove('hidden');

    if (page === 'dashboard') setWelcome();

    if (role === 'staff') {
      switch (page) {
        case 'dashboard':
        case 'queue-management': StaffModule.renderDashboard(); break;
        case 'now-serving': StaffModule.initOfficeSelect(); StaffModule.renderNowServing(); break;
        case 'queue-history': HistoryModule.render(); break;
        case 'reports': ReportsModule.render(); break;
      }
    } else {
      switch (page) {
        case 'dashboard': StudentModule.renderDashboard(); break;
        case 'offices': StudentModule.renderOffices(); break;
        case 'get-ticket': StudentModule.renderGetTicket(); break;
        case 'my-queue': StudentModule.renderMyQueue(); break;
        case 'my-history': StudentModule.renderHistory(); break;
      }
    }

    if (window.lucide) lucide.createIcons();
  }

  return {
    init,
    navigate,
    toggleSwitch,
    resetData,
    get currentPage() { return currentPage; }
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.role) App.init();
});
