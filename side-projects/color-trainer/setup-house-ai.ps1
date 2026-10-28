$ErrorActionPreference = 'Stop'
$pythonExe = Join-Path $PSScriptRoot 'data/semantic-runtime/python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) {
  & (Join-Path $PSScriptRoot 'setup-semantic.ps1')
  if ($LASTEXITCODE -ne 0) { throw 'Isolated Python setup failed.' }
}
& $pythonExe -m pip install --disable-pip-version-check --no-warn-script-location --no-deps 'torchvision==0.23.0' --index-url 'https://download.pytorch.org/whl/cpu'
if ($LASTEXITCODE -ne 0) { throw 'Torchvision setup failed.' }
& $pythonExe -m pip install --disable-pip-version-check --no-warn-script-location --no-deps 'opencv-python-headless==4.12.0.88'
if ($LASTEXITCODE -ne 0) { throw 'Contour library setup failed.' }
& node (Join-Path $PSScriptRoot 'setup-house-ai.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Model download failed.' }
Write-Output 'House AI ready locally. No account, upload or paid API required.'
