class VPNManager {
  constructor() {
    this.vpnIndicator = document.querySelector('.vpn-indicator');
    this.vpnStatus = document.querySelector('.vpn-connection-status');
    this.vpnButton = document.querySelector('.vpn-connect-btn');
    this.globalAccessEnabled = true; // Default to enabled
    
    this.initializeListeners();
    this.enableGlobalAccess(); // Auto-enable on load
  }

  initializeListeners() {
    this.vpnButton.addEventListener('click', () => {
      this.toggleGlobalAccess();
    });
  }

  toggleGlobalAccess() {
    this.globalAccessEnabled = !this.globalAccessEnabled;
    
    if (this.globalAccessEnabled) {
      this.enableGlobalAccess();
    } else {
      this.disableGlobalAccess();
    }
  }

  enableGlobalAccess() {
    this.vpnIndicator.classList.add('global-access');
    this.vpnButton.classList.add('global-access');
    this.vpnStatus.textContent = 'Enabled';
    this.vpnButton.textContent = 'Disable Global Access';
    this.showNotification('Global Access Enabled');
    
    // Enhance playback capabilities
    this.unlockGlobalContent();
  }

  disableGlobalAccess() {
    this.vpnIndicator.classList.remove('global-access');
    this.vpnButton.classList.remove('global-access');
    this.vpnStatus.textContent = 'Disabled';
    this.vpnButton.textContent = 'Enable Global Access';
    this.showNotification('Global Access Disabled');
  }

  unlockGlobalContent() {
    // Override region restrictions in video playback
    window.playMovie = (id, type = 'movie') => {
      const videoIframe = document.querySelector('.video-container iframe');
      // Direct embed without vpncenter.com
      videoIframe.src = `https://vidsrc.xyz/embed/${type}/${id}`;
      document.querySelector('.video-container').style.display = 'block';
    };
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'vpn-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
          notification.remove();
        }, 300);
      }, 2000);
    }, 100);
  }
}

// Global access bypass notification
const globalAccessStyle = document.createElement('style');
globalAccessStyle.textContent = `
  .global-access-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background-color: #46d369;
    color: white;
    text-align: center;
    padding: 10px;
    z-index: 1100;
    font-weight: bold;
  }
`;
document.head.appendChild(globalAccessStyle);

const globalAccessBanner = document.createElement('div');
globalAccessBanner.className = 'global-access-banner';
globalAccessBanner.textContent = '🌍 Global Access: Watch Without Restrictions';
document.body.insertBefore(globalAccessBanner, document.body.firstChild);

// Initialize VPN Manager
const vpnManager = new VPNManager();