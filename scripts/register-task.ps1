# ╔══════════════════════════════════════════════════════════════╗
# ║   register-task.ps1 — تسجيل مهمة مجدولة في Windows          ║
# ║   شغّل هذا الملف مرة واحدة كـ Administrator                  ║
# ╚══════════════════════════════════════════════════════════════╝

$TaskName    = "TahseelExcelWatcher"
$ScriptPath  = "G:\tahseel\scripts\watch-excel.ps1"
$Description = "مراقب شيت التحصيل - يرفع البيانات تلقائياً على GitHub عند كل تعديل"

Write-Host "📋 تسجيل المهمة المجدولة: $TaskName" -ForegroundColor Cyan

# ── إعداد الإجراء (Action) ──────────────────────────────────────
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`""

# ── إعداد المشغّل (Trigger) — عند تسجيل الدخول ──────────────────
$trigger = New-ScheduledTaskTrigger -AtLogOn

# ── إعداد الإعدادات ─────────────────────────────────────────────
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)   # بدون حد زمني

# ── تسجيل المهمة ────────────────────────────────────────────────
try {
    # احذف القديمة لو موجودة
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

    Register-ScheduledTask `
        -TaskName    $TaskName `
        -Action      $action `
        -Trigger     $trigger `
        -Settings    $settings `
        -Description $Description `
        -RunLevel    Highest `
        -Force

    Write-Host "✅ تم تسجيل المهمة بنجاح!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📌 تفاصيل المهمة:" -ForegroundColor Yellow
    Write-Host "   الاسم:    $TaskName"
    Write-Host "   المشغّل:  عند تسجيل الدخول (تلقائي)"
    Write-Host "   السكريبت: $ScriptPath"
    Write-Host ""
    Write-Host "🚀 لتشغيلها الآن فوراً:" -ForegroundColor Cyan
    Write-Host "   Start-ScheduledTask -TaskName '$TaskName'"
    Write-Host ""
    Write-Host "⏹️  لإيقافها:" -ForegroundColor Yellow
    Write-Host "   Stop-ScheduledTask -TaskName '$TaskName'"

} catch {
    Write-Host "❌ فشل التسجيل: $_" -ForegroundColor Red
    Write-Host "تأكد أنك تشغّل الملف كـ Administrator" -ForegroundColor Yellow
}
