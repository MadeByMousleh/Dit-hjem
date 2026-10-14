param([ValidateSet('fra1','arn1')][string]$Region)
$ErrorActionPreference = 'Stop'
$probeProject = 'stromblik-heat-probe-20261013'
$source = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $PSScriptRoot 'api/probe.mjs')))
$config = @{version=2;framework=$null;regions=@($Region);functions=@{'api/probe.mjs'=@{maxDuration=30}}} | ConvertTo-Json -Depth 6 -Compress
$package = '{"private":true,"type":"module"}'
$files = @(@{file='api/probe.mjs';data=$source;encoding='base64'},@{file='vercel.json';data=$config},@{file='package.json';data=$package})
$body = @{name=$probeProject;project=$probeProject;files=$files;regions=@($Region);projectSettings=@{framework=$null;nodeVersion='24.x';serverlessFunctionRegion=$Region}} | ConvertTo-Json -Depth 8 -Compress
if ($body.Length -gt 20000) { throw 'Unexpected probe payload size' }
$result = ($body | npx --yes vercel api /v13/deployments -X POST --input - --raw | Out-String) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Probe deployment failed' }
$result | Select-Object id,url,readyState | ConvertTo-Json -Compress
