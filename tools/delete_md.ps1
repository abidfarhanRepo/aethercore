$cwd = Get-Location
$keep = Join-Path $cwd 'ALL_MARKDOWN_MERGED.md'
Write-Output "Keeping: $keep"
$files = Get-ChildItem -Path $cwd -Recurse -Filter *.md | Where-Object { $_.FullName -ne $keep }
if ($files.Count -gt 0) {
    foreach ($f in $files) {
        Write-Output ("Deleting: " + $f.FullName)
        Remove-Item -Force $f.FullName
    }
} else {
    Write-Output 'No markdown files to delete'
}

# Commit deletions
git add -A
try {
    git commit -m "Remove original markdown files after merge"
} catch {
    Write-Output 'No changes to commit'
}
git push origin HEAD
