# Render tools/og-card.html to site/og.png (the 1200x630 link-preview image) with headless Edge.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$out = Join-Path $root 'site\og.png'
$card = 'file:///' + ((Join-Path $here 'og-card.html') -replace '\\', '/')
$dataDir = Join-Path $env:TEMP 'asterra-og-render'
$flags = @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1200,630',
  '--virtual-time-budget=8000', "--user-data-dir=`"$dataDir`"", "--screenshot=`"$out`"", $card)
Start-Process -FilePath $edge -ArgumentList $flags -Wait -WindowStyle Hidden
Remove-Item -Recurse -Force -Confirm:$false $dataDir -ErrorAction SilentlyContinue
Get-Item $out | Select-Object Name, Length, LastWriteTime
