$settingsFiles = Get-ChildItem -Path "C:\active-web-day-2-push\active-web-day-2-push\src" -Filter "Settings.tsx" -Recurse

foreach ($file in $settingsFiles) {
    Write-Host "Processing: $($file.FullName)"
    $content = [System.IO.File]::ReadAllText($file.FullName)
    
    # Replace curly quotes with straight quotes
    $fixed = $content -replace [char]0x201C, '"'
    $fixed = $fixed -replace [char]0x201D, '"'
    $fixed = $fixed -replace [char]0x2018, "'"
    $fixed = $fixed -replace [char]0x2019, "'"
    
    [System.IO.File]::WriteAllText($file.FullName, $fixed)
    Write-Host "  Fixed!"
}

Write-Host "`nAll Settings.tsx files have been fixed!"
