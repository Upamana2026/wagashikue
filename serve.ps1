# 簡易静的HTTPサーバー（Python不要 / PowerShell標準機能のみ）
# 使い方:  PowerShell で  powershell -ExecutionPolicy Bypass -File serve.ps1
# 既定で http://localhost:8000 にこのスクリプトのあるフォルダを配信する。
param(
  [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.mp3'  = 'audio/mpeg'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.txt'  = 'text/plain; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root"
Write-Host "=> http://localhost:$Port/   (停止する場合は Ctrl+C)"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    # URLデコードして安全にパス解決（ディレクトリトラバーサル防止）
    $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($rel -eq '/' -or [string]::IsNullOrEmpty($rel)) { $rel = '/index.html' }
    $path = Join-Path $root ($rel.TrimStart('/') -replace '/', '\')
    $full = [System.IO.Path]::GetFullPath($path)

    if (-not $full.StartsWith([System.IO.Path]::GetFullPath($root))) {
      $res.StatusCode = 403
    }
    elseif (Test-Path $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    else {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
  }
  catch {
    $res.StatusCode = 500
  }
  finally {
    $res.OutputStream.Close()
  }
}
