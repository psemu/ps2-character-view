echo off
cls
rem call npm install
call browserify -r buffer -r jenkins-hash -r soe-pack -r forgelight-dme:dme > bundle.js
pause