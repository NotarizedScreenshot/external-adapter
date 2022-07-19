module.exports = {
	mode: process.env.NODE_ENV || 'production',
	devtool: process.env.NODE_ENV === 'development' ? 'inline-source-map' : false,
	context: __dirname,
	plugins: [],

	optimization: {
		splitChunks: {
		// include all types of chunks
		chunks: 'all'
		}
	},

	module: {
		rules: [
			{
				test: /\.js$/,
				use: {
					loader: 'babel-loader',
				},
				// exclude: /node_modules/,
			},
		],
	},
};
