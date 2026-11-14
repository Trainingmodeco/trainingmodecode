@echo off
rem Training Mode - Shadowboxing clip editor.
rem 1. finds new clips in raw-footage
rem 2. builds previews and app videos in a minimised window (only what's new or changed)
rem 3. opens the editor in your browser; new previews appear as the build reaches them
rem Close this window to stop the editor.
cd /d "%~dp0"
node tools\shadow.mjs scan
start "TM shadowbox build" /min cmd /c "node tools\shadow.mjs build & pause"
node tools\shadow.mjs edit --open
pause
