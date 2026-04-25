param(
    [Parameter(Mandatory = $false)]
    [string]$Title = "OpenCode",

    [Parameter(Mandatory = $false)]
    [string]$Message = "任务已完成"
)

Add-Type -AssemblyName System.Windows.Forms

$safeTitle = if ([string]::IsNullOrWhiteSpace($Title)) {
    "OpenCode"
} else {
    $Title.Trim()
}

$safeMessage = if ([string]::IsNullOrWhiteSpace($Message)) {
    "任务已完成"
} else {
    $Message.Trim()
}

for ($i = 0; $i -lt 3; $i++) {
    [console]::Beep(1000, 180)
    Start-Sleep -Milliseconds 120
}

[System.Windows.Forms.MessageBox]::Show(
    $safeMessage,
    $safeTitle,
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null
