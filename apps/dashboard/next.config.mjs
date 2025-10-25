/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@truthlayer/storage", "duckdb", "pg"]
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'duckdb': 'commonjs duckdb',
        'pg': 'commonjs pg',
        'pg-native': 'commonjs pg-native'
      });
    }
    return config;
  }
};

export default nextConfig;

