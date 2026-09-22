import http from 'http';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import { connectDB, getDatabaseStatus } from './server/config/database';
import databaseRoutes from './server/routes/databaseRoutes';
import authRoutes, { seedAuthUsers } from './server/routes/authRoutes';
import aiRoutes from './server/routes/aiRoutes';
import resumeRoutes from './server/routes/resumeRoutes';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Lazy DB connection for Vercel serverless environments
let dbInitPromise: Promise<void> | null = null;
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    if (!dbInitPromise) {
      dbInitPromise = (async () => {
        try {
          await connectDB();
          await seedAuthUsers();
        } catch (err) {
          console.error('[Database Init Error in Serverless]', err);
          dbInitPromise = null;
        }
      })();
    }
    try {
      await dbInitPromise;
    } catch {}
  }
  next();
});

// ================= REST API ROUTERS =================
// Authentication APIs (Register, Login, Me, Logout, Users)
app.use('/api/auth', authRoutes);

// Database APIs (Health-Check & Interview Session CRUD)
app.use('/api/db', databaseRoutes);

// AI Interview & Assessment APIs (Questions, Evaluation, Interview Analysis, Job Match, Transcribe)
app.use('/api/ai', aiRoutes);

// Resume Document Parsing APIs (PDF, DOCX, DOC, TXT)
app.use('/api/resume', resumeRoutes);

// System Health Check (includes Gemini status and MongoDB connection health)
app.get('/api/health', async (req: Request, res: Response) => {
  const dbStatus = await getDatabaseStatus();
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    database: dbStatus,
  });
});

// ================= ERROR HANDLING & SERVER LIFECYCLE =================
// Global Error-Handling Middleware (Ensures Serverless/Express always returns JSON, never HTML 500)
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('[Unhandled Server Error in Express]', err);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(err.status || 500).json({
    success: false,
    message: err?.message || 'An unexpected server error occurred.',
  });
});

async function startServer() {
  // Connect to MongoDB with resilient lifecycle management
  await connectDB();

  // Initialize seeded accounts with bcrypt hashing if not present
  await seedAuthUsers();

  // Create HTTP server instance to share with Vite HMR (avoids standalone port 24678 conflict)
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    try {
      const viteModule = 'vite';
      const { createServer: createViteServer } = await import(/* @vite-ignore */ viteModule);
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          hmr: {
            server: httpServer,
          },
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn('Vite dev middleware could not be loaded:', viteErr);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('\n  🚀 Smart AI Universal Interview Server is live!');
    console.log('  ➜ Local:     http://localhost:' + PORT);
    console.log('  ➜ Network:   http://127.0.0.1:' + PORT);
    console.log('  ➜ DB Health: http://localhost:' + PORT + '/api/db/health\n');

    // Automatically open in Google Chrome on local startup
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      openChromeBrowser(`http://localhost:${PORT}`);
    }
  });

  httpServer.on('error', (err: any) => {
    if (err?.code === 'EADDRINUSE') {
      console.error('\n⚠️  [Port Conflict] Port ' + PORT + ' is already in use by another running process.');
      console.error('👉 To free port ' + PORT + ' on Windows PowerShell, run:');
      console.error('   Get-NetTCPConnection -LocalPort ' + PORT + ' | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n');
    } else {
      console.error('Server error:', err);
    }
  });
}

/**
 * Automatically launches Google Chrome pointing to the application URL.
 * Works seamlessly across Windows, macOS, and Linux.
 */
function openChromeBrowser(url: string) {
  if (process.env.AUTO_OPEN_BROWSER === 'false' || process.env.CI) {
    return;
  }

  // Small delay ensures Vite HMR and server routes are fully listening
  setTimeout(() => {
    const platform = process.platform;
    console.log(`  🌐 Launching Google Chrome: ${url}\n`);

    if (platform === 'win32') {
      // 1. Windows: Try 'start chrome' (resolves via Windows App Paths registry)
      exec(`start chrome "${url}"`, (err) => {
        if (err) {
          // 2. Fallback to standard Google Chrome install directories on Windows
          const chromePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
          ];
          const foundChrome = chromePaths.find((p) => p && fs.existsSync(p));
          if (foundChrome) {
            exec(`"${foundChrome}" "${url}"`, (fbErr) => {
              if (fbErr) {
                exec(`start "" "${url}"`);
              }
            });
          } else {
            // General fallback to system default browser
            exec(`start "" "${url}"`);
          }
        }
      });
    } else if (platform === 'darwin') {
      // macOS: open using Google Chrome app
      exec(`open -a "Google Chrome" "${url}"`, (err) => {
        if (err) exec(`open "${url}"`);
      });
    } else {
      // Linux: try standard chrome binaries, fallback to xdg-open
      exec(`google-chrome "${url}"`, (err) => {
        if (err) {
          exec(`google-chrome-stable "${url}" || xdg-open "${url}"`);
        }
      });
    }
  }, 400);
}

// Start HTTP server only in non-serverless environments (like local machine)
if (!process.env.VERCEL) {
  startServer();
}

export default app;
export { app, startServer };
