/**
 * Inspired by https://github.com/topheman/react-es6-redux
 */

const path = require('path');
const log = require('npmlog');

log.level = 'silly';

const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');
const HtmlCriticalPlugin = require('html-critical-webpack-plugin');
const SWPrecacheWebpackPlugin = require('sw-precache-webpack-plugin');
const requireText = require('require-text');
const myLocalIp = require('my-local-ip');
const common = require('./common');
const info = require('./info');

const sprite = requireText('./src/assets/symbol-defs.svg', require);
const plugins = [];

const BANNER = common.getBanner();
const BANNER_HTML = common.getBannerHtml();

const SERVICE_WORKER_FILENAME = 'service-worker.js';
const SERVICE_WORKER_CACHEID = 'your-web-expert';
const SERVICE_WORKER_IGNORE_PATTERNS = [/\.map$/, /manifest\.json$/];
const SW_PRECACHE_CONFIG = {
  minify: true,
  cacheId: SERVICE_WORKER_CACHEID,
  filename: SERVICE_WORKER_FILENAME,
  staticFileGlobsIgnorePatterns: SERVICE_WORKER_IGNORE_PATTERNS,
};

const root = __dirname;

const MODE_DEV_SERVER = process.argv[1].indexOf('webpack-dev-server') > -1 ? true : false;

log.info('webpack', 'Launched in ' + (MODE_DEV_SERVER ? 'dev-server' : 'build') + ' mode');

/** environment setup */

const BUILD_DIR = './build';
const DIST_DIR = process.env.DIST_DIR || 'dist';// relative to BUILD_DIR
const NODE_ENV = process.env.NODE_ENV ? process.env.NODE_ENV.toLowerCase() : 'development';
const DEVTOOLS = process.env.DEVTOOLS ? JSON.parse(process.env.DEVTOOLS) : null;// can be useful in case you have web devtools (null by default to differentiate from true or false)
// optimize in production by default - otherwize, override with OPTIMIZE=false flag (if not optimized, sourcemaps will be generated)
const OPTIMIZE = process.env.OPTIMIZE ? JSON.parse(process.env.OPTIMIZE) : NODE_ENV === 'production';
const LINTER = process.env.LINTER ? JSON.parse(process.env.LINTER) : true;
const FAIL_ON_ERROR = process.env.FAIL_ON_ERROR ? JSON.parse(process.env.FAIL_ON_ERROR) : !MODE_DEV_SERVER;// disabled on dev-server mode, enabled in build mode
const STATS = process.env.STATS ? JSON.parse(process.env.STATS) : false; // to output a stats.json file (from webpack at build - useful for debuging)
const LOCALHOST = process.env.LOCALHOST ? JSON.parse(process.env.LOCALHOST) : true;
const ASSETS_LIMIT = typeof process.env.ASSETS_LIMIT !== 'undefined' ? parseInt(process.env.ASSETS_LIMIT, 10) : 5000;// limit bellow the assets will be inlines
const hash = (NODE_ENV === 'production' && DEVTOOLS ? '-devtools' : '') + (NODE_ENV === 'production' ? '-[hash]' : '');

/** integrity checks */

if (/^\w+/.test(DIST_DIR) === false || /\/$/.test(DIST_DIR) === true) { // @todo make a better regexp that accept valid unicode leading chars
  log.error('webpack', `DIST_DIR should not contain trailing slashes nor invalid leading chars - you passed "${DIST_DIR}"`);
  process.exit(1);
}

log.info('webpack', `${NODE_ENV.toUpperCase()} mode`);
if (DEVTOOLS) {
  log.info('webpack', 'DEVTOOLS active');
}
if (!OPTIMIZE) {
  log.info('webpack', 'SOURCEMAPS activated');
}
if (FAIL_ON_ERROR) {
  log.info('webpack', 'NoErrorsPlugin disabled, build will fail on error');
}

/** plugins setup */

if(!FAIL_ON_ERROR) {
  plugins.push(new webpack.NoEmitOnErrorsPlugin());
}

plugins.push(new HtmlWebpackPlugin({
  name: info.name,
  title: info.title,
  image: info.image,
  description: info.description,
  keywords: info.keywords,
  url: info.url,
  domain: info.domain,
  email: info.email,
  phone: info.phone,
  twitterID: info.twitterID,
  twitterUsername: info.twitterUsername,
  twitterURL: info.twitterURL,
  github: info.github,
  linkedin: info.linkedin,
  analytics: info.analytics,
  iconSprite: sprite,
  template: 'src/index.ejs', // Load a custom template
  inject: MODE_DEV_SERVER, // inject scripts in dev-server mode - in build mode, use the template tags
  MODE_DEV_SERVER: MODE_DEV_SERVER,
  DEVTOOLS: DEVTOOLS,
  BANNER_HTML: BANNER_HTML,
  inlineSource: /\.css$/,
  minify: {
    collapseWhitespace: true
  },
  filename: './index.html'
}));

plugins.push(new HtmlWebpackPlugin({
  name: info.name,
  title: info.title,
  image: info.image,
  description: info.description,
  keywords: info.keywords,
  url: info.url,
  domain: info.domain,
  email: info.email,
  phone: info.phone,
  twitterID: info.twitterID,
  twitterUsername: info.twitterUsername,
  twitterURL: info.twitterURL,
  github: info.github,
  linkedin: info.linkedin,
  analytics: info.analytics,
  iconSprite: sprite,
  template: 'src/amp/index-amp.ejs', // Load a custom template
  inject: MODE_DEV_SERVER, // inject scripts in dev-server mode - in build mode, use the template tags
  MODE_DEV_SERVER: MODE_DEV_SERVER,
  DEVTOOLS: DEVTOOLS,
  BANNER_HTML: BANNER_HTML,
  inlineSource: /\.css$/,
  minify: {
    collapseWhitespace: true
  },
  filename: './amp/index.html'
}));

// extract css into one main.css file
const extractSass = new ExtractTextPlugin({
  filename: `main${hash}.css`,
  disable: false,
  allChunks: true
});
plugins.push(extractSass);
plugins.push(new webpack.BannerPlugin(BANNER));
plugins.push(new webpack.DefinePlugin({
  // Lots of library source code (like React) are based on process.env.NODE_ENV
  // (all development related code is wrapped inside a conditional that can be dropped if equal to "production"
  // this way you get your own react.min.js build)
  'process.env':{
    'NODE_ENV': JSON.stringify(NODE_ENV),
    'DEVTOOLS': DEVTOOLS, // You can rely on this var in your code to enable specific features only related to development (that are not related to NODE_ENV)
    'LINTER': LINTER // You can choose to log a warning in dev if the linter is disabled
  }
}));

plugins.push(new SWPrecacheWebpackPlugin(SW_PRECACHE_CONFIG));

if (OPTIMIZE) {
  plugins.push(new webpack.optimize.UglifyJsPlugin({
    compress: {
      warnings: true
    }
  }));
}

if (NODE_ENV !== 'production') {
  // to keep compatibility with old loaders - debug: true was previously on config
  plugins.push(new webpack.LoaderOptionsPlugin({
    debug: true
  }));
}

if (MODE_DEV_SERVER) {
  // webpack-dev-server mode
  if(LOCALHOST) {
    log.info('webpack', 'Check http://localhost:8080');
  }
  else {
    log.info('webpack', 'Check http://' + myLocalIp() + ':8080');
  }
}
else {
  // build mode
  log.info('webpackbuild', `rootdir: ${root}`);
  if (STATS) {
    //write infos about the build (to retrieve the hash) https://webpack.github.io/docs/long-term-caching.html#get-filenames-from-stats
    plugins.push(function() {
      this.plugin("done", function(stats) {
        require("fs").writeFileSync(
          path.join(__dirname, BUILD_DIR, DIST_DIR, "stats.json"),
          JSON.stringify(stats.toJson()));
      });
    });
  }
}

/** preloaders */

const preLoaders = [];

if (LINTER) {
  log.info('webpack', 'LINTER ENABLED');
  preLoaders.push({
    test: /\.js$/,
    exclude: /node_modules/,
    loader: 'eslint-loader',
    enforce: 'pre'
  });
}
else {
  log.info('webpack', 'LINTER DISABLED');
}

plugins.push(new HtmlWebpackInlineSourcePlugin());

plugins.push(new HtmlCriticalPlugin({
  base: path.join(__dirname, BUILD_DIR, DIST_DIR),
  src: 'index.html',
  dest: 'index.html',
  inline: true,
  minify: true,
  extract: true,
  width: 9999,
  height: 99999,
  penthouse: {
    blockJSRequests: false,
  }
}));

/** webpack config */

const config = {
  bail: FAIL_ON_ERROR,
  entry: {
    'whatwg-fetch': 'whatwg-fetch',
    'bundle': './src/bootstrap.js',
    'main': './src/style/main.scss'
  },
  output: {
    publicPath: '',
    filename: `[name]${hash}.js`,
    chunkFilename: `[id]${hash}.chunk.js`,
    path: path.join(__dirname, BUILD_DIR, DIST_DIR)
  },
  cache: true,
  devtool: OPTIMIZE ? false : 'sourcemap',
  devServer: {
    host: LOCALHOST ? 'localhost' : myLocalIp()
  },
  module: {
    rules: [
      ...preLoaders,
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader'
      },
      {
        test: /\.scss$/,
        use: extractSass.extract({
          use: [{
            loader: "css-loader",
            query: JSON.stringify({
              sourceMap: true
            })
          }, {
            loader: "sass-loader",
            query: JSON.stringify({
              sourceMap: true,
              includePaths: ["node_modules"]
            })
          }],
          // use style-loader in development
          fallback: "style-loader"
        })
      },
      { test: /\.(png|jpg|jpeg|webp)$/, loader: 'url-loader?limit=' + ASSETS_LIMIT + '&name=assets/[hash].[ext]' },
      { test: /\.woff(\?v=\d+\.\d+\.\d+)?$/, loader: 'url-loader?limit=' + ASSETS_LIMIT + '&mimetype=application/font-woff&name=assets/[hash].[ext]' },
      { test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/, loader: 'url-loader?limit=' + ASSETS_LIMIT + '&mimetype=application/font-woff&name=assets/[hash].[ext]' },
      { test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/, loader: 'url-loader?limit=' + ASSETS_LIMIT + '&mimetype=application/octet-stream&name=assets/[hash].[ext]' },
      { test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, loader: 'file-loader?&name=assets/[hash].[ext]' },
      { test: /\.svg(\?v=\d+\.\d+\.\d+)?$/, loader: 'url-loader?limit=' + ASSETS_LIMIT + '&mimetype=image/svg+xml&name=assets/[hash].[ext]' },
      { test: /\.(ico)$/, loader: 'file-loader?name=assets/[hash].[ext]' }
    ]
  },
  plugins: plugins,
  node:{
    console: true,
    fs: 'empty',
    net: 'empty',
    tls: 'empty'
  }
};

module.exports = config;
