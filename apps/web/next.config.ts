import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@valletcontrol/shared'],
  allowedDevOrigins: ['192.168.1.10'],
};

export default nextConfig;
