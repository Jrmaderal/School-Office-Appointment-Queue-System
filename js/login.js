document.addEventListener('DOMContentLoaded', () => {
  if (Auth.redirectIfAuthenticated()) return;

  const form = document.getElementById('loginForm');
  const userInput = document.getElementById('loginUser');
  const passInput = document.getElementById('loginPass');
  const remember = document.getElementById('rememberMe');
  const submitBtn = document.getElementById('loginSubmit');

  AuthUI.bindPasswordToggles();

  const remembered = Auth.getRememberedUser();
  if (remembered) {
    userInput.value = remembered;
    remember.checked = true;
    passInput.focus();
  }

  // Show a message passed from another page (e.g. after registering or resetting)
  const notice = sessionStorage.getItem('school_queue_notice');
  if (notice) {
    AuthUI.showAlert(notice, 'success');
    sessionStorage.removeItem('school_queue_notice');
  }

  function validate() {
    let ok = true;
    AuthUI.clearFieldErrors(form);
    if (!userInput.value.trim()) {
      AuthUI.setFieldError('loginUser', 'Enter your username or email.');
      ok = false;
    }
    if (!passInput.value) {
      AuthUI.setFieldError('loginPass', 'Enter your password.');
      ok = false;
    }
    return ok;
  }

  
  form.addEventListener('submit', async (e) => {

      e.preventDefault();
      AuthUI.hideAlert();

      if (!validate()) return;

      submitBtn.disabled = true;

      const result = await Auth.login(
          userInput.value.trim(),
          passInput.value,
          remember.checked
      );

      if (!result.success) {

          AuthUI.showAlert(result.message, 'error');
          submitBtn.disabled = false;
          return;
      }

      AuthUI.showAlert(
          `Welcome, ${result.user.name}! Redirecting...`,
          'success'
      );

      setTimeout(() => {
          window.location.href = result.redirect;
      }, 600);

  });


  if (window.lucide) lucide.createIcons();
});
