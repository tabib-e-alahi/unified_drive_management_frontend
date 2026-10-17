import type { NextConfig } from 'next';

/*
 * When the frontend and API are deployed to different sites (two
 * *.vercel.app projects, say), the session cookie the API sets is a
 * third-party cookie, and browsers increasingly block those outright:
 * login succeeds, then every request is 401.
 *
 * Setting API_PROXY_TARGET to the backend's origin serves the API from this
 * site under /api instead, so the cookie is first-party. Pair it with
 * NEXT_PUBLIC_API_URL=/api. Left unset (local dev), the browser calls the
 * backend directly.
 */
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, '');

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [{ source: '/api/:path*', destination: `${apiProxyTarget}/:path*` }];
  },
};

export default nextConfig;
