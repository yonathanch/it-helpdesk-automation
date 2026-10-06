import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Menghasilkan server.js mandiri di .next/standalone.
   * Ini yang dipakai Dockerfile agar image produksi tidak ikut
   * membawa seluruh node_modules.
   */
  output: 'standalone',
  reactStrictMode: true,
};

export default nextConfig;