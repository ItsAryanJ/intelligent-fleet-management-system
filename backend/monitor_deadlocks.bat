@echo off
REM 30-minute deadlock monitor — checks every 60 seconds
echo ====================================================
echo  GPS Simulator Deadlock Monitor (30 minutes)
echo ====================================================
echo.

set CHECKS=0
set START_DEADLOCKS=0
set START_PINGS=0

:loop
set /a CHECKS+=1

REM Query PostgreSQL for stats
for /f "tokens=1" %%a in ('docker exec ncrtc-db psql -U ncrtc_admin -d ncrtc_fleet -t -c "SELECT deadlocks FROM pg_stat_database WHERE datname = ''ncrtc_fleet''"') do set DEADLOCKS=%%a
for /f "tokens=1" %%a in ('docker exec ncrtc-db psql -U ncrtc_admin -d ncrtc_fleet -t -c "SELECT COUNT(*) FROM gps_pings"') do set PINGS=%%a

if %CHECKS%==1 (
    set START_DEADLOCKS=%DEADLOCKS%
    set START_PINGS=%PINGS%
)

echo [Check %CHECKS%/30] %date% %time% ^| Pings: %PINGS% ^| Deadlocks: %DEADLOCKS%

if %CHECKS% GEQ 30 goto done

REM Wait 60 seconds
ping -n 61 127.0.0.1 >nul
goto loop

:done
echo.
echo ====================================================
echo  MONITORING COMPLETE
echo  Total checks: %CHECKS%
echo  Start deadlocks: %START_DEADLOCKS%
echo  End deadlocks: %DEADLOCKS%
echo  Start pings: %START_PINGS%
echo  End pings: %PINGS%
if %DEADLOCKS%==%START_DEADLOCKS% (
    echo  RESULT: PASS - No new deadlocks detected!
) else (
    echo  RESULT: FAIL - New deadlocks detected!
)
echo ====================================================
