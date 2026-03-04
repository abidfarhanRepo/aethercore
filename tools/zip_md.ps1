$files = Get-ChildItem -Path . -Recurse -Filter *.md | Sort-Object FullName | Select-Object -ExpandProperty FullName
if ($files) { Compress-Archive -Path $files -DestinationPath docs_bundle.zip -Force }
Write-Output 'ZIP_DONE'
