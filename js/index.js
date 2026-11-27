(function () {
  const user = Auth.getCurrentUser();
  const target = user ? Auth.getHomePage(user.role) : 'login.html';
  window.location.replace(target);
})();
