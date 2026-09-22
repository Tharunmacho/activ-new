$file = "C:\active-web-day-2-push\active-web-day-2-push\src\features\business\pages\Settings.tsx"
$lines = [System.IO.File]::ReadAllLines($file)

$openBraces = 0
$closeBraces = 0
$openParens = 0
$closeParens = 0

for ($i = 193; $i -lt 357; $i++) {
    $line = $lines[$i]
    
    foreach ($char in $line.ToCharArray()) {
        if ($char -eq '{') { $openBraces++ }
        elseif ($char -eq '}') { $closeBraces++ }
        elseif ($char -eq '(') { $openParens++ }
        elseif ($char -eq ')') { $closeParens++ }
    }
    
    $balance = $openBraces - $closeBraces
    $parenBalance = $openParens - $closeParens
    
    if ($balance -ne 0 -or $parenBalance -ne 0) {
        Write-Host ("{0,3}: {} balance={1}, () balance={2} | {3}" -f ($i+1), $balance, $parenBalance, $line.Trim().Substring(0, [Math]::Min(60, $line.Trim().Length)))
    }
}

Write-Host "`nFinal: { balance = $($openBraces - $closeBraces), ( balance = $($openParens - $closeParens)"
