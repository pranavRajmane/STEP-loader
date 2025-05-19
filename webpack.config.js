const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: () => {
    const entries = {};
    
    // Main entry point at the root
    entries['main'] = path.join(__dirname, 'src/index.js');
    
    // Debug: Log the demos directory
    const demosDir = path.join(__dirname, 'src/demos');
    console.log('Demos directory:', demosDir);
    
    if (fs.existsSync(demosDir)) {
      const dirs = fs.readdirSync(demosDir);
      console.log('Found directories:', dirs);
      
      dirs.forEach(dir => {
        const demoPath = path.join(demosDir, dir);
        if (fs.statSync(demoPath).isDirectory() && dir !== '__build__') {
          const jsFile = path.join(demoPath, 'index.js');
          const jsExists = fs.existsSync(jsFile);
          console.log(`Directory: ${dir}`);
          console.log(`  - JS file exists: ${jsExists}`);
          
          if (jsExists) {
            entries[dir] = jsFile;
          } else {
            console.warn(`Missing index.js for ${dir}`);
          }
        }
      });
    }
    
    console.log('Entry points:', entries);
    return entries;
  },
  
  devServer: {
    contentBase: path.join(__dirname, 'src'),
    compress: true,
    port: 9000,
    open: true
  },
  
  module: {
    rules: [
      {
        test: /\.wasm$/,
        type: "javascript/auto",
        loader: "file-loader",
        options: {
          publicPath: "../../wasm/",
          outputPath: "wasm/"
        }
      }
    ]
  },
  
  plugins: [
    // Main application HTML
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src/index.html'),
      filename: 'index.html',
      chunks: ['main']
    }),
    
    // Demo HTML plugins
    ...((() => {
      const demosDir = path.join(__dirname, 'src/demos');
      if (!fs.existsSync(demosDir)) {
        console.warn('Demos directory not found!');
        return [];
      }
      
      return fs.readdirSync(demosDir)
        .filter(dir => {
          const fullPath = path.join(demosDir, dir);
          const isDirectory = fs.statSync(fullPath).isDirectory();
          const isBuildDir = dir === '__build__';
          const hasHtmlFile = fs.existsSync(path.join(fullPath, 'index.html'));
          console.log(`Demo directory: ${dir}`);
          console.log(`  - Is directory: ${isDirectory}`);
          console.log(`  - Has HTML file: ${hasHtmlFile}`);
          console.log(`  - Is **build**: ${isBuildDir}`);
          return isDirectory && !isBuildDir && hasHtmlFile;
        })
        .map(dir => {
          const htmlFile = path.join(demosDir, dir, 'index.html');
          console.log(`Creating HtmlWebpackPlugin for ${dir}`);
          console.log(`  - Template: ${htmlFile}`);
          console.log(`  - Output: demos/${dir}/index.html`);
          return new HtmlWebpackPlugin({
            template: htmlFile,
            filename: `demos/${dir}/index.html`,
            chunks: [dir]
          });
        });
    })()),
  ],
  
  resolve: {
    fallback: {
      fs: false,
      child_process: false,
      path: false,
      crypto: false,
    }
  },
};