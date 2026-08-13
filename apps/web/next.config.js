/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (apps/web/.next/standalone) for the Docker image
  output: 'standalone',
};

module.exports = nextConfig;
