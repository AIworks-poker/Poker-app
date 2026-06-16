/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',          // static site — no server, deployable anywhere
  images: { unoptimized: true },
  trailingSlash: true,
}
export default nextConfig
