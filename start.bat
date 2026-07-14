@echo off
title ContextForge
echo ============================================
echo   ContextForge - Starting All Services
echo ============================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

:: Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Install from https://python.org
    pause
    exit /b 1
)

:: Refresh PATH for scoop-installed tools
set PATH=%USERPROFILE%\scoop\shims;%PATH%
set PATH=%USERPROFILE%\scoop\apps\redis\current;%PATH%

:: Install frontend deps if needed
if not exist "frontend\node_modules" (
    echo [1/6] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
) else (
    echo [1/6] Frontend dependencies already installed.
)

:: Install backend deps if needed
python -c "import fastapi" >nul 2>&1
if %errorlevel% neq 0 (
    echo [2/6] Installing backend dependencies...
    pip install -r backend\requirements.txt
) else (
    echo [2/6] Backend dependencies already installed.
)

:: Copy .env to backend if not linked
if not exist "backend\.env" (
    echo [3/6] Linking .env to backend...
    copy /Y .env backend\.env >nul
) else (
    echo [3/6] .env already linked.
)

:: Start Redis if not already running
netstat -an | findstr ":6379" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo [4/6] Starting Redis on port 6379...
    start "Redis" cmd /c "redis-server --port 6379"
    timeout /t 2 /nobreak >nul
) else (
    echo [4/6] Redis already running on port 6379.
)

:: Start Neo4j if not already running
netstat -an | findstr ":7687" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo [5/6] Starting Neo4j on port 7687...
    set NEO4J_AUTH=neo4j/contextforge_neo4j
    start "Neo4j" cmd /c "C:\neo4j\neo4j-community-5.15.0\bin\neo4j.bat console"
    echo      Waiting for Neo4j to start...
    timeout /t 10 /nobreak >nul
) else (
    echo [5/6] Neo4j already running on port 7687.
)

echo [6/6] Starting application services...
echo.

:: Start backend
echo Starting Backend on http://localhost:8000 ...
start "ContextForge Backend" cmd /c "cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000"
timeout /t 3 /nobreak >nul

:: Start frontend
echo Starting Frontend on http://localhost:3000 ...
start "ContextForge Frontend" cmd /c "cd frontend && npm run dev"
timeout /t 3 /nobreak >nul

:: Open browser
echo.
echo Opening browser...
start http://localhost:3000

echo.
echo ============================================
echo   All Services Running:
echo     Neo4j:    http://localhost:7474  (bolt:7687)
echo     Redis:    localhost:6379
echo     Backend:  http://localhost:8000
echo     Frontend: http://localhost:3000
echo     API Docs: http://localhost:8000/docs
echo ============================================
echo.
echo Close this window or press Ctrl+C to stop.
pause
