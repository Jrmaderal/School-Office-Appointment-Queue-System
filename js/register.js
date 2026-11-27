document.addEventListener('DOMContentLoaded', () => {
  if (Auth.redirectIfAuthenticated()) return;

  const form = document.getElementById('registerForm');
  const passInput = document.getElementById('regPassword');

  AuthUI.bindPasswordToggles();

  // Live password requirement hint
  const hint = document.getElementById('passwordHint');
  passInput.addEventListener('input', () => {
    const ok = passInput.value.length >= 6;
    hint.classList.toggle('met', ok);
  });

  function validate() {
    AuthUI.clearFieldErrors(form);
    const v = id => document.getElementById(id).value.trim();
    let ok = true;
    const fail = (id, msg) => { AuthUI.setFieldError(id, msg); ok = false; };

    if (!v('regName')) fail('regName', 'Full name is required.');
    if (!v('regId')) fail('regId', 'ID is required.');
    else if (!/^[A-Za-z0-9-]{3,20}$/.test(v('regId'))) fail('regId', '3–20 letters, numbers or hyphens.');
    if (!v('regEmail')) fail('regEmail', 'Email is required.');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('regEmail'))) fail('regEmail', 'Enter a valid email address.');
    if (!v('regUsername')) fail('regUsername', 'Username is required.');
    else if (v('regUsername').length < 3) fail('regUsername', 'At least 3 characters.');
    if (!passInput.value) fail('regPassword', 'Password is required.');
    else if (passInput.value.length < 6) fail('regPassword', 'At least 6 characters.');
    if (!document.getElementById('regConfirm').value) fail('regConfirm', 'Please confirm your password.');
    else if (document.getElementById('regConfirm').value !== passInput.value) fail('regConfirm', 'Passwords do not match.');
    return ok;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    AuthUI.hideAlert();
    if (!validate()) {
      AuthUI.showAlert('Please fix the highlighted fields.', 'error');
      return;
    }

    const result = Auth.register({
      name: document.getElementById('regName').value,
      schoolId: document.getElementById('regId').value,
      username: document.getElementById('regUsername').value,
      email: document.getElementById('regEmail').value,
      password: passInput.value,
      confirmPassword: document.getElementById('regConfirm').value,
      role: 'student'
    });

    if (!result.success) {
      AuthUI.showAlert(result.message, 'error');
      return;
    }

    sessionStorage.setItem('school_queue_notice', 'Account created successfully. You can now sign in.');
    AuthUI.showAlert('Account created! Redirecting to sign in…', 'success');
    document.getElementById('registerSubmit').disabled = true;
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
  });

  if (window.lucide) lucide.createIcons();
});
