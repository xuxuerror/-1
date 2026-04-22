param(
  [Parameter(Mandatory = $false)]
  [string]$BaseUrl,

  [Parameter(Mandatory = $false)]
  [string]$AdminPassword
)

$ErrorActionPreference = "Stop"

function Write-Info($msg) {
  Write-Host "[INFO] $msg" -ForegroundColor Cyan
}

function Write-Success($msg) {
  Write-Host "[OK]   $msg" -ForegroundColor Green
}

function Convert-ToArray($value) {
  if ($null -eq $value) { return @() }
  if ($value -is [System.Collections.IEnumerable] -and -not ($value -is [string])) {
    return @($value)
  }
  return @($value)
}

function Write-Utf8NoBomJson($path, $obj) {
  $json = $obj | ConvertTo-Json -Depth 100
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $json, $utf8NoBom)
}

if (-not $BaseUrl) {
  $BaseUrl = Read-Host "请输入线上地址（例如 https://1-production-22f7.up.railway.app）"
}

$BaseUrl = $BaseUrl.TrimEnd("/")

if (-not $AdminPassword) {
  $securePwd = Read-Host "请输入管理员密码（不会显示）" -AsSecureString
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
if (-not (Test-Path $dataDir)) {
  New-Item -ItemType Directory -Path $dataDir | Out-Null
}

Write-Info "开始拉取线上数据..."

$books = Invoke-RestMethod -Uri "$BaseUrl/api/admin/books" -Headers $headers -Method GET
$booksArr = Convert-ToArray $books
Write-Utf8NoBomJson (Join-Path $dataDir "books.json") $booksArr
Write-Success "books.json 已更新（$($booksArr.Count) 本书）"

$allChapters = @()
foreach ($book in $booksArr) {
  $bookId = [uri]::EscapeDataString([string]$book.id)
  $chapters = Invoke-RestMethod -Uri "$BaseUrl/api/admin/chapters?bookId=$bookId" -Headers $headers -Method GET
  $chapterArr = Convert-ToArray $chapters
  $allChapters += $chapterArr
}
Write-Utf8NoBomJson (Join-Path $dataDir "chapters.json") $allChapters
Write-Success "chapters.json 已更新（$($allChapters.Count) 章）"

$comments = Invoke-RestMethod -Uri "$BaseUrl/api/admin/comments" -Headers $headers -Method GET
$commentsArr = Convert-ToArray $comments
Write-Utf8NoBomJson (Join-Path $dataDir "comments.json") $commentsArr
Write-Success "comments.json 已更新（$($commentsArr.Count) 条）"

Write-Host ""
Write-Success "线上内容已回流到本地 data/ 目录。"
Write-Host "下一步建议执行：" -ForegroundColor Yellow
Write-Host "  git add data/books.json data/chapters.json data/comments.json"
Write-Host "  git commit -m `"sync content from production`""
Write-Host "  git push"
