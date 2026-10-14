param(
  [string]$Baseline = 'dpl_FnGW82YTQXnWMsb4DxfNADDaqbeG',
  [string]$Changed = 'src/services/heating-connection-server.mjs',
  [ValidateSet('fra1')][string]$Region
)
$ErrorActionPreference = 'Stop'
$tree = (npx --yes vercel api "/v6/deployments/$baseline/files" --raw | Out-String) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Source listing failed' }
$files = [System.Collections.Generic.List[object]]::new()
function Add-Source($items, $prefix) {
  foreach ($item in $items) {
    $relative = if ($prefix) { "$prefix/$($item.name)" } else { $item.name }
    if ($item.children) { Add-Source $item.children $relative; continue }
    if (-not $item.uid) { continue }
    if ($relative -match '(^|/)\.env($|\.)|(^|/)secrets/') { throw 'Unexpected sensitive source file' }
    if ($relative -eq $changed) {
      $bytes = [System.IO.File]::ReadAllBytes((Join-Path (Get-Location) $relative))
      $files.Add(@{file=$relative;data=[Convert]::ToBase64String($bytes);encoding='base64'})
      continue
    }
    $localMatch = (Test-Path -LiteralPath $relative -PathType Leaf) -and ((Get-FileHash -LiteralPath $relative -Algorithm SHA1).Hash.ToLower() -eq $item.uid)
    if ($localMatch) { $size = (Get-Item -LiteralPath $relative).Length }
    else {
      $content = (npx --yes vercel api "/v8/deployments/$baseline/files/$($item.uid)" --raw | Out-String) | ConvertFrom-Json
      if ($LASTEXITCODE -ne 0) { throw "Source read failed: $relative" }
      $bytes = [Convert]::FromBase64String($content.data)
      $hash = [BitConverter]::ToString([System.Security.Cryptography.SHA1]::Create().ComputeHash($bytes)).Replace('-','').ToLower()
      if ($hash -ne $item.uid) { throw "Source hash mismatch: $relative" }
      $size = $bytes.Length
    }
    $files.Add(@{file=$relative;sha=$item.uid;size=$size})
  }
}
Add-Source $tree[0].children ''
$project = Get-Content .vercel/project.json -Raw | ConvertFrom-Json
Write-Host "Reusing production source for $($files.Count - 1) files; replacing only $changed"
$deploymentBody = @{name='dit-hjem';project=$project.projectId;deploymentId=$baseline;target='production';files=$files.ToArray()}
if ($Region) { $deploymentBody.regions = @($Region); $deploymentBody.projectSettings = @{serverlessFunctionRegion=$Region} }
$body = $deploymentBody | ConvertTo-Json -Depth 8 -Compress
$result = ($body | npx --yes vercel api /v13/deployments -X POST --input - --raw | Out-String) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Deployment creation failed' }
$result | Select-Object id,url,readyState | ConvertTo-Json -Compress
