/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  reactStrictMode: false,
  output: "standalone",
  experimental: {
    optimizePackageImports: ["react-icons"],
  },
};

export default nextConfig;
