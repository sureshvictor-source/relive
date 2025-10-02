const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  server: {
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        // Handle ip.txt requests that cause sandbox issues on iOS device builds
        if (req.url.endsWith('/ip.txt')) {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('127.0.0.1');
          return;
        }
        return middleware(req, res, next);
      };
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
