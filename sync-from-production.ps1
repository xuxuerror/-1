param(
  [Parameter(Mandatory = $false)]
  [string]$BaseUrl,

  [Parameter(Mandatory = $false)]
  [string]$AdminPassword,

  [Parameter(Mandatory = $false)]
  [switch]$AllowEmptyChapters
)

$ErrorActionPreference = "Stop"

function Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

function ToArray($value) {
  if ($null -eq $value) { return @() }
  if ($value -is [System.Array]) { return $value }
  return ,$value
}

function WriteJsonNoBom($path, $obj) {
  $json = $obj | ConvertTo-Json -Depth 100
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $json, $utf8NoBom)
}

function BackupIfExists($path) {
  if (-not (Test-Path $path)) { return }
  $dir = Split-Path -Parent $path
  $name = Split-Path -Leaf $path
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backup = Join-Path $dir "$name.bak-$stamp"
  Copy-Item $path $backup -Force
  Info "Backup created: $backup"
}

if (-not $BaseUrl) {
  $BaseUrl = Read-Host "Enter production URL (e.g. https://your-app.up.railway.app)"
}
$BaseUrl = $BaseUrl.TrimEnd("/")

if (-not $AdminPassword) {
  $securePwd = Read-Host "Enter admin password (hidden)" -AsSecureString
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
  try {
    $AdminPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

$headers = @{ "x-admin-password" = $AdminPassword }
$projectRoot = $PSScriptRoot
$dataDir = Join-Path $projectRoot "data"
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }

Info "Fetching production data..."

$books = Invoke-RestMethod -Uri "$BaseUrl/api/admin/books" -Headers $headers -Method GET
$booksArr = @(ToArray $books)
if ($booksArr.Count -eq 0) {
  throw "Production returned 0 books. Stop to avoid accidental overwrite."
}
BackupIfExists (Join-Path $dataDir "books.json")
WriteJsonNoBom (Join-Path $dataDir "books.json") $booksArr
Ok "books.json updated ($($booksArr.Count) books)"

$allChapters = @()
foreach ($book in $booksArr) {
  $bookId = [uri]::EscapeDataString([string]$book.id)
  $chapters = Invoke-RestMethod -Uri "$BaseUrl/api/admin/chapters?bookId=$bookId" -Headers $headers -Method GET
  $chapterArr = @(ToArray $chapters)
  Info "Book [$($book.title)] chapters: $($chapterArr.Count)"
  $allChapters += $chapterArr
}
$allChapters = @($allChapters)

if ($allChapters.Count -eq 0 -and -not $AllowEmptyChapters) {
  Warn "Total chapters from production is 0. Skip writing chapters.json."
  Warn "If this is expected, run again with -AllowEmptyChapters."
} else {
  BackupIfExists (Join-Path $dataDir "chapters.json")
  WriteJsonNoBom (Join-Path $dataDir "chapters.json") $allChapters
  Ok "chapters.json updated ($($allChapters.Count) chapters)"
}

$comments = Invoke-RestMethod -Uri "$BaseUrl/api/admin/comments" -Headers $headers -Method GET
$commentsArr = @(ToArray $comments)
$commentsArr = @($commentsArr)
BackupIfExists (Join-Path $dataDir "comments.json")
WriteJsonNoBom (Join-Path $dataDir "comments.json") $commentsArr
Ok "comments.json updated ($($commentsArr.Count) comments)"

Write-Host ""
Ok "Production content synced to local data/."
Write-Host "Next:"
Write-Host "  git add data/books.json data/chapters.json data/comments.json"
Write-Host '  git commit -m "sync content from production"'
Write-Host "  git push"
