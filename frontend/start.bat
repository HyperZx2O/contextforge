@echo off
rem ContextForge frontend launcher (mock mode, no backend required).
rem Runs from this folder regardless of where you double-click it.
cd /d "%~dp0"

rem VITE_USE_MOCK_API=true -> use hardcoded data in src/api/mock.js.
rem Set to false (or delete) to hit a real backend at VITE_API_BASE_URL.
set VITE_USE_MOCK_API=true

npm run dev
