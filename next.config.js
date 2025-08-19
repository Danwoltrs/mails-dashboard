/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Vercel
  output: 'standalone',
  trailingSlash: true,
  
  // Image optimization
  images: {
    unoptimized: true,
  },
  
  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;