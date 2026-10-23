// Konfigurasi Metro. Expo SQLite memakai WebAssembly di web, jadi .wasm
// ditambahkan ke assetExts agar pratinjau web bisa dibundel.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

module.exports = config;
