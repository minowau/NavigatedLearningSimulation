export const gsap = {
  timeline: () => {
    const api = {
      from: () => api
    };
    return api;
  },
  to: (obj, opts) => {
    if (opts && typeof opts.onUpdate === 'function') {
      opts.onUpdate();
    }
    if (opts && typeof opts.onComplete === 'function') {
      opts.onComplete();
    }
    return { kill: () => {} };
  }
};
