# ╔══════════════════════════════════════════════════════════════╗
# ║   watch-excel.ps1 — مراقب شيت التحصيل                       ║
# ║   يراقب الشيت، وعند أي تعديل يصدّر JSON ويرفع على GitHub    ║
# ╚══════════════════════════════════════════════════════════════╝

# ── الإعدادات ──────────────────────────────────────────────────
$ExcelPath   = "D:\Mostafa Ibrahim\شيت تحصيل.xlsm"
$ProjectPath = "G:\tahseel"
$ScriptPath  = "$ProjectPath\scripts\export-excel.cjs"
$NodePath    = "node"    # لو node مش في PATH غيّر لـ "C:\Program Files\nodejs\node.exe"

# ── تسجيل الحدث ────────────────────────────────────────────────
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

# ── دالة التصدير والرفع ─────────────────────────────────────────
function Sync-Sheet {
    Write-Log "🔄 تغيير مُكتشف في الشيت — جاري التصدير..." "WARN"

    # انتظر نصف ثانية (لحين إغلاق Excel للملف)
    Start-Sleep -Milliseconds 800

    # تشغيل سكريبت التصدير
    try {
        $result = & $NodePath $ScriptPath 2>&1
        Write-Log $result "OK"
    } catch {
        Write-Log "❌ فشل تشغيل سكريبت التصدير: $_" "ERROR"
        return
    }

    # الانتقال لمجلد المشروع
    Set-Location $ProjectPath

    # التحقق من وجود تغييرات
    $status = git status --porcelain
    if (-not $status) {
        Write-Log "⏭️  لا توجد تغييرات جديدة للرفع" "INFO"
        return
    }

    # إضافة وحفظ ورفع
    try {
        git add public/data/
        $msg = "data: تحديث تلقائي من الشيت $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        git commit -m $msg
        git push origin main
        Write-Log "🚀 تم الرفع على GitHub بنجاح! Vercel سيحدّث الداشبورد تلقائياً." "OK"
    } catch {
        Write-Log "❌ فشل الرفع على GitHub: $_" "ERROR"
    }
}

# ── إعداد المراقب ──────────────────────────────────────────────
$folder   = Split-Path $ExcelPath -Parent
$filename = Split-Path $ExcelPath -Leaf

Write-Log "🟢 بدأ مراقبة الشيت..."
Write-Log "   المسار: $ExcelPath"
Write-Log "   المشروع: $ProjectPath"
Write-Log ""
Write-Log "اضغط Ctrl+C لإيقاف المراقبة" "WARN"
Write-Log "─────────────────────────────────────────────"

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path   = $folder
$watcher.Filter = "شيت تحصيل.xlsm"
$watcher.NotifyFilter = [System.IO.NotifyFilters]'LastWrite'
$watcher.EnableRaisingEvents = $true

# ── لوب المراقبة الرئيسي ───────────────────────────────────────
$lastSync = [DateTime]::MinValue

while ($true) {
    # انتظر حدث تعديل (10 ثوانٍ timeout ثم نعيد الفحص)
    $changed = $watcher.WaitForChanged([System.IO.WatcherChangeTypes]::Changed, 10000)

    if (-not $changed.TimedOut) {
        # تجنب التشغيل المتكرر خلال 30 ثانية
        $now = Get-Date
        if (($now - $lastSync).TotalSeconds -ge 30) {
            $lastSync = $now
            Sync-Sheet
        } else {
            Write-Log "⏳ تم التعديل مرة أخرى — انتظار 30 ثانية قبل المزامنة" "INFO"
        }
    }
}
