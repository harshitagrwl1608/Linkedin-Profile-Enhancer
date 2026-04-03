# 🚀 LinkedIn Profile AI Enhancer

LinkedIn Profile AI Enhancer is a powerful, full-stack tool designed to transform weak or incomplete LinkedIn profiles into high-impact, recruiter-ready professional presences. Using advanced AI (Google Gemini), it provides actionable feedback, scoring, and metric-driven content rewrites.

---

## ✨ Key Features

- **📊 Comprehensive Scoring**: Get an "Analyzer Score", "AI Score", and "Visibility Rating" (0-100) to understand your current profile strength.
- **✍️ Multi-Tone Rewriting**: Instantly generate professional, bold, technical, friendly, or FAANG-level versions of your headline, about section, and experience bullets.
- **🔍 Recruiter Simulation**: See how recruiters might view your profile and receive specific Boolean search queries they would use to find you.
- **⚡ Dynamic API Rotation**: Built for high throughput—automatically rotates through multiple API keys to prevent rate-limiting and ensure continuous service.
- **🔒 Security First**: Hardened configuration that keeps your API keys secure via environment variables and strict Git ignore policies.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3 (Modern, responsive UI with glassmorphism aesthetics).
- **Backend**: Node.js, Express.
- **AI Engine**: Google Gemini API.
- **Utilities**: Axios, Dotenv, Express-Rate-Limit.

---

## 🚀 Getting Started

### 1. Prerequisites

- Node.js (v14+)
- npm or yarn
- At least one [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### 2. Installation

Clone the repository and install dependencies:

```bash
# Install root dependencies (if any)
npm install

# Install backend dependencies
cd backend
npm install
```

### 3. Configuration

Create a `.env` file in the `backend` directory (refer to `.env.example`):

```bash
cd backend
cp .env.example .env
```

Edit the `.env` file and add your Gemini API keys. You can add as many as you like for rotation:

```env
PORT=5000
GEMINI_API_KEY_1=your_first_key
GEMINI_API_KEY_2=your_second_key
GEMINI_API_KEY_3=your_third_key
```

### 4. Running the Project

Start the backend server:

```bash
cd backend
npm run dev
```

The frontend can be served by opening `index.html` in your browser (or using Live Server in VS Code).

---

## 🔄 How API Rotation Works

This project features a custom-built rotation logic in `backend/src/services/ai.service.js`:
- It dynamically scans for all variables starting with `GEMINI_API_KEY_`.
- It uses a **round-robin** algorithm to cycle through keys for every request.
- It includes **automatic failover**: if one key hits a 429 Rate Limit, it instantly retries with the next available key.

---

## 🛡️ License

This project is open-source and available for all developers to enhance their LinkedIn presence.
