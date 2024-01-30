const webpack = require('webpack');
module.exports = ({ config }) => {
  // This is how you can distinguish the `build` command from the `serve`
  const isBuild = config.mode === 'production';

  return {
    ...config,
    module: {
      ...config.module,
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
          },
        },
        ...config.module.rules,
        // Add your rules here
      ],
    },
    resolve: {
      fallback: {
        "path": require.resolve("path-browserify"),
        "os": require.resolve("os-browserify/browser"),
        "crypto": false
      },
      ...config.resolve.fallback,
    },
    plugins: [
      ...config.plugins
    ],
  }
}
