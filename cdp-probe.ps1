$server = Start-Process python -ArgumentList '-m','http.server','8765','--bind','127.0.0.1' -WorkingDirectory 'D:\Repos\boostergame\Beacon Runner\beacon-run' -PassThru
$tempDir = Join-Path $env:TEMP ('beacon-edge-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tempDir | Out-Null
$edge = Start-Process 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -ArgumentList @('--headless=new','--disable-gpu','--remote-debugging-port=9222','--user-data-dir=' + $tempDir,'about:blank') -PassThru

function Send-Cdp($client, $obj){
  $json = ($obj | ConvertTo-Json -Compress -Depth 10)
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $seg = [ArraySegment[byte]]::new($bytes)
  $client.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
}

function Receive-Cdp($client){
  $buffer = New-Object byte[] 65536
  $ms = New-Object IO.MemoryStream
  do {
    $seg = [ArraySegment[byte]]::new($buffer)
    $res = $client.ReceiveAsync($seg, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    if($res.Count -gt 0){ $ms.Write($buffer,0,$res.Count) }
  } while(-not $res.EndOfMessage)
  [Text.Encoding]::UTF8.GetString($ms.ToArray())
}

try {
  Start-Sleep -Seconds 2
  $list = Invoke-RestMethod -UseBasicParsing 'http://127.0.0.1:9222/json/list'
  $page = $list | Select-Object -First 1
  Write-Output ('WS=' + $page.webSocketDebuggerUrl)
  $client = [System.Net.WebSockets.ClientWebSocket]::new()
  $client.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

  $id = 1
  Send-Cdp $client @{id=$id; method='Page.enable'}
  Write-Output (Receive-Cdp $client)
  $id++
  Send-Cdp $client @{id=$id; method='Runtime.enable'}
  Write-Output (Receive-Cdp $client)
  $id++
  Send-Cdp $client @{id=$id; method='Page.navigate'; params=@{url='http://127.0.0.1:8765/index.html'}}
  Write-Output (Receive-Cdp $client)
  Start-Sleep -Seconds 4
  $id++
  Send-Cdp $client @{id=$id; method='Runtime.evaluate'; params=@{expression='JSON.stringify({body:document.body ? document.body.innerText.slice(0,500) : null,fatal:document.getElementById("fatalOverlay") ? document.getElementById("fatalOverlay").textContent : null,title:document.title})'; returnByValue=$true}}
  Write-Output (Receive-Cdp $client)
  $client.Dispose()
}
finally {
  if($edge -and (Get-Process -Id $edge.Id -ErrorAction SilentlyContinue)){ Stop-Process -Id $edge.Id -Force }
  if($server -and (Get-Process -Id $server.Id -ErrorAction SilentlyContinue)){ Stop-Process -Id $server.Id -Force }
  if(Test-Path $tempDir){ Remove-Item -Recurse -Force $tempDir }
}
