@echo off
REM ============================================================
REM دیپلوی خودکار هر ۶ Edge Function — دفتر حساب کتاب v3.7
REM ------------------------------------------------------------
REM استفاده: در VS Code روی فایل دابل‌کلیک کنید یا در Terminal:
REM   deploy-edge-functions.bat
REM
REM پیش‌نیاز (فقط بار اول):
REM   npm install -g supabase
REM   supabase login
REM   supabase link --project-ref ^<PROJECT_REF^>
REM ============================================================
chcp 65001 >nul
cd /d "%~dp0"

echo ════════════════════════════════════════════════
echo  Deploy Edge Functions (6 functions)
echo ════════════════════════════════════════════════

echo.
echo ^> Deploy: create-transaction ...
call supabase functions deploy create-transaction
if errorlevel 1 goto :error

echo.
echo ^> Deploy: manage-transaction ...
call supabase functions deploy manage-transaction
if errorlevel 1 goto :error

echo.
echo ^> Deploy: admin-users ...
call supabase functions deploy admin-users
if errorlevel 1 goto :error

echo.
echo ^> Deploy: admin-counterparties ...
call supabase functions deploy admin-counterparties
if errorlevel 1 goto :error

echo.
echo ^> Deploy: telegram-bot ...
call supabase functions deploy telegram-bot
if errorlevel 1 goto :error

echo.
echo ^> Deploy: backup-email ...
call supabase functions deploy backup-email
if errorlevel 1 goto :error

echo.
echo ════════════════════════════════════════════════
echo  Done - all 6 functions deployed.
echo ════════════════════════════════════════════════
pause
exit /b 0

:error
echo.
echo *** Deploy failed! Check the error above. ***
pause
exit /b 1
