# 🧠 Smart AI Interview Preparation & Evaluation Platform

An end-to-end, full-stack intelligent interview coaching ecosystem designed to conduct domain-calibrated mock interviews across **12+ academic disciplines and hundreds of career roles**. Featuring live voice transcription, real-time rubric-based evaluation, interactive 3D WebGL visualizations, and machine-learning placement readiness predictions.

---

## 🌟 Key Features

### 🎓 1. Universal Academic Discipline Coverage
- Calibrated question banks and evaluation criteria for:
  - **Engineering & Tech** (B.Tech, M.Tech, BCA, MCA — System Design, DSA, Embedded Systems)
  - **Medical & Healthcare** (MBBS, BDS, B.Pharm, Nursing — Clinical Protocols, Pharmacology)
  - **Management & Business** (MBA, BBA — Market Sizing, Case Studies, Financial Modeling)
  - **Commerce & Finance** (B.Com, M.Com, CA, CS — Auditing, Taxation, Corporate Law)
  - **Law & Judiciary** (LLB, LLM — Constitutional Law, IRAC Methodology)
  - **Design & Creative** (B.Des, B.Arch — Spatial Design, Portfolio Critiques)
  - **Science & Research** (B.Sc, M.Sc, Biotech — Statistical Inference, Lab Diagnostics)

### 🎙️ 2. Real-Time Voice Interview & Speech-to-Text
- Native speech recognition via the **Web Speech API** for natural verbal answering.
- Audio waveform visualizer and speech-to-text live confidence tracking.
- Hands-free verbal interaction simulating real-world bar-raiser interview dynamics.

### 📊 3. 8-Dimensional Multi-Metric Rubric Evaluation
Comprehensive multidimensional scoring on every answer:
1. **Technical / Domain Accuracy** (Discipline concepts, correct standards & APIs)
2. **Structural Delivery** (STAR & IRAC decomposition framework)
3. **Completeness & Depth** (Boundary conditions & tradeoffs)
4. **Relevance & Precision** (Direct adherence without off-topic filler)
5. **Communication Fluency** (Professional clarity & vocabulary)
6. **Confidence & Conviction** (Decisive and structured phrasing)
7. **Problem Solving Method** (Systematic reasoning and troubleshooting)
8. **Discipline Synthesis** (Practical commercial & clinical applicability)

### 🔮 4. 3D WebGL Cybernetic Interface & Custom Physics
- High-performance **Three.js** 3D core rendering an interactive gyroscopic neural sphere.
- Optional 3D custom cursor with particle trails, inertia tilting, and shockwave burst physics.

### 🎯 5. ML Placement Readiness Predictor
- Supervised feature extraction pipeline evaluating historical session vectors.
- Classification into **High / Medium / Low Placement Probability** with actionable gap metrics.

### 📄 6. ATS Resume Parsing & JD Match Engine
- Automated semantic keyword extraction and job description overlap scoring.
- Specific bullet-point improvement recommendations based on industry placement standards.

### 📅 7. Adaptive 7-Day Personalized Study Plans
- Automated day-by-day curriculum addressing specific weaknesses identified during interviews.
- Interactive checklist and milestone completion tracking.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, TailwindCSS, Motion |
| **3D Graphics** | Three.js (WebGL), Canvas Confetti |
| **Data Viz** | Recharts, Lucide Icons |
| **Backend** | Node.js, Express, tsx |
| **AI / NLP** | Google Gemini API (with offline universal fallback engine) |
| **Build & Tooling** | Vite, ESBuild |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18.0.0 or higher recommended)
- **npm** (v9.0.0 or higher)

### 1. Clone or Download Repository
```bash
cd smart-ai-interview-preparation-&-evaluation
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables (Optional)
Create a `.env` file in the root directory (or copy `.env.example`):
```bash
cp .env.example .env
```
Add your Gemini API key (optional — app includes a built-in offline engine if omitted):
```env
PORT=3000
GEMINI_API_KEY="your_api_key_here"
```

### 4. Run Development Server
```bash
npm run dev
```
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 📦 Available Scripts

- **`npm run dev`** — Starts the Express server with Vite in development mode.
- **`npm run build`** — Compiles the React client with Vite and bundles the Node server with esbuild.
- **`npm run start`** — Runs the compiled production bundle (`dist/server.cjs`).
- **`npm run lint`** — Runs TypeScript type-checking (`tsc --noEmit`).
- **`npm run clean`** — Cleans the production build output directory.

---

## 📂 Project Structure

```text
├── src/
│   ├── components/      # Reusable UI components (Navbar, Sidebar, 3D Core, ErrorBoundary)
│   ├── context/         # Centralized state management (AppContext)
│   ├── data/            # Course catalogs, question banks, and demo records
│   ├── utils/           # AI Client API, ML classification engine, speech handlers
│   ├── views/           # Dedicated application views (Dashboard, Practice, Report, Resume)
│   ├── types.ts         # TypeScript definitions & data models
│   ├── App.tsx          # Main layout & view router
│   ├── main.tsx         # Root React DOM mounting with Error Boundary
│   └── index.css        # Global design tokens & styling
├── server.ts            # Express server, Vite middleware & AI integration endpoints
├── vite.config.ts       # Vite configuration with React & Tailwind plugins
├── tsconfig.json        # TypeScript configuration
└── package.json         # Project metadata and dependencies
```

---

## 👤 Author
**Sourab**
- Full-Stack Developer & AI Systems Engineer
