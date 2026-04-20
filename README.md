
# 🛡️ OriginTrace: Recursive Supply Chain Intelligence

<!-- ![OriginTrace Hero](assets/hero.png) -->

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini%20AI-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

**OriginTrace** is a next-generation supply chain mapping and risk assessment engine. It leverages a hybrid approach of web scraping, Bill of Materials (BOM) logic, and Generative AI to recursively "X-Ray" supply chains down to the raw material tiers, while providing real-time multi-factor risk intelligence.

---

<h2>📺 Project Showcase</h2>

<blockquote>
  <strong>Tip:</strong>
  Watch the full walkthrough of OriginTrace in action, featuring recursive mapping and risk intelligence analysis.
</blockquote>

<a href="assets/demo.mp4">▶ Watch Demo</a>

<hr>

## ✨ Core Features

### 🔍 Recursive Supply Chain "X-Ray"
- **Multi-Tier Discovery**: Maps supplier relationships beyond Tier-1, tracing connections down to Tier-8 using intelligent recursive logic.
- **BOM-Driven Mapping**: Uses standardized HSN codes and Bill of Materials (BOM) trees to validate and refine supplier inputs.
- **Incremental Loading**: "Expand More" functionality allows users to dynamically explore deep-tier edges without overwhelming the interface.

### 🛡️ Multi-Factor Risk Intelligence
OriginTrace calculates a unified **Risk Score** for every node in the graph based on:
1. **Sanction Radar (SDN)**: Automatically cross-references companies against international sanction lists (OFAC/SDN) using Gemini's fuzzy name-matching.
2. **Financial Health Scanner**: Intelligent analysis of SEC Edgar filings (10-K, 10-Q). Gemini extracts critical financial red flags, debt ratios, and bankruptcy risks directly from regulatory text.
3. **Climate Impact Monitor**: Real-time integration with weather APIs to detect active typhoons, storms, or extreme temperatures that could disrupt local logistics.

### 🧠 Intelligent Data Engine
- **Hybrid Extraction**: Combines high-resolution scraping (ImportYeti) with Gemini 2.0 Flash to parse unstructured shipment data into structured graph entities.
- **Next-Data Parsing**: High-speed extraction from modern web-app payloads to ensure data fidelity.
- **Auto-Geocoding**: Resolves messy company addresses into precise GPS coordinates for map-based visualization.
- **Persistent Caching**: Optimized for performance with a robust file-based caching layer for LLM and API responses.

---

## 🛠️ Technical Architecture

### Backend
- **Framework**: FastAPI (Python)
- **AI Core**: Google Gemini API (2.0 Flash)
- **Automation**: Playwright for headless browser interaction
- **Data Sources**:
  - SEC Edgar (Financials)
  - ImportYeti (Shipments)
  - Open-source SDN Lists (Sanctions)
  - WeatherAPI (Logistical Risk)
- **Storage**: JSON Graph Store with Persistent Cache

### Frontend
- **Framework**: Next.js 15+ (App Router)
- **Styling**: Tailwind CSS & Lucide Icons
- **Visuals**: Framer Motion for smooth transitions
- **Navigation**: Interactive Graph and Dashboard overlays

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- [Gemini API Key](https://aistudio.google.com/)
- [WeatherAPI Key](https://www.weatherapi.com/)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/OriginTrace.git
cd OriginTrace
````

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python main.py
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Environment Variables Setup

Both backend and frontend rely on environment variables.

1. Copy the example file:

```bash
cp .env.example .env
```

2. Update `.env`:


3. Restart backend and frontend after changes.

---

## 👥 Team LetUsCook.exe

- [Anay Shah](https://github.com/Anayshah13)
- [Jai Udeshi](https://github.com/jaiudeshi05)
- [Keya Divecha](https://github.com/k-div-11)
- [Vidit Gupta](https://github.com/Vidit-01)

---

