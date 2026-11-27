const Auth = (function () {
  const SESSION_KEY = 'school_queue_user';
  const USERS_KEY = 'school_queue_users';
  const RESET_KEY = 'school_queue_reset_tokens';
  const REMEMBER_KEY = 'school_queue_remember_user';
  const HOME_PAGES = { staff: 'staff.html', student: 'student.html' };

  // Demo accounts (always available)
  const DEMO_ACCOUNTS = [
    {
      id: 'STU-1001',
      username: 'student',
      email: 'student@school.edu',
      password: 'student123',
      name: 'Alex Rivera',
      role: 'student',
      avatar: 'AR'
    },
    {
      id: 'STF-2001',
      username: 'staff',
      email: 'staff@school.edu',
      password: 'staff123',
      name: 'Dr. Morgan',
      role: 'staff',
      avatar: 'DM',
      office: 'registrar'
    }
  ];

  function ensureUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      if (!raw) {
        localStorage.setItem(USERS_KEY, JSON.stringify(DEMO_ACCOUNTS));
        return [...DEMO_ACCOUNTS];
      }
      const users = JSON.parse(raw);
      // Ensure demo accounts always exist
      DEMO_ACCOUNTS.forEach(demo => {
        const exists = users.some(u => u.username === demo.username || u.email === demo.email);
        if (!exists) users.push({ ...demo });
      });
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      return users;
    } catch (e) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEMO_ACCOUNTS));
      return [...DEMO_ACCOUNTS];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function findUser(identifier) {
    const users = ensureUsers();
    const id = (identifier || '').trim().toLowerCase();
    return users.find(
      u => u.username.toLowerCase() === id || u.email.toLowerCase() === id
    ) || null;
  }

  function makeAvatar(name) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  
  async function login(username, password, remember) {

      if (!username || !password) {
          return {
              success: false,
              message: 'Please enter username and password.'
          };
      }

      try {

          const response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  username: username,
                  password: password
              })
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
              return {
                  success: false,
                  message: result.message || 'Login failed.'
              };
          }

          const session = {
              ...result.user,
              loggedInAt: new Date().toISOString()
          };

          localStorage.setItem(
              SESSION_KEY,
              JSON.stringify(session)
          );

          if (remember) {
              localStorage.setItem(
                  REMEMBER_KEY,
                  session.username
              );
          } else {
              localStorage.removeItem(REMEMBER_KEY);
          }

          return {
              success: true,
              user: session,
              redirect: result.redirect
          };

      } catch (error) {

          console.error(error);

          return {
              success: false,
              message: 'Cannot connect to the server.'
          };
      }
  }


  function register({ name, schoolId, username, email, password, confirmPassword, role }) {
    schoolId = (schoolId || '').trim().toUpperCase();
    name = (name || '').trim();
    username = (username || '').trim();
    email = (email || '').trim().toLowerCase();
    if (role && role !== 'student') {
      return { success: false, message: 'Only student accounts can be created.' };
    }
    role = 'student';

    if (!name || !username || !email || !password) {
      return { success: false, message: 'Please fill in all required fields.' };
    }
    if (schoolId !== '' && !/^[A-Z0-9-]{3,20}$/.test(schoolId)) {
      return { success: false, message: 'ID must be 3–20 letters, numbers or hyphens.' };
    }
    if (username.length < 3) {
      return { success: false, message: 'Username must be at least 3 characters.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    if (password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }
    if (password !== confirmPassword) {
      return { success: false, message: 'Passwords do not match.' };
    }

    const users = ensureUsers();
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { success: false, message: 'Username is already taken.' };
    }
    if (users.some(u => u.email.toLowerCase() === email)) {
      return { success: false, message: 'Email is already registered.' };
    }

    if (schoolId && users.some(u => String(u.id).toUpperCase() === schoolId)) {
      return { success: false, message: 'That ID is already registered.' };
    }
    const prefix = 'STU';
    const id = schoolId || `${prefix}-${Date.now().toString().slice(-6)}`;

    const newUser = {
      id,
      username,
      email,
      password,
      name,
      role,
      avatar: makeAvatar(name),
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    return { success: true, message: 'Account created successfully. You can now sign in.', user: newUser };
  }

  // Step 1: Request password reset code
  function requestPasswordReset(identifier) {
    if (!identifier || !identifier.trim()) {
      return { success: false, message: 'Please enter your username or email.' };
    }

    const user = findUser(identifier);
    if (!user) {
      return { success: false, message: 'No account found with that username or email.' };
    }

    // Simulated reset code (frontend-only). In a real app this would be emailed.
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const tokens = JSON.parse(localStorage.getItem(RESET_KEY) || '{}');
    tokens[user.email] = {
      code,
      username: user.username,
      email: user.email,
      expires: Date.now() + 15 * 60 * 1000 // 15 minutes
    };
    localStorage.setItem(RESET_KEY, JSON.stringify(tokens));

    return {
      success: true,
      message: 'Reset code generated.',
      // Exposed only because this is a frontend demo (no email)
      demoCode: code,
      email: user.email,
      username: user.username
    };
  }

  // Step 2: Reset password using code
  function resetPassword(identifier, code, newPassword, confirmPassword) {
    if (!identifier || !code || !newPassword) {
      return { success: false, message: 'Please fill in all fields.' };
    }
    if (newPassword.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }
    if (newPassword !== confirmPassword) {
      return { success: false, message: 'Passwords do not match.' };
    }

    const user = findUser(identifier);
    if (!user) {
      return { success: false, message: 'Account not found.' };
    }

    const tokens = JSON.parse(localStorage.getItem(RESET_KEY) || '{}');
    const token = tokens[user.email];

    if (!token) {
      return { success: false, message: 'No reset request found. Please request a new code.' };
    }
    if (Date.now() > token.expires) {
      delete tokens[user.email];
      localStorage.setItem(RESET_KEY, JSON.stringify(tokens));
      return { success: false, message: 'Reset code has expired. Please request a new one.' };
    }
    if (String(token.code) !== String(code).trim()) {
      return { success: false, message: 'Invalid reset code.' };
    }

    const users = ensureUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx === -1) {
      return { success: false, message: 'Account not found.' };
    }

    users[idx].password = newPassword;
    saveUsers(users);

    delete tokens[user.email];
    localStorage.setItem(RESET_KEY, JSON.stringify(tokens));

    return { success: true, message: 'Password updated successfully. You can now sign in.' };
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
  }

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function isAuthenticated() {
    return !!getCurrentUser();
  }

  function requireAuth() {
    if (!isAuthenticated()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  function getHomePage(role) {
    return HOME_PAGES[role] || 'login.html';
  }

  
  function requireRole(role) {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return false;
    }
    if (user.role !== role) {
      window.location.href = getHomePage(user.role);
      return false;
    }
    return true;
  }


  function redirectIfAuthenticated() {
    const user = getCurrentUser();
    if (user) {
      window.location.href = getHomePage(user.role);
      return true;
    }
    return false;
  }

  function getRememberedUser() {
    return localStorage.getItem(REMEMBER_KEY) || '';
  }

  function isStaff() {
    const user = getCurrentUser();
    return user && user.role === 'staff';
  }

  function isStudent() {
    const user = getCurrentUser();
    return user && user.role === 'student';
  }

  // Initialize demo users on load
  ensureUsers();

  return {
    login,
    register,
    requestPasswordReset,
    resetPassword,
    logout,
    getCurrentUser,
    isAuthenticated,
    requireAuth,
    requireRole,
    redirectIfAuthenticated,
    getHomePage,
    getRememberedUser,
    isStaff,
    isStudent
  };
})();


const AuthUI = (function () {
  function showAlert(message, type) {
    const el = document.getElementById('authAlert');
    if (!el) return;
    el.textContent = message;
    el.className = 'auth-alert show ' + (type || 'info');
  }

  function hideAlert() {
    const el = document.getElementById('authAlert');
    if (!el) return;
    el.className = 'auth-alert';
    el.textContent = '';
  }

  function setFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    const msg = document.getElementById(inputId + 'Error');
    if (input) input.classList.toggle('invalid', !!message);
    if (msg) msg.textContent = message || '';
  }

  function clearFieldErrors(form) {
    form.querySelectorAll('.form-control').forEach(i => i.classList.remove('invalid'));
    form.querySelectorAll('.field-error').forEach(m => { m.textContent = ''; });
  }

  function bindPasswordToggles() {
    document.querySelectorAll('.toggle-password').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        btn.innerHTML = '<i data-lucide="' + (showing ? 'eye' : 'eye-off') + '" class="i-18"></i>';
        if (window.lucide) lucide.createIcons({ nodes: [btn] });
      });
    });
  }

  return { showAlert, hideAlert, setFieldError, clearFieldErrors, bindPasswordToggles };
})();
