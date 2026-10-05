$ErrorActionPreference = 'Stop'

# Remove only the retired ACTIV mapping. Let public DNS follow future deploys.
$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$original = [System.IO.File]::ReadAllText($hostsPath)
$pattern = '(?m)^[\t ]*217\.174\.148\.26[\t ]+activ\.org\.in[\t ]*(?:#[^\r\n]*)?\r?$'
if ($original -match $pattern) {
    $backupPath = $hostsPath + '.activ-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
    [System.IO.File]::Copy($hostsPath, $backupPath, $false)
    $updated = [regex]::Replace($original, $pattern, '# Removed retired ACTIV server override; use public DNS.')
    [System.IO.File]::WriteAllText($hostsPath, $updated, [System.Text.UTF8Encoding]::new($false))
    Write-Output "Removed retired ACTIV override. Backup: $backupPath"
} else {
    Write-Output 'No retired ACTIV override found; hosts file unchanged.'
}
Clear-DnsClientCache
Resolve-DnsName activ.org.in -Type A | Select-Object Name, IPAddress
