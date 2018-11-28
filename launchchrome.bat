taskkill /F /IM chrome* /T

start "" "chrome" --user-data-dir=c:\temp1 --window-position=0,0 --start-fullscreen  "http://localhost:8080/grid.html?mouse=off" 
start "" "chrome" --user-data-dir=c:\temp2 --window-position=1920,0 --start-fullscreen  "http://localhost:8080/main.html?mouse=off"