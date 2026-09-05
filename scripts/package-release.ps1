Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$extensionRoot = Join-Path $projectRoot 'dist/extension'
$manifest = Get-Content -LiteralPath (Join-Path $extensionRoot 'manifest.json') -Raw | ConvertFrom-Json
if ($manifest.version -notmatch '^\d+\.\d+\.\d+$') { throw '插件版本格式无效' }

Push-Location -LiteralPath $projectRoot
try {
    & node 'scripts/audit.mjs'
    if ($LASTEXITCODE -ne 0) { throw '产物审计失败，停止生成安装包' }
    $releaseRoot = Join-Path $projectRoot "artifacts/releases/v$($manifest.version)"
    New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
    $zipPath = Join-Path $releaseRoot "resume-application-assistant-v$($manifest.version).zip"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (-not (Test-Path -LiteralPath $zipPath)) {
        [IO.Compression.ZipFile]::CreateFromDirectory($extensionRoot, $zipPath, [IO.Compression.CompressionLevel]::Optimal, $false)
    }
    # Never replace a previously published version silently. Compare every entry.
    $archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        $files = @(Get-ChildItem -LiteralPath $extensionRoot -File -Recurse)
        $entries = @($archive.Entries | Where-Object { $_.Name })
        if ($files.Count -ne $entries.Count) { throw 'ZIP 文件数量与当前构建不一致；请提升版本后重新打包' }
        foreach ($entry in $entries) {
            $relative = $entry.FullName.Replace('/', [IO.Path]::DirectorySeparatorChar)
            $localPath = [IO.Path]::GetFullPath((Join-Path $extensionRoot $relative))
            if (-not $localPath.StartsWith($extensionRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'ZIP 路径越界' }
            $stream = $entry.Open()
            $sha = [Security.Cryptography.SHA256]::Create()
            try { $entryHash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '') }
            finally { $stream.Dispose(); $sha.Dispose() }
            if ($entryHash -ne (Get-FileHash -LiteralPath $localPath -Algorithm SHA256).Hash) { throw "ZIP 内容不一致：$($entry.FullName)；请提升版本后重新打包" }
        }
        if (-not $archive.GetEntry('manifest.json')) { throw 'ZIP 根目录没有 manifest.json' }
    } finally { $archive.Dispose() }
    $hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $checksumPath = Join-Path $releaseRoot 'SHA256SUMS.txt'
    [IO.File]::WriteAllText($checksumPath, "$hash  $([IO.Path]::GetFileName($zipPath))`n", [Text.UTF8Encoding]::new($false))
    $report = [ordered]@{
        result = 'pass'; version = $manifest.version; entries = $entries.Count
        zip = $zipPath; sha256 = $hash; bytes = (Get-Item -LiteralPath $zipPath).Length
        scope = 'Only audited dist/extension; every ZIP entry checked against local build'
    }
    $report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $releaseRoot 'package-check.json') -Encoding utf8
    $report | ConvertTo-Json
    & node 'scripts/checkpoint.mjs' --step '发布安装包生成与校验' --result success --summary "生成v$($manifest.version)安装ZIP，逐文件SHA256和manifest根目录检查通过；不含资料库、源码测试或开发记忆" --next '仅在用户要求发布新版本时上传公开仓库Release，已发布版本不覆盖'
    if ($LASTEXITCODE -ne 0) { throw '安装包已生成，但记忆写入失败' }
} catch {
    $problem = $_.Exception.Message
    & node 'scripts/checkpoint.mjs' --step '发布安装包生成与校验' --result failure --summary $problem --next '修复打包或校验错误后重试'
    throw
} finally { Pop-Location }
