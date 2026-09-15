<#
.SYNOPSIS
  Render one SWF under Ruffle and capture its CLIENT AREA to a PNG.

.DESCRIPTION
  THE RUNTIME ARBITER THIS PROJECT HAS BEEN MISSING.

  `tools/shot-live.mjs` shoots OUR renderer. Nothing until now shoots a real
  Flash player, so every question of the form "what does the player actually
  do here" has had to be settled by reading the specification and hoping. Two
  such questions were ranked open on 2026-09-15 — whether a player paints
  outside its stage rect, and what `strength` does to a glow once the alpha it
  scales has clamped.

  ► WHAT IT CAPTURES IS THE CLIENT AREA, NOT THE WINDOW. A window rect
    includes the title bar and the drop shadow, both of which are the desktop
    theme's pixels rather than the player's. Measuring a letterbox from a
    capture that included the title bar would put the stage's top edge tens of
    pixels off and read as a finding.

  ► IT USES CopyFromScreen RATHER THAN PrintWindow. Ruffle renders through
    wgpu, and PrintWindow on a GPU-composited window returns a black
    rectangle on this machine — a screenshot that looks like a render of
    nothing. Reading the actual screen costs a foregrounded window and is the
    only mode that returns pixels.

  ► THE PLAYER IS STARTED WITH -storage memory. AGENTS.md: the installed game
    and its Ruffle save are the measurement oracle, and a probe run must not
    write to `%LOCALAPPDATA%\ruffle\SharedObjects`. The probes here have no
    SharedObject anyway; the flag is there so that the habit survives being
    pointed at something that does.

  ► AND THE PROCESS IS KILLED BY PID IN A `finally`. `tools/shot.sh` leaked 73
    Chrome processes and the symptom was screenshots failing for URLs that had
    worked minutes earlier, which read as a page defect for half an hour. The
    same mistake with a player that holds a GPU device would be worse.

.PARAMETER Swf
  Path to the SWF to render (Windows path).

.PARAMETER Out
  Path of the PNG to write (Windows path).

.PARAMETER Width
  Window width in pixels. The CLIENT area comes out slightly smaller.

.PARAMETER Height
  Window height in pixels.

.PARAMETER Letterbox
  Ruffle's own `--letterbox`: off, fullscreen, or on.

.PARAMETER Scale
  Ruffle's own `--scale`: exact-fit, no-border, no-scale, show-all.

.PARAMETER SettleSeconds
  How long to let the player run before capturing. A single-frame probe needs
  only the first frame, but the window has to map and paint first.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Swf,
    [Parameter(Mandatory = $true)][string]$Out,
    [int]$Width = 400,
    [int]$Height = 400,
    [ValidateSet('off', 'fullscreen', 'on')][string]$Letterbox = 'on',
    [ValidateSet('exact-fit', 'no-border', 'no-scale', 'show-all')][string]$Scale = 'show-all',
    [double]$SettleSeconds = 4.0,
    [string]$Ruffle = 'C:\ss2-capture\.tools\ruffle-0.5.0\ruffle.exe'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $Ruffle)) { throw "Ruffle not found at $Ruffle" }
if (-not (Test-Path -LiteralPath $Swf)) { throw "SWF not found at $Swf" }

Add-Type -AssemblyName System.Drawing

if (-not ('Ss2Win' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Ss2Win {
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT r);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT p);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);

    // ► RUFFLE'S `MainWindowHandle` IS NOT ITS RENDER WINDOW, MEASURED: it
    //   reports a handle whose client rect is 0 x 0. .NET picks the first
    //   top-level window it finds for the process, and a winit application has
    //   more than one. So the window is chosen by the property that actually
    //   matters here — visible, belonging to this pid, and the LARGEST client
    //   area — rather than by which one enumerates first.
    public static IntPtr FindLargestWindow(uint wantPid) {
        IntPtr best = IntPtr.Zero;
        int bestArea = 0;
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pid != wantPid || !IsWindowVisible(hWnd)) return true;
            RECT r;
            if (!GetClientRect(hWnd, out r)) return true;
            int area = (r.Right - r.Left) * (r.Bottom - r.Top);
            if (area > bestArea) { bestArea = area; best = hWnd; }
            return true;
        }, IntPtr.Zero);
        return best;
    }
}
'@
}

# DPI: a scaled desktop reports logical pixels to a process that has not opted
# in, so a capture of a 400x400 client area would come back 400x400 of a
# 500x500 region — silently resampled, and every edge measured off it wrong.
[void][Ss2Win]::SetProcessDPIAware()

$arguments = @(
    '--width', $Width,
    '--height', $Height,
    '--letterbox', $Letterbox,
    '--scale', $Scale,
    '--force-scale',
    '--storage', 'memory',
    '--no-gui',
    '--quality', 'high',
    '--power', 'high',
    $Swf
)

$process = $null
try {
    $process = Start-Process -FilePath $Ruffle -ArgumentList $arguments -PassThru
    if (-not $process) { throw 'Ruffle failed to start.' }

    # Wait for a window with a REAL client area rather than sleeping a fixed
    # time: a mapped-but-unsized window is the state that produced "Client area
    # is 0 x 0", and a fixed sleep is either slower than it needs to be or a
    # race that fails intermittently.
    $handle = [IntPtr]::Zero
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while ([DateTime]::UtcNow -lt $deadline) {
        $candidate = [Ss2Win]::FindLargestWindow([uint32]$process.Id)
        if ($candidate -ne [IntPtr]::Zero) {
            $probe = New-Object Ss2Win+RECT
            if ([Ss2Win]::GetClientRect($candidate, [ref]$probe) -and ($probe.Right - $probe.Left) -gt 1) {
                $handle = $candidate
                break
            }
        }
        Start-Sleep -Milliseconds 150
    }
    if ($handle -eq [IntPtr]::Zero) { throw 'Ruffle never opened a window with a non-empty client area.' }
    [void][Ss2Win]::ShowWindow($handle, 5)      # SW_SHOW
    [void][Ss2Win]::SetForegroundWindow($handle)
    Start-Sleep -Seconds $SettleSeconds

    $rect = New-Object Ss2Win+RECT
    if (-not [Ss2Win]::GetClientRect($handle, [ref]$rect)) { throw 'GetClientRect failed.' }
    $origin = New-Object Ss2Win+POINT
    $origin.X = 0; $origin.Y = 0
    if (-not [Ss2Win]::ClientToScreen($handle, [ref]$origin)) { throw 'ClientToScreen failed.' }

    $clientWidth = $rect.Right - $rect.Left
    $clientHeight = $rect.Bottom - $rect.Top
    if ($clientWidth -le 0 -or $clientHeight -le 0) { throw "Client area is $clientWidth x $clientHeight." }

    $bitmap = New-Object System.Drawing.Bitmap($clientWidth, $clientHeight)
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.CopyFromScreen($origin.X, $origin.Y, 0, 0, (New-Object System.Drawing.Size($clientWidth, $clientHeight)))
        } finally { $graphics.Dispose() }

        $outDir = Split-Path -Parent $Out
        if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
            New-Item -ItemType Directory -Path $outDir -Force | Out-Null
        }
        $bitmap.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $bitmap.Dispose() }

    Write-Output "OK $Out ${clientWidth}x${clientHeight} at screen ($($origin.X),$($origin.Y)) letterbox=$Letterbox scale=$Scale"
} finally {
    # BY PID. `Stop-Process -Name ruffle` would take a player the operator
    # started for something else with it, and this script has no business
    # deciding that.
    if ($process -and -not $process.HasExited) {
        try { Stop-Process -Id $process.Id -Force -ErrorAction Stop } catch { }
    }
}
