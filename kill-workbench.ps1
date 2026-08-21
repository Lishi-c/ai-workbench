$targets = Get-Process | Where-Object { ($_.ProcessName -like '*琉璃*') -or ($_.Path -like '*琉璃*') -or ($_.Path -like '*release*') }
$targets | Select-Object Id, ProcessName, Path | Format-Table -AutoSize | Out-String | Write-Output
$targets | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Output ('KILLED_COUNT=' + $targets.Count)
