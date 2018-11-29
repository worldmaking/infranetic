:restart

start "" "audio\audio.maxpat"

taskkill /F /IM chrome* /T
start "" "chrome" --user-data-dir=c:\temp1 --window-position=1920,0 --start-fullscreen --app="http://localhost:8080/grid.html?mouse=off" 
start "" "chrome" --user-data-dir=c:\temp2 --window-position=0,0 --start-fullscreen --app="http://localhost:8080/main.html?mouse=off"

node server.js

taskkill /F /IM chrome* /T
taskkill /F /IM max* /T
timeout 2 > nul

rem goto restart