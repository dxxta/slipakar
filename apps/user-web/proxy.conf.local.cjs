// Dev-server proxy for running this app by itself (make dev). Target comes from API_URL in .env.
// Used through `ng serve --proxy-config proxy.conf.local.cjs`; the committed proxy.conf.cjs is unchanged.
const target = process.env.API_URL || 'http://localhost:3000';
const route = { target, secure: false, changeOrigin: true };

module.exports = {
  '/api': route,
  '/admin': route,
  '/me': route,
  '/docs': route,
  '/openapi.json': route,
  '/health': route,
  '/metrics': route,
  '/notifications/unread-count': route,
  '/projects': {
    ...route,
    bypass(req) {
      if (req.method === 'GET' && req.headers.accept && req.headers.accept.includes('text/html')) {
        return '/index.html';
      }
    },
  },
};
