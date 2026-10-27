# PathSense — Physical Mobility Accessibility & Routing

PathSense is a profile-aware, accessibility-first pedestrian routing application designed to help people with disabilities, wheelchair users, elderly pedestrians, parents with strollers, and injured individuals navigate safely and reliably.

## Current Version: V0.5 — AI-Assisted Barrier Understanding

### Architecture Pipeline
```text
Photo (Camera / Gallery / Sample)
  ↓
Image Pre-processing & Compression (~1280px JPEG)
  ↓
Secure Server Endpoint (POST /api/analyze-barrier)
  ↓
Google Gemini Vision Model (Server-Side Secret API Key)
  ↓
Defensive Schema Validation & Normalization
  ↓
Structured AIBarrierAnalysis JSON
  ↓
User Review & Editable Suggestion (Mandatory Confirmation)
  ↓
Standard V0.4 BarrierReport Pipeline
  ↓
Dynamic Profile Accessibility Scoring
  ↓
Automatic Route Recalculation
```

> **Critical Architectural Principle:**  
> **AI is an Assistant.** AI suggestions **require explicit user confirmation** before any barrier report is finalized. AI output never directly mutates graph geometry, changes route scores, or marks paths inaccessible without human review and confirmation.

---

## Capabilities Overview

### V0.1 — Foundations
- React Native + Expo Map
- 12 Gholeshapur–Behala mock landmarks
- 30 pedestrian path segments
- Mock pilot dataset

### V0.2 — Mobility Profiles & Scoring
- 5 mobility profiles:
  - Wheelchair
  - Crutches / Temporary Injury
  - Reduced Mobility (Elderly)
  - Stroller
  - General Mobility
- Profile-aware accessibility scoring (0–100)
- Color-coded path segments

### V0.3 — Route Planner
- Origin & Destination selection
- Three distinct routing modes:
  - **Most Accessible**
  - **Balanced**
  - **Shortest**
- Route highlighting, step metrics, and recalculation on profile change

### V0.4 — Barrier Reporting & Management
- Manual barrier reporting with photos and location
- Dynamic barrier penalties on accessibility scoring
- Automatic rerouting when current route is affected
- Active Barriers modal
- Barrier Details modal
- Mark Resolved & Delete Report workflows
- Resolved history preservation

### V0.4.2 — Route Mode Semantics & Equivalence Tolerances
- Lexicographic accessibility-first comparator
- Equivalence tolerances: `ACCESSIBLE_MIN_SCORE_TOLERANCE = 2`, `ACCESSIBLE_AVG_SCORE_TOLERANCE = 2`
- Priority order: Hard barriers → Minimum accessibility (with tolerance) → Critical barriers → Difficult segments → Moderate segments → Average accessibility (with tolerance) → Distance tie-breaker

### V0.5 — AI-Assisted Barrier Understanding
- **AI Analysis Provider**: Secure Node/Express backend (`server/`) with Google Gemini Vision integration.
- **Client Service**: Abstraction in `src/services/ai/` (`analyzeBarrierImage`).
- **Security**: Zero API keys exposed on client bundle or mobile device. Secret keys stored strictly in `server/.env`.
- **Structured Data**: Strongly-typed `AIBarrierAnalysis` output with server and client defensive schema validation.
- **Review & Editing**: Users can accept suggestions directly or edit barrier type, severity, passability, and surface condition.
- **Observability**: Structured server logging (`AI_ANALYSIS_START`, `AI_ANALYSIS_SUCCESS`, `AI_ANALYSIS_FAILED`).
- **Offline / Test Fixtures**: 6 representative barrier test classes (A through F) with evaluation script (`npm run evaluate`).

---

## Starting the Project

### 1. Start the AI Backend
```bash
cd server
npm install
npm run start
```
By default, the server runs on port 3001 (`http://0.0.0.0:3001`). Configure `GEMINI_API_KEY` in `server/.env` to enable live Gemini Vision analysis.

### 2. Start the Mobile Client
```bash
cd mobile
npm install
npm run start
```
Run on physical device via Expo Go or simulator. When running Expo Go, the app connects automatically to the local machine's IP address on port 3001.

### 3. Running AI Fixture Evaluation
```bash
cd server
npm run evaluate
```

### 4. Running End-to-End Routing Verification
```bash
cd mobile
npx tsx scripts/verify_v05.ts
```
