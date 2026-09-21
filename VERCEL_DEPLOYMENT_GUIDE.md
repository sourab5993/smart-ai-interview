# 🚀 Vercel Deployment Guide (Smart AI Interview System)

इस गाइड की मदद से आप अपने **Smart AI Interview Preparation & Evaluation Platform** को Vercel पर 2 मिनट में लाइव कर सकते हैं।

---

## 📋 क्या तैयार किया गया है?

1. **`vercel.json`**:
   - `/api/*` के सभी कॉल्स को Vercel Serverless Function (`api/index.ts`) पर रूट करता है।
   - सभी पेज/SPA रूट्स (`/interview`, `/history`, `/dashboard`) को `dist/index.html` पर स्मूदली डायरेक्ट करता है।
   - Serverless Function का `maxDuration: 60s` सेट किया गया है ताकि Gemini AI के बड़े जवाब कभी टाइमआउट न हों।

2. **`api/index.ts`**:
   - Vercel Serverless entrypoint जो आपके पूर्ण Express बैकएंड को लोड करता है।
   - ऑटोमैटिक MongoDB Atlas कनेक्शन और यूज़र सीडिंग को सर्वरलेस एनवायरनमेंट में भी बनाए रखता है।

3. **`server.ts`**:
   - 100% ओरिजिनल कोड सुरक्षित है।
   - लोकल पर `npm run dev` और `npm start` पहले की तरह ही चलेगा।
   - Vercel पर बिना पोर्ट कंफ्लिक्ट के सर्वरलेस मोड में काम करेगा।

---

## 🛠️ Step-by-Step Vercel Deployment

### Step 1: प्रोजेक्ट को GitHub पर पुश करें (Push to GitHub)
यदि आपने अभी तक अपने कोड को GitHub रिपॉजिटरी में पुश नहीं किया है:
```bash
git add .
git commit -m "Configure Vercel serverless deployment"
git push origin main
```

---

### Step 2: Vercel में प्रोजेक्ट इम्पोर्ट करें
1. [vercel.com](https://vercel.com) पर जाएं और लॉगिन करें।
2. **"Add New..."** ➜ **"Project"** पर क्लिक करें।
3. अपनी GitHub रिपॉजिटरी सिलेक्ट करें और **"Import"** पर क्लिक करें।

---

### Step 3: Environment Variables जोड़ें (सबसे महत्वपूर्ण)
Vercel के **"Configure Project"** स्क्रीन पर **Environment Variables** सेक्शन खोलें और ये 3 वैरिएबल्स जोड़ें:

| Variable Name | Value | विवरण |
|---|---|---|
| `GEMINI_API_KEY` | `AIzaSy...` | आपका Google Gemini API Key |
| `MONGODB_URI` | `mongodb+srv://sourabstar786_db_user:...@cluster0.ov0hen5.mongodb.net/smart_ai_interview?retryWrites=true&w=majority&appName=Cluster0` | आपका MongoDB Atlas Cloud Connection String |
| `JWT_SECRET` | `smart_interview_jwt_super_secure_secret_key_2025_prod` | यूज़र ऑथेंटिकेशन के लिए सीक्रेट की |

> 💡 **टिप:** यदि आप चाहें तो `.env` से बाकी वैरिएबल्स भी कॉपी कर सकते हैं, लेकिन ऊपर दिए गए 3 वैरिएबल्स सबसे ज़रूरी हैं।

---

### Step 4: "Deploy" पर क्लिक करें
- **Deploy** बटन दबाएं।
- Vercel कुछ ही सेकेंड्स में:
  1. Frontend (React + Vite) को ऑप्टिमाइज़्ड static assets में बिल्ड करेगा।
  2. Backend APIs (`/api/auth`, `/api/db`, `/api/ai/*`) को Vercel Edge Serverless Functions के रूप में लाइव कर देगा।

---

## 🔍 डिप्लॉयमेंट के बाद टेस्ट कैसे करें?

लाइव Vercel डोमेन (जैसे: `https://your-app.vercel.app`) पर जाकर चेक करें:

1. **API Health Check**:
   `https://your-app.vercel.app/api/health` ➜ `{ status: "ok", hasGeminiKey: true, database: { isConnected: true } }` दिखना चाहिए।
2. **Database Health**:
   `https://your-app.vercel.app/api/db/health` ➜ `{ success: true, ... }`
3. **Login / Register**:
   ऐप के होमपेज पर जाएं, टेस्ट यूजर से लॉगिन करें या नया अकाउंट बनाएं।
4. **AI Interview Generator**:
   इंटरव्यू सेटअप करें और AI सवाल जनरेट करके पूरा मॉक टेस्ट दें।

---

## 💻 लोकल डेवलपमेंट (Local Dev)
आपका लोकल सेटअप बिल्कुल वैसा ही है:
- डेवलपमेंट सर्वर: `npm run dev` (http://localhost:3000)
- प्रोडक्शन टेस्ट: `npm run build && npm start`
