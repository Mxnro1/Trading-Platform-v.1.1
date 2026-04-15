(function () {
  const THEME_STORAGE_KEY = 'training-module-theme';
  const THEME_ATTRIBUTE = 'data-training-theme';
  const THEME_LIGHT = 'light';
  const THEME_DARK = 'dark';

  function readTheme() {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === THEME_LIGHT || savedTheme === THEME_DARK) {
        return savedTheme;
      }
    } catch (error) {
      // Ignore storage access errors (private mode, blocked storage, etc.).
    }
    return THEME_LIGHT;
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      // Ignore storage access errors.
    }
  }

  function applyTheme(theme) {
    const normalizedTheme = theme === THEME_DARK ? THEME_DARK : THEME_LIGHT;
    document.documentElement.setAttribute(THEME_ATTRIBUTE, normalizedTheme);
    document.documentElement.style.colorScheme = normalizedTheme;
    return normalizedTheme;
  }

  function getParentTheme() {
    try {
      if (window.parent && window.parent !== window) {
        const parentTheme = window.parent.document?.body?.getAttribute('data-theme');
        if (parentTheme === THEME_DARK || parentTheme === THEME_LIGHT) {
          return parentTheme;
        }
      }
    } catch (error) {
      // Ignore cross-origin/permission issues.
    }
    return null;
  }

  function resolveInitialTheme() {
    return getParentTheme() || readTheme();
  }

  function syncThemeFromParent() {
    const parentTheme = getParentTheme();
    if (!parentTheme) return;
    const appliedTheme = applyTheme(parentTheme);
    saveTheme(appliedTheme);
  }

  function observeParentTheme() {
    try {
      if (!(window.parent && window.parent !== window)) return;
      const parentBody = window.parent.document?.body;
      if (!parentBody) return;

      const observer = new MutationObserver(function () {
        syncThemeFromParent();
      });
      observer.observe(parentBody, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });

      window.addEventListener(
        'beforeunload',
        function () {
          observer.disconnect();
        },
        { once: true }
      );
    } catch (error) {
      // Ignore observer setup issues.
    }
  }

  function initAnimations() {
    const contentDivs = document.querySelectorAll('div.content');
    contentDivs.forEach((div) => {
      div.setAttribute('data-aos', 'fade-up');
      div.setAttribute('data-aos-delay', '600');
      div.setAttribute('data-aos-duration', '600');
    });

    if (window.AOS) {
      AOS.init();
    }
  }

  // Apply theme early to reduce visual flicker.
  applyTheme(resolveInitialTheme());

  function initTrainingModule() {
    syncThemeFromParent();
    observeParentTheme();
    initAnimations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTrainingModule, { once: true });
  } else {
    initTrainingModule();
  }
})();
