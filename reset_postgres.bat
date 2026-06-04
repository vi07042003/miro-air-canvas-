@echo off
:: Batch script to reset PostgreSQL password to 1234 and setup AeroCanvas database
:: It requests Administrator privileges automatically.

:: Check for Administrative permissions
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges to reset PostgreSQL password...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    pushd "%CD%"
    CD /D "%~dp0"

echo ========================================================
echo Auto-Fixing PostgreSQL Password and Database Setup
echo ========================================================
echo.

set PG_DATA=C:\Program Files\PostgreSQL\17\data
set PG_HBA="%PG_DATA%\pg_hba.conf"
set PG_BIN=C:\Program Files\PostgreSQL\17\bin

echo [1/6] Temporarily allowing connection without password...
powershell -Command "(Get-Content '%PG_HBA%') -replace 'scram-sha-256', 'trust' | Set-Content '%PG_HBA%'"

echo [2/6] Restarting PostgreSQL service...
net stop postgresql-x64-17
net start postgresql-x64-17

echo [3/6] Resetting the 'postgres' user password to '1234'...
"%PG_BIN%\psql.exe" -U postgres -c "ALTER USER postgres PASSWORD '1234';"

echo [4/6] Reverting security settings...
powershell -Command "(Get-Content '%PG_HBA%') -replace 'trust', 'scram-sha-256' | Set-Content '%PG_HBA%'"

echo [5/6] Restarting PostgreSQL service...
net stop postgresql-x64-17
net start postgresql-x64-17

echo [6/6] Creating aerocanvas database...
cd /d C:\Users\HP\MIRO\backend
python setup_db.py --password 1234

echo.
echo ========================================================
echo ✅ DONE! The database is created and the password is 1234.
echo You can now restart your backend server.
echo ========================================================
pause
