# SOL benchmark kit — fallback static server for Windows PowerShell when Node.js is not installed.
# Listens only on http://localhost:4173/ (loopback; no administrator rights needed for a localhost prefix on current
# Windows). Serves the "dist" folder next to this kit. Close the window to stop. Sends nothing anywhere.
param([string]$Root = (Join-Path $PSScriptRoot "..\..\dist"), [int]$Port = 4173)
$Root = (Resolve-Path $Root).Path
$types = @{ ".html"="text/html; charset=utf-8"; ".js"="text/javascript"; ".css"="text/css"; ".json"="application/json"; ".png"="image/png"; ".jpg"="image/jpeg"; ".svg"="image/svg+xml"; ".woff2"="font/woff2"; ".glb"="model/gltf-binary" }
$l = New-Object System.Net.HttpListener; $l.Prefixes.Add("http://localhost:$Port/"); $l.Start()
Write-Host "SOL is being served from $Root on http://localhost:$Port/  (close this window to stop)"
while ($l.IsListening) {
  $c = $l.GetContext(); $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath); if ($p -eq "/") { $p = "/index.html" }
  $f = [IO.Path]::GetFullPath((Join-Path $Root $p.TrimStart('/')))
  if ($f.StartsWith($Root) -and (Test-Path $f -PathType Leaf)) {
    $ext = [IO.Path]::GetExtension($f).ToLower(); $c.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { "application/octet-stream" })
    $fs = [IO.File]::OpenRead($f); $c.Response.ContentLength64 = $fs.Length; $fs.CopyTo($c.Response.OutputStream); $fs.Close()
  } else { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
