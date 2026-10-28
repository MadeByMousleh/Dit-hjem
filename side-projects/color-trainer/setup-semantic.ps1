$ErrorActionPreference = 'Stop'
$trainerRoot = $PSScriptRoot
$runtimeRoot = Join-Path $trainerRoot 'data/semantic-runtime'
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
$pythonExe = Join-Path $runtimeRoot 'python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) {
  $archive = Join-Path $runtimeRoot 'python.zip'
  Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip' -OutFile $archive
  Expand-Archive -LiteralPath $archive -DestinationPath $runtimeRoot -Force
  Set-Content -LiteralPath (Join-Path $runtimeRoot 'python312._pth') -Value "python312.zip`n.`nLib/site-packages`nimport site" -Encoding ascii
}
if (-not (Test-Path -LiteralPath (Join-Path $runtimeRoot 'Lib/site-packages/pip'))) {
  $bootstrap = Join-Path $runtimeRoot 'get-pip.py'
  Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $bootstrap
  & $pythonExe $bootstrap --disable-pip-version-check
  if ($LASTEXITCODE -ne 0) { throw 'pip setup failed.' }
}
& $pythonExe -m pip install --disable-pip-version-check --no-warn-script-location 'torch==2.8.0' --index-url 'https://download.pytorch.org/whl/cpu'
if ($LASTEXITCODE -ne 0) { throw 'CPU runtime setup failed.' }
& $pythonExe -m pip install --disable-pip-version-check --no-warn-script-location 'transformers==4.57.6' 'Pillow==12.0.0' 'numpy==2.2.6'
if ($LASTEXITCODE -ne 0) { throw 'Image runtime setup failed.' }
Write-Output 'Local CPU runtime ready. No machine-wide Python or app dependencies changed.'
