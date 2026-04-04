import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 禁用严格模式以避免某些重复渲染问题
  reactStrictMode: false,
  
  // 优化webpack配置
  webpack: (config, { isServer }) => {
    // 客户端优化
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        // 防止某些模块的内存问题
        removeAvailableModules: false,
      };
    }
    return config;
  },
  
  // 允许更大的打包文件
  experimental: {
    optimizePackageImports: ['three'],
  },
};

export default nextConfig;