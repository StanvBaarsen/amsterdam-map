module.exports = {
	publicPath: '/',
	configureWebpack: {
		devtool: 'source-map'
	  },
	runtimeCompiler: true,
	transpileDependencies: [
		'3d-tiles-renderer'
	]
};
