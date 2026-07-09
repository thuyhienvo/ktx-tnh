@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Quan ly Ky tuc xa - DANG CHAY (dung thi dong cua so nay)

set "PORT=3000"
set "JWT_SECRET=ktx_bi_mat_hay_doi_chuoi_nay"
set "ADMIN_USERNAME=admin"
set "ADMIN_PASSWORD=admin123"

echo ============================================
echo   QUAN LY KY TUC XA
echo   Dang khoi dong... vui long doi vai giay.
echo   -> Trinh duyet se tu mo http://localhost:3000
echo   -> GIU CUA SO NAY MO trong khi dung app.
echo   -> Dong cua so nay = tat app.
echo ============================================

rem Mo trinh duyet sau 6 giay (khi server da san sang)
start "" cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"

rem Chay server (giu cua so nay mo)
".runtime\node\node.exe" server\index.js

echo.
echo App da dung. Bam phim bat ky de dong.
pause >nul
