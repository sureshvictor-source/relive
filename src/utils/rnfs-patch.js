// RNFS Patch - Temporarily disable RNFS to allow app to load
// This is a workaround for the Android RNFS initialization issue

// Mock RNFS module to prevent crashes
const MockRNFS = {
  DocumentDirectoryPath: '/data/data/com.reliveapp/files',
  ExternalDirectoryPath: '/storage/emulated/0/Android/data/com.reliveapp/files',
  RNFSFileTypeRegular: 0,
  RNFSFileTypeDirectory: 1,

  // Mock all RNFS functions to return resolved promises
  exists: () => Promise.resolve(false),
  mkdir: () => Promise.resolve(),
  stat: () => Promise.resolve({ size: 0, isFile: () => true, isDirectory: () => false }),
  copyFile: () => Promise.resolve(),
  moveFile: () => Promise.resolve(),
  unlink: () => Promise.resolve(),
  readDir: () => Promise.resolve([]),
  getFSInfo: () => Promise.resolve({ totalSpace: 1000000000, freeSpace: 500000000 }),
  readFile: () => Promise.resolve(''),
  writeFile: () => Promise.resolve()
};

// Replace the RNFS module
if (typeof global !== 'undefined') {
  global.RNFS = MockRNFS;
}

// Also try to patch the require cache
try {
  const Module = require('module');
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function(id) {
    if (id === 'react-native-fs') {
      console.log('RNFS patch: Intercepting react-native-fs require');
      return MockRNFS;
    }
    return originalRequire.apply(this, arguments);
  };
} catch (e) {
  console.warn('Could not patch require for RNFS:', e);
}

export default MockRNFS;