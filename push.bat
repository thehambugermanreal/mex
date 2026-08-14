@echo off
setlocal
cd /d "%~dp0"

echo.
set "commit_message="
set /p "commit_message=Commit message: "

if not defined commit_message (
  echo Commit message cannot be empty.
  exit /b 1
)

echo.
echo Staging all changes...
git add -A
if errorlevel 1 exit /b 1

git diff --cached --quiet
if not errorlevel 1 (
  echo No changes to commit.
  exit /b 0
)

echo Creating commit...
git commit -m "%commit_message%" -m "Generated with Codebuff 🤖" -m "Co-Authored-By: Codebuff ^<noreply@codebuff.com^>"
if errorlevel 1 exit /b 1

echo Pushing to the configured remote...
git push
if errorlevel 1 exit /b 1

echo.
echo Push complete.
endlocal
