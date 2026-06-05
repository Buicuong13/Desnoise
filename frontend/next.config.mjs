/** @type {import('next').NextConfig} */
const nextConfig = {
  // The old `.next` folder was created while UAC was off, so it's owned by
  // BUILTIN\Administrators and a normal (non-elevated) `next dev` can't open its
  // Turbopack cache ("Failed to open database / Access is denied"). Writing to a
  // fresh dir owned by the current user sidesteps that. Delete the stale `.next`
  // from an Administrator terminal when convenient, then this can be removed.
  distDir: '.next-dev',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
