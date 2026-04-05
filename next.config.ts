import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 启用静态导出
  output: 'export',
  // 禁用严格模式
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