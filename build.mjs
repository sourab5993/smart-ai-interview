import { build } from 'vite';
import { build as esbuild } from 'esbuild';

async function run() {
  console.log('🚀 Building production frontend bundle with Vite...');
  await build();
  console.log('✅ Frontend bundle built successfully!');

  console.log('🚀 Bundling serverless API entrypoint (api/index.js)...');
  await esbuild({
    entryPoints: ['server.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    packages: 'external',
    outfile: 'api/index.js',
  });
  console.log('✅ Serverless API entrypoint bundled successfully!');
}

run().catch((err) => {
  console.error('❌ Build error:', err);
  process.exit(1);
});
