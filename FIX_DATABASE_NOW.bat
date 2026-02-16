@echo off
REM ============================================================
REM EMERGENCY FIX: Add surge_multiplier Column to Database
REM Double-click this file to fix the database automatically
REM ============================================================

echo.
echo ========================================
echo   SATHA - Emergency Database Fix
echo ========================================
echo.
echo This will add the missing surge_multiplier column
echo to your database and fix the Driver App crash.
echo.
pause

REM Change to the correct directory (with Arabic chars support)
cd /d "%~dp0"

echo.
echo [1/3] Adding surge_multiplier column...
psql -U postgres -d satha_choice -c "ALTER TABLE settings ADD COLUMN IF NOT EXISTS surge_multiplier DECIMAL(3,2) DEFAULT 1.00;"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Could not connect to database!
    echo.
    echo Please make sure:
    echo  1. PostgreSQL is running
    echo  2. Database 'satha_choice' exists
    echo  3. Username 'postgres' has access
    echo.
    echo Try this instead:
    echo  - Open pgAdmin
    echo  - Connect to your database
    echo  - Run the SQL in EMERGENCY_FIX_DB.sql
    echo.
    pause
    exit /b 1
)

echo [SUCCESS] Column added!
echo.

echo [2/3] Creating vehicle_pricing_config table...
psql -U postgres -d satha_choice -c "CREATE TABLE IF NOT EXISTS vehicle_pricing_config (id SERIAL PRIMARY KEY, vehicle_type TEXT NOT NULL UNIQUE, base_fare INTEGER NOT NULL DEFAULT 25000, km_rate INTEGER NOT NULL DEFAULT 1250, minute_rate INTEGER NOT NULL DEFAULT 500, minimum_fare INTEGER NOT NULL DEFAULT 35000, updated_at TIMESTAMP DEFAULT NOW());"

echo [SUCCESS] Table created!
echo.

echo [3/3] Seeding pricing data...
psql -U postgres -d satha_choice -c "INSERT INTO vehicle_pricing_config (vehicle_type, base_fare, km_rate, minute_rate, minimum_fare) VALUES ('سطحة', 25000, 1250, 500, 35000), ('سحب', 20000, 1000, 400, 30000), ('هيدروليك', 50000, 2500, 1000, 70000) ON CONFLICT (vehicle_type) DO NOTHING;"

echo [SUCCESS] Pricing data seeded!
echo.

echo ========================================
echo   DATABASE FIX COMPLETE!
echo ========================================
echo.
echo Next steps:
echo  1. Restart your Node.js server (npm run dev)
echo  2. Test the Driver App
echo  3. Driver should accept orders without errors
echo.
pause
