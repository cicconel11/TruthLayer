/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@truthlayer/storage"]
  }
};

export default nextConfig;

