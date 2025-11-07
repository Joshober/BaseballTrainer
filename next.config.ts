import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Turbopack configuration (Next.js 16+ default)
  turbopack: {
    // Empty config to silence the warning
  },
  // Webpack configuration (fallback for --webpack flag)
  webpack: (config, { isServer }) => {
    // Exclude MongoDB and Node.js modules from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        mongodb: false,
        'mongodb': false,
      };
      
      // Exclude MongoDB and related modules from client bundle
      const externals = config.externals || [];
      if (Array.isArray(externals)) {
        externals.push('mongodb');
        externals.push(/^mongodb/);
        externals.push(/^@\/lib\/mongodb/);
        externals.push(/^@\/lib\/database\/mongodb-adapter/);
      } else if (typeof externals === 'function') {
        const originalExternals = externals;
        config.externals = (context, request, callback) => {
          if (request === 'mongodb' || request?.startsWith('mongodb/') || request?.includes('mongodb')) {
            return callback(null, 'commonjs ' + request);
          }
          if (request?.includes('@/lib/mongodb') || request?.includes('@/lib/database/mongodb-adapter')) {
            return callback(null, 'commonjs ' + request);
          }
          return originalExternals(context, request, callback);
        };
      } else {
        config.externals = [
          externals,
          'mongodb',
          /^mongodb/,
          /^@\/lib\/mongodb/,
          /^@\/lib\/database\/mongodb-adapter/,
        ];
      }
      
      // Ignore MongoDB imports in client bundle
      config.resolve.alias = {
        ...config.resolve.alias,
        'mongodb': false,
        '@/lib/mongodb': false,
        '@/lib/database/mongodb-adapter': false,
      };
    }
    return config;
  },
};

export default nextConfig;
