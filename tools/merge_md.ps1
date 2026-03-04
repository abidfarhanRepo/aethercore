$md = Get-ChildItem -Path . -Recurse -Filter *.md | Sort-Object FullName
Remove-Item -Force ALL_MARKDOWN_MERGED.md -ErrorAction SilentlyContinue
$lines = @()
foreach ($f in $md) {
    $rel = $f.FullName.Replace((Get-Location).Path + '\\', '')
    $lines += ('--- FILE: ' + $rel + ' ---')
    $lines += Get-Content $f.FullName
    $lines += ''
}
$lines | Out-File ALL_MARKDOWN_MERGED.md -Encoding utf8
Write-Output 'MERGE_DONE'
