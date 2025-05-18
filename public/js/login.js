// login.js - Handle authentication
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginBtn = document.getElementById('loginBtn');
    const loginModal = document.getElementById('loginModal');
    const loginModalClose = loginModal.querySelector('.close');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const userProfile = document.getElementById('userProfile');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userAvatar = document.getElementById('userAvatar');
    const logoutBtn = document.getElementById('logoutBtn');
  
    // Check if user is already logged in
    checkLoginStatus();
  
    // Event Listeners
    loginBtn.addEventListener('click', openLoginModal);
    loginModalClose.addEventListener('click', closeLoginModal);
    googleLoginBtn.addEventListener('click', () => {
      window.location.href = '/auth/google';
    });
    logoutBtn.addEventListener('click', logout);
  
    // Functions
    function openLoginModal() {
      loginModal.style.display = 'block';
      document.body.classList.add('modal-open');
    }
  
    function closeLoginModal() {
      loginModal.style.display = 'none';
      document.body.classList.remove('modal-open');
    }
  
    function checkLoginStatus() {
      // Make an AJAX request to check if user is logged in
      fetch('/check-auth')
        .then(response => response.json())
        .then(data => {
          if (data.isAuthenticated) {
            showUserProfile(data.user);
          }
        })
        .catch(error => {
          console.error('Error checking authentication status:', error);
        });
    }
  
    function showUserProfile(user) {
      // Update UI to show user is logged in
      loginBtn.style.display = 'none';
      userProfile.style.display = 'block';
      
      // Update user information
      userName.textContent = user.displayName || 'User';
      userEmail.textContent = user.emails?.[0]?.value || '';
      
      // If user has a profile picture, use it
      if (user.photos && user.photos.length > 0) {
        userAvatar.src = user.photos[0].value;
      }
      
      // Update recommendations and recently watched sections
      document.getElementById('recommendationsSection').style.display = 'block';
      document.getElementById('recentlyWatched').style.display = 'block';
    }
  
    function logout() {
      window.location.href = '/logout';
    }
  });