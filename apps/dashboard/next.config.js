/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',   // Necessário para deploy Docker/Hetzner
  transpilePackages: ['@aios/shared'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  optimizeFonts: false,
  async rewrites() {
    // INTERNAL_API_URL: usado para proxy SSR de dentro do container/processo Next.
    //   - Producao Docker: http://backend:3001 (DNS interno da rede Docker)
    //   - Dev Windows:     http://127.0.0.1:3001 (forca IPv4 pra evitar ECONNREFUSED ::1)
    // Fallback para NEXT_PUBLIC_API_URL (URL publica) so se INTERNAL_API_URL nao setada.
    const apiBase = (
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3001'
    ).replace('localhost', '127.0.0.1');
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/v1/:path*`,
      },
    ];
  },
};
export default nextConfig;
