param([string]$TrialDirectory = '.tmp/lidar-reference',[string]$ContainerName='dit-hjem-lidar-trial-v2')
$ErrorActionPreference = 'Stop'
$trialRoot = (Resolve-Path -LiteralPath $TrialDirectory).Path
$workspaceRoot = (Get-Location).Path
if (-not $trialRoot.StartsWith((Join-Path $workspaceRoot '.tmp') + [IO.Path]::DirectorySeparatorChar)) { throw 'Trial must stay inside workspace .tmp' }
$catalog = Get-Content -LiteralPath (Join-Path $trialRoot 'catalog.json') -Raw | ConvertFrom-Json
$tilePath = Join-Path $trialRoot ($catalog.selected.id + '.laz')
if ((Get-Item -LiteralPath $tilePath).Length -ne $catalog.selected.bytes) { throw 'Tile download is incomplete' }
$image = '3dgi/roofer@sha256:dd2c415aaee337502bde0dc1426dfa9c9f88e648f9d2f6340110c49932c251d2'
$arguments = @('run','--name',$ContainerName,'--network','none','--memory','768m','--memory-swap','768m','--cpus','2','--mount',"type=bind,source=$trialRoot,target=/data",$image,'--jobs','2','--id-attribute','id','--crop-output','--index','--box')
$arguments += @($catalog.bbox | ForEach-Object { $_.ToString([Globalization.CultureInfo]::InvariantCulture) })
$arguments += @(('/data/' + $catalog.selected.id + '.laz'),'/data/roofprints.geojson','/data/output')
& docker @arguments
if ($LASTEXITCODE -ne 0) { throw 'Roofer did not complete; inspect the trial container before retrying' }
