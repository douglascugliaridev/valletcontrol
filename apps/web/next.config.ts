import type { NextConfig } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@valletcontrol/shared'],
  allowedDevOrigins: ['192.168.1.10'],
  async rewrites() {
    return [
      {
        source: '/api/uploads/:path*',
        destination: `${API_URL}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
