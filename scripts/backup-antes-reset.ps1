# Copia o banco local erp e a pasta uploads para fora do Git.
# Uso (na raiz do repositório): powershell -File scripts/backup-antes-reset.ps1
# Não imprime senha nem DATABASE_URL.

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $raiz '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
  throw 'Arquivo .env nao encontrado na raiz do projeto.'
}

$variaveis = @{}
Get-Content -LiteralPath $envPath -Encoding UTF8 | ForEach-Object {
  $linha = $_.Trim()
  if ($linha -eq '' -or $linha.StartsWith('#')) { return }
  $igual = $linha.IndexOf('=')
  if ($igual -lt 1) { return }
  $chave = $linha.Substring(0, $igual).Trim()
  $valor = $linha.Substring($igual + 1).Trim()
  if (
    ($valor.Length -ge 2) -and
    (($valor.StartsWith('"') -and $valor.EndsWith('"')) -or ($valor.StartsWith("'") -and $valor.EndsWith("'")))
  ) {
    $valor = $valor.Substring(1, $valor.Length - 2)
  }
  $variaveis[$chave] = $valor
}

$hostBanco = $variaveis['DB_HOST']
$porta = $variaveis['DB_PORT']
$nome = $variaveis['DB_NAME']
$usuario = $variaveis['DB_USER']
$senha = $variaveis['DB_PASSWORD']

if (-not $hostBanco -or -not $porta -or -not $nome -or -not $usuario) {
  throw 'DB_HOST, DB_PORT, DB_NAME e DB_USER sao obrigatorios no .env.'
}

if ($hostBanco -ne 'localhost' -and $hostBanco -ne '127.0.0.1') {
  throw "Backup local recusado: DB_HOST=$hostBanco (esperado localhost)."
}
if ($nome -ne 'erp') {
  throw "Backup local recusado: DB_NAME=$nome (esperado erp)."
}

function Find-PgDump {
  $comando = Get-Command pg_dump -ErrorAction SilentlyContinue
  if ($comando) { return $comando.Source }
  $pastas = @(
    'C:\Program Files\PostgreSQL',
    'C:\Program Files (x86)\PostgreSQL'
  )
  foreach ($pasta in $pastas) {
    if (-not (Test-Path -LiteralPath $pasta)) { continue }
    $achado = Get-ChildItem -LiteralPath $pasta -Filter pg_dump.exe -Recurse -ErrorAction SilentlyContinue |
      Sort-Object FullName -Descending |
      Select-Object -First 1
    if ($achado) { return $achado.FullName }
  }
  throw 'pg_dump nao encontrado no PATH nem em Program Files.'
}

$pgDump = Find-PgDump
$carimbo = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$destino = Join-Path 'C:\Users\trind\Desktop' "Erp-backup-reset-$carimbo"
New-Item -ItemType Directory -Path $destino -Force | Out-Null

$dump = Join-Path $destino 'erp.dump'
$uploadsOrigem = Join-Path $raiz 'uploads'
$uploadsDestino = Join-Path $destino 'uploads'
$uploadsCopiados = $false

Write-Output "host=$hostBanco banco=$nome dump=$dump"
Write-Output "pg_dump=$pgDump"

$env:PGPASSWORD = $senha
try {
  & $pgDump -h $hostBanco -p $porta -U $usuario -d $nome -Fc --no-owner --no-privileges -f $dump
  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump falhou com codigo $LASTEXITCODE"
  }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

if (-not (Test-Path -LiteralPath $dump)) {
  throw 'Dump nao foi criado.'
}
$tamanho = (Get-Item -LiteralPath $dump).Length
if ($tamanho -le 0) {
  throw 'Dump ficou com 0 bytes.'
}

if (Test-Path -LiteralPath $uploadsOrigem) {
  Copy-Item -LiteralPath $uploadsOrigem -Destination $uploadsDestino -Recurse -Force
  $uploadsCopiados = $true
}

$manifesto = @{
  criadoEm = (Get-Date).ToString('o')
  banco = $nome
  host = $hostBanco
  formato = 'custom'
  dumpBytes = $tamanho
  uploadsCopiados = $uploadsCopiados
}
$manifesto | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destino 'manifesto.json') -Encoding UTF8

Write-Output "dump_bytes=$tamanho"
Write-Output "uploads_copiados=$uploadsCopiados"
Write-Output "BACKUP_DIR=$destino"
