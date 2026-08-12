$ExcelFolder = "D:\Mostafa Ibrahim"
$ProjectPath = "G:\tahseel"
$ScriptPath  = "$ProjectPath\scripts\export-excel.cjs"
$NodePath    = "node"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $time = Get-Date -Format "HH:mm:ss"
    $color = switch ($Level) {
        "OK"    { "Green" }
        "WARN"  { "Yellow" }
        "ERROR" { "Red" }
        default { "Cyan" }
    }
    Write-Host "[$time] $Message" -ForegroundColor $color
}

function Sync-Sheet {
    Write-Log "Change detected in Excel file - Exporting..." "WARN"
    Start-Sleep -Milliseconds 1000

    try {
        $result = & $NodePath $ScriptPath 2>&1
        Write-Log $result "OK"
    } catch {
        Write-Log "Failed to run export script: $_" "ERROR"
        return
    }

    Set-Location $ProjectPath

    $status = git status --porcelain
    if ($status) {
        try {
            git add public/data/
            $msg = "data: auto-sync $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
            git commit -m $msg
            git push origin main
            Write-Log "Pushed JSON to main branch. Vercel will now deploy automatically!" "OK"
        } catch {
            Write-Log "Failed to push to main: $_" "ERROR"
        }
    } else {
        Write-Log "No new JSON changes to commit to main." "INFO"
    }
}

Write-Log "Starting Excel file watcher..."
Write-Log "Watching Folder: $ExcelFolder for .xlsm files"
Write-Log "Press Ctrl+C to stop" "WARN"
Write-Log "---------------------------------------------"

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path   = $ExcelFolder
$watcher.Filter = "*.xlsm"
$watcher.NotifyFilter = [System.IO.NotifyFilters]'LastWrite'
$watcher.EnableRaisingEvents = $true

$lastSync = [DateTime]::MinValue

while ($true) {
    $changed = $watcher.WaitForChanged([System.IO.WatcherChangeTypes]::Changed, 10000)

    if (-not $changed.TimedOut) {
        $now = Get-Date
        if (($now - $lastSync).TotalSeconds -ge 30) {
            $lastSync = $now
            Sync-Sheet
        } else {
            Write-Log "Changes detected but ignoring due to 30s debounce" "INFO"
        }
    }
}
