import '@testing-library/jest-dom';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom does not implement matchMedia. Real browsers always have it,
// so this is an environment gap rather than a production guard — but
// Lenis calls it unguarded during construction, and the landing page
// installs Lenis on mount. Tests that render LandingPage failed with
// "window.matchMedia is not a function" without this.
if (typeof globalThis.matchMedia !== 'function') {
  globalThis.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
}