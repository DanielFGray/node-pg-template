import * as esbuild from 'esbuild'

/** @type {esbuild.BuildOptions} */
const config = {
  bundle: true,
  format: 'esm',
  target: 'node22',
  packages: 'external',
  outfile: './dist/server.js',
  entryPoints: ['./server/index.ts'],
  sourcemap: true,
  plugins: [
    {
      name: 'rebuild-notify',
      setup(build) {
        build.onEnd(result => {
          console.log(`build ended with ${result.errors.length} errors`)
          if (result.errors.length) result.errors.forEach(e => console.error(e))
        })
      },
    },
  ],
}

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(config)
  await ctx.watch()
} else {
  await esbuild.build(config)
}
