import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');
const isMinify = !process.argv.includes('--no-minify');

/** @type {esbuild.BuildOptions} */
const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  minify: isMinify,
  sourcemap: !isMinify,
  logLevel: 'info',
  // Suppress the import.meta warning - it's in dead code for our use case
  // (we inline the default config so getExtendedConfigFile is never called)
  logOverride: {
    'empty-import-meta': 'silent',
  },
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
}
