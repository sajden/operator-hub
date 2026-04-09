$listenAddress = "0.0.0.0"
$listenPort = 9223
$targetAddress = "127.0.0.1"
$targetPort = 9222

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse($listenAddress), $listenPort)
$listener.Start()
Write-Output "windows-chrome-debug-proxy listening on $listenAddress`:$listenPort -> $targetAddress`:$targetPort"

while ($true) {
  $client = $listener.AcceptTcpClient()
  $server = [System.Net.Sockets.TcpClient]::new()
  $server.Connect($targetAddress, $targetPort)

  $clientStream = $client.GetStream()
  $serverStream = $server.GetStream()

  $copyToServer = [System.Threading.Tasks.Task]::Run({
    param($source, $destination)
    try { $source.CopyTo($destination) } catch {}
    try { $destination.Close() } catch {}
  }, @($clientStream, $serverStream))

  $copyToClient = [System.Threading.Tasks.Task]::Run({
    param($source, $destination)
    try { $source.CopyTo($destination) } catch {}
    try { $destination.Close() } catch {}
  }, @($serverStream, $clientStream))
}
