/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Turbopack configuration (Next.js 16+)
  turbopack: {
    root: './', // Suppress multiple lockfile warning
  },
  
  // Webpack fallback for Node.js modules (when using --webpack)
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
}

module.exports = nextConfig
