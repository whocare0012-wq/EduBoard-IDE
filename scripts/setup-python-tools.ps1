# Developer/device tools only. Does not connect to a board.
$ErrorActionPreference = 'Stop'
$toolRoot = 'D:\Software\EduBoard-Tools'
$environmentPath = Join-Path $toolRoot 'micropython-venv'
if (!(Test-Path -LiteralPath (Join-Path $environmentPath 'Scripts\python.exe'))) {
  python -m venv $environmentPath
  if ($LASTEXITCODE -ne 0) { throw 'Python environment creation failed.' }
}
$pythonTool = Join-Path $environmentPath 'Scripts\python.exe'
& $pythonTool -m pip install --index-url https://pypi.org/simple --cache-dir (Join-Path $toolRoot 'pip-cache') -r (Join-Path $PSScriptRoot '..\requirements-tools.txt')
if ($LASTEXITCODE -ne 0) { throw 'Python tool installation failed.' }
Write-Output "Select this Python in the IDE: $pythonTool"
