/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/truthlayer',
  },
}

module.exports = nextConfig