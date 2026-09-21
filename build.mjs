import { build } from 'vite';

async function run() {
  console.log('🚀 Building production frontend bundle with Vite...');
  await build();
  console.log('✅ Frontend bundle built successfully!');
}

run().catch((err) => {
  console.error('❌ Build error:', err);
  process.exit(1);
});
