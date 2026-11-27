document.addEventListener('DOMContentLoaded', () => {
  if (Auth.redirectIfAuthenticated()) return;

  const step1 = document.getElementById('resetStep1');
  const step2 = document.getElementById('resetStep2');
  const requestForm = document.getElementById('resetRequestForm');
  const confirmForm = document.getElementById('resetConfirmForm');
  const codeBox = document.getElementById('resetCodeBox');
  let identifier = '';

  AuthUI.bindPasswordToggles();

  function showStep(n) {
    step1.classList.toggle('hidden', n !== 1);
    step2.classList.toggle('hidden', n !== 2);
    codeBox.classList.toggle('show', n === 2);
    AuthUI.hideAlert();
  }

  requestForm.addEventListener('submit', (e) => {
    e.preventDefault();
    AuthUI.hideAlert();
    AuthUI.clearFieldErrors(requestForm);

    const value = document.getElementById('resetIdentifier').value.trim();
    if (!value) {
      AuthUI.setFieldError('resetIdentifier', 'Enter your registered username or email.');
      return;
    }

    const result = Auth.requestPasswordReset(value);
    if (!result.success) {
      AuthUI.showAlert(result.message, 'error');
      return;
    }

    identifier = value;
    document.getElementById('resetCodeDisplay').textContent = result.demoCode;
    document.getElementById('resetCode').value = result.demoCode;
    showStep(2);
    AuthUI.showAlert(`Demo code generated for ${result.email}. No real email was sent.`, 'info');
  });

  confirmForm.addEventListener('submit', (e) => {
    e.preventDefault();
    AuthUI.hideAlert();
    AuthUI.clearFieldErrors(confirmForm);

    const code = document.getElementById('resetCode').value.trim();
    const pass = document.getElementById('resetNewPass').value;
    const confirm = document.getElementById('resetConfirmPass').value;
    let ok = true;
    const fail = (id, msg) => { AuthUI.setFieldError(id, msg); ok = false; };

    if (!/^\d{6}$/.test(code)) fail('resetCode', 'Enter the 6-digit code.');
    if (!pass) fail('resetNewPass', 'New password is required.');
    else if (pass.length < 6) fail('resetNewPass', 'At least 6 characters.');
    if (!confirm) fail('resetConfirmPass', 'Please confirm your new password.');
    else if (pass !== confirm) fail('resetConfirmPass', 'Passwords do not match.');
    if (!ok) return;

    const result = Auth.resetPassword(identifier, code, pass, confirm);
    if (!result.success) {
      AuthUI.showAlert(result.message, 'error');
      return;
    }

    sessionStorage.setItem('school_queue_notice', 'Password updated. You can now sign in with your new password.');
    AuthUI.showAlert('Password updated! Redirecting to sign in…', 'success');
    document.getElementById('resetSubmit').disabled = true;
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
  });

  document.getElementById('backToResetStep1').addEventListener('click', (e) => {
    e.preventDefault();
    showStep(1);
  });

  if (window.lucide) lucide.createIcons();
});
