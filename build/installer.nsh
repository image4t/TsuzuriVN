; Remove only the known application payload. Never recursively remove $INSTDIR:
; UserData and any user-selected project folders must survive upgrades/uninstall.
!macro customRemoveFiles
  SetOutPath $TEMP
  Delete /REBOOTOK "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  Delete /REBOOTOK "$INSTDIR\${UNINSTALL_FILENAME}"
  Delete /REBOOTOK "$INSTDIR\chrome_100_percent.pak"
  Delete /REBOOTOK "$INSTDIR\chrome_200_percent.pak"
  Delete /REBOOTOK "$INSTDIR\d3dcompiler_47.dll"
  Delete /REBOOTOK "$INSTDIR\dxcompiler.dll"
  Delete /REBOOTOK "$INSTDIR\dxil.dll"
  Delete /REBOOTOK "$INSTDIR\ffmpeg.dll"
  Delete /REBOOTOK "$INSTDIR\icudtl.dat"
  Delete /REBOOTOK "$INSTDIR\LICENSE.electron.txt"
  Delete /REBOOTOK "$INSTDIR\LICENSES.chromium.html"
  Delete /REBOOTOK "$INSTDIR\resources.pak"
  Delete /REBOOTOK "$INSTDIR\snapshot_blob.bin"
  Delete /REBOOTOK "$INSTDIR\v8_context_snapshot.bin"
  Delete /REBOOTOK "$INSTDIR\vk_swiftshader_icd.json"
  Delete /REBOOTOK "$INSTDIR\vk_swiftshader.dll"
  Delete /REBOOTOK "$INSTDIR\vulkan-1.dll"
  Delete /REBOOTOK "$INSTDIR\resources\app.asar"
  Delete /REBOOTOK "$INSTDIR\locales\*.pak"
  RMDir "$INSTDIR\resources"
  RMDir "$INSTDIR\locales"
  RMDir "$INSTDIR"
!macroend
