@echo off
chcp 65001 > nul
cd /d "%~dp0"
title 미니게임 천국 서버 (인터넷 공개)
where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js가 설치되어 있지 않습니다.
  echo https://nodejs.org 에서 LTS 버전을 설치한 뒤 컴퓨터를 재부팅하고 다시 실행하세요.
  pause
  exit /b
)
if not exist node_modules (
  echo 처음 실행이라 필요한 부품을 설치합니다. 잠시만 기다려 주세요...
  call npm install
)
echo.
echo  이 창이 켜져 있는 동안 인터넷 주소로 누구나 들어올 수 있어요.
echo  (인터넷에 열리는 것은 이 게임 서버뿐이고, 컴퓨터의 다른 파일은 열리지 않아요)
echo.
node server.js --online
pause
