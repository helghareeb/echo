; Custom NSIS include for the Sada installer.
; electron-builder registers the standard Add/Remove Programs uninstall entry
; automatically, but it does NOT create a Start Menu "Uninstall" shortcut. Users
; expect to find one there, so we add/remove it explicitly here.

!macro customInstall
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall ${PRODUCT_NAME}.lnk" "$INSTDIR\Uninstall ${PRODUCT_NAME}.exe"
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall ${PRODUCT_NAME}.lnk"
!macroend
