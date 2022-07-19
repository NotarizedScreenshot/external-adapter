const {join, resolve} = require('path');

module.exports = {
  mode: process.env.NODE_ENV || 'production',
  devtool: process.env.NODE_ENV === 'development' ? 'inline-source-map' : false,
  entry: [join(__dirname, 'src/server.cjs')],

  target: 'node',

  // experiments: {
  //   outputModule: true,
  // },

  output: {
    path: resolve(__dirname, './public'),
    filename: 'server.js',
    library: {
      type: 'commonjs2' ,
    },
    libraryTarget: 'commonjs2',
    chunkFormat: 'commonjs',
  },

  module: {
    rules: [
    
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
        },
        include: [
          resolve('src'),
        ]
      },
    
    ],
  },

  externals: Object.keys(require('./package.json').dependencies),

  plugins: [
    
  ]
};
