module.exports = {
  '/api': { target: 'http://localhost:3000', secure: false, changeOrigin: true },
  '/admin': { target: 'http://localhost:3000', secure: false, changeOrigin: true },
  '/docs': { target: 'http://localhost:3000', secure: false, changeOrigin: true },
  '/openapi.json': { target: 'http://localhost:3000', secure: false, changeOrigin: true },
  '/notifications/unread-count': { target: 'http://localhost:3000', secure: false, changeOrigin: true },
  '/metrics': { target: 'http://localhost:3000', secure: false, changeOrigin: true },
  '/projects': {
    target: 'http://localhost:3000',
    secure: false,
    changeOrigin: true,
    bypass(req) {
      if (req.method === 'GET' && req.headers.accept && req.headers.accept.includes('text/html')) {
        return '/index.html';
      }
    },
  },
};
