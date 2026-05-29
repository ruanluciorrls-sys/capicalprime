/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@aios/shared'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  optimizeFonts: false,
  async rewrites() {
    // INTERNAL_API_URL: proxy SSR server-side
    //   Producao (Vercel) → https://meu-backend-aios.fly.dev
    //   Dev local         → http://127.0.0.1:3001
    const rawApiBase = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://meu-backend-aios.fly.dev';
    const apiBase = rawApiBase.replace(/^["']|["']$/g, '').trim().replace('localhost', '127.0.0.1');
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/v1/:path*`,
      },
    ];
  },
};
export default nextConfig;
