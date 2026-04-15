(function() {
  const STORAGE_KEY = 'app_active_main_tab';
  const TAB_ANIMATION_CLASS = 'tab-animating';
  const HIDDEN_TABS = new Set(['monitor', 'converter', 'orderbook', 'probability']);
  let tabAnimationTimer = null;

  function activateTab(tabId) {
    const tabButtons = document.querySelectorAll('.tab-button[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');
    const moreToggle = document.getElementById('mainMoreToggle');
    const moreMenu = document.getElementById('mainMoreMenu');
    let activeContent = null;

    tabButtons.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    if (moreToggle) {
      moreToggle.classList.toggle('active', HIDDEN_TABS.has(tabId));
    }

    if (moreMenu) {
      moreMenu.hidden = true;
    }

    if (moreToggle) {
      moreToggle.setAttribute('aria-expanded', 'false');
    }

    document.body.classList.remove('main-more-open');

    tabContents.forEach((content) => {
      const isActive = content.id === `${tabId}-tab`;
      content.classList.toggle('active', isActive);
      content.classList.remove(TAB_ANIMATION_CLASS);
      if (isActive) activeContent = content;
    });

    if (tabAnimationTimer) {
      clearTimeout(tabAnimationTimer);
      tabAnimationTimer = null;
    }

    if (activeContent) {
      requestAnimationFrame(() => {
        activeContent.classList.add(TAB_ANIMATION_CLASS);
        tabAnimationTimer = setTimeout(() => {
          activeContent.classList.remove(TAB_ANIMATION_CLASS);
        }, 700);
      });
    }

    try {
      localStorage.setItem(STORAGE_KEY, tabId);
    } catch (e) {}

    document.dispatchEvent(new CustomEvent('app:tab-changed', {
      detail: { tabId }
    }));

    if (tabId === 'chart' && typeof window.resizeActiveChart === 'function') {
      setTimeout(() => {
        window.resizeActiveChart();
      }, 80);
    }
  }

  window.activateMainTab = activateTab;

  document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-button[data-tab]');
    const moreToggle = document.getElementById('mainMoreToggle');
    const moreMenu = document.getElementById('mainMoreMenu');
    if (!tabs.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => activateTab(tab.dataset.tab));
    });

    document.querySelectorAll('[data-go-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-go-tab');
        if (tabId) activateTab(tabId);
      });
    });

    if (moreToggle && moreMenu) {
      moreToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = moreToggle.getAttribute('aria-expanded') === 'true';
        moreToggle.setAttribute('aria-expanded', String(!isOpen));
        moreMenu.hidden = isOpen;
        document.body.classList.toggle('main-more-open', !isOpen);
      });

      document.addEventListener('click', (event) => {
        if (!moreMenu.hidden && !event.target.closest('.tabs-more-wrap')) {
          moreMenu.hidden = true;
          moreToggle.setAttribute('aria-expanded', 'false');
          document.body.classList.remove('main-more-open');
        }
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !moreMenu.hidden) {
          moreMenu.hidden = true;
          moreToggle.setAttribute('aria-expanded', 'false');
          document.body.classList.remove('main-more-open');
        }
      });
    }

    let initialTab = null;
    try {
      initialTab = localStorage.getItem(STORAGE_KEY);
    } catch (e) {}

    const exists = initialTab && document.querySelector(`.tab-button[data-tab="${initialTab}"]`);
    const activeTab = exists ? initialTab : (document.querySelector('.tab-button.active[data-tab]')?.dataset.tab || tabs[0]?.dataset.tab || 'home');
    activateTab(activeTab);
  });
})();
