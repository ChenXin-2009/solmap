@echo off
setlocal enabledelayedexpansion

:: -----------------------------
:: 1. 读取 package.json 中当前版本号
:: -----------------------------
for /f "tokens=2 delims=:," %%a in ('findstr "version" package.json') do (
    set ver=%%a
)
set ver=%ver:"=%
set ver=%ver: =%

echo 当前版本号：%ver%

:: 拆分版本号
for /f "tokens=1,2,3 delims=." %%a in ("%ver%") do (
    set major=%%a
    set minor=%%b
    set patch=%%c
)

echo.
echo 请选择版本更新类型：
echo [1] 主版本号 (MAJOR) 例如 1.0.0 → 2.0.0
echo [2] 次版本号 (MINOR) 例如 1.1.0 → 1.2.0
echo [3] 修订号   (PATCH) 例如 1.0.1 → 1.0.2
echo.

set /p choice=输入选项 (1/2/3)： 

IF "%choice%"=="1" (
    set /a major=%major%+1
    set minor=0
    set patch=0
)
IF "%choice%"=="2" (
    set /a minor=%minor%+1
    set patch=0
)
IF "%choice%"=="3" (
    set /a patch=%patch%+1
)

set newver=%major%.%minor%.%patch%

echo.
echo 新版本号将为：%newver%
echo.

:: 更新说明
set /p message=请输入更新说明： 

:: -----------------------------
:: 2. 修改 package.json 内版本号
:: -----------------------------
powershell -Command "(Get-Content package.json) -replace '\"version\": \"[0-9\.]+\"', '\"version\": \"%newver%\"' | Set-Content package.json"

:: -----------------------------
:: 3. Git 提交与打 Tag
:: -----------------------------
git add .
git commit -m "Release %newver%: %message%"
git tag v%newver%

echo.
echo 提交中...
git push origin main
git push origin v%newver%

echo.
echo 发布完成！版本：%newver%
echo.
pause
