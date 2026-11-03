@echo off
chcp 65001 > nul
cd /d "%~dp0"
title 미니게임 천국 서버
where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js가 설치되어 있지 않습니다.
  echo https://nodejs.org 에서 LTS 버전을 설치한 뒤 컴퓨터를 재부팅하고 다시 실행하세요.
  pause
  exit /b
)
if not exist node_modules\pg\package.json (
  echo 필요한 부품을 설치합니다 ^(처음 실행 또는 새 버전^). 잠시만 기다려 주세요...
  call npm install
)
node server.js
pause
