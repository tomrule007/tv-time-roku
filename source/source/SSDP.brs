'*************************************************************
'** SSDP Device Discovery
'** Used to find TV-TIME backend server on the local network
'*************************************************************

function DiscoverSSDP(searchTarget = "ssdp:all", timeout = 5000) as object
    '
    ' Discover SSDP devices on the network
    ' @param searchTarget - SSDP search target (e.g., "ssdp:all" or "upnp:rootdevice")
    ' @param timeout - timeout in milliseconds
    ' @return array of discovered devices or empty array
    '
    
    devices = []
    
    try
        ' Create UDP socket for SSDP multicast
        socket = CreateObject("roDatagramSocket")
        socket.SetSendToAddr("239.255.255.250:1900")
        socket.SetTimeouts(1000, timeout)
        
        ' Build SSDP M-SEARCH request
        request = "M-SEARCH * HTTP/1.1" + chr(13) + chr(10)
        request = request + "HOST: 239.255.255.250:1900" + chr(13) + chr(10)
        request = request + "MAN: ""ssdp:discover""" + chr(13) + chr(10)
        request = request + "MX: 2" + chr(13) + chr(10)
        request = request + "ST: " + searchTarget + chr(13) + chr(10)
        request = request + chr(13) + chr(10)
        
        ' Send multicast request
        socket.SendTo("239.255.255.250", 1900, request)
        
        ' Collect responses
        endTime = CreateObject("roSystemTime").GetTicksMs() + timeout
        while true
            now = CreateObject("roSystemTime").GetTicksMs()
            if now >= endTime then exit while
            
            ' Wait for responses
            data = socket.ReceiveStr(1024)
            if data <> ""
                device = ParseSSDPResponse(data)
                if device <> invalid
                    devices.Push(device)
                end if
            end if
        end while
        
        socket.Close()
        
    catch e
        ? "SSDP Discovery Error: " + e.Message
    end try
    
    return devices
end function

function ParseSSDPResponse(response as string) as object
    '
    ' Parse SSDP M-SEARCH response
    ' @param response - Raw HTTP response string
    ' @return object with device info or invalid
    '
    
    device = {}
    
    lines = response.Split(chr(13) + chr(10))
    for each line in lines
        line = line.Trim()
        
        if line.Instr("LOCATION:") = 0
            device.location = line.Mid(9).Trim()
        else if line.Instr("SERVER:") = 0
            device.server = line.Mid(7).Trim()
        else if line.Instr("ST:") = 0
            device.searchTarget = line.Mid(3).Trim()
        end if
    end for
    
    if device.location <> invalid
        return device
    end if
    
    return invalid
end function

function DiscoverTVTimeBackend() as string
    '
    ' Discover TV-TIME backend server on the network
    ' Uses SSDP discovery to find a service matching our backend
    ' @return IP address and port as string (e.g., "192.168.1.100:8080") or empty string
    '
    
    devices = DiscoverSSDP("upnp:rootdevice", 3000)
    
    for each device in devices
        if device.location <> invalid
            ' Try to fetch device description and find our backend service
            server_info = FetchDeviceDescription(device.location)
            if server_info <> invalid
                return server_info
            end if
        end if
    end for
    
    ' Fallback: try common local IP patterns
    return DiscoverViaCommonPatterns()
end function

function FetchDeviceDescription(location as string) as string
    '
    ' Fetch device description from SSDP location URL
    ' Look for TV-TIME service indication
    '
    
    try
        http = CreateObject("roUrlTransfer")
        http.SetUrl(location)
        http.SetTimeout(2000)
        
        response = http.GetToString()
        
        ' Check if this is a TV-TIME backend service
        if response.Instr("tv-time") > 0 or response.Instr("TV-TIME") > 0
            ' Extract IP and port from location URL
            ' Location format: http://192.168.1.100:8080/description
            url = location
            if url.Instr("http://") = 0
                url = url.Mid(7)
            end if
            
            slashPos = url.Instr("/")
            if slashPos > 0
                return url.Left(slashPos - 1)
            else
                return url
            end if
        end if
    catch e
        ' Device description fetch failed, continue
    end try
    
    return invalid
end function

function DiscoverViaCommonPatterns() as string
    '
    ' Fallback discovery: check known addresses and common local network IP patterns
    ' This scans for a TV-TIME backend on common ports
    '
    
    commonPorts = ["3000", "8080", "8000", "5000", "9090"]
    
    ' First, try common addresses that users might set up
    commonAddresses = [
        "192.168.1.1",
        "192.168.0.1",
        "localhost",
        "127.0.0.1"
    ]
    
    for each addr in commonAddresses
        for each port in commonPorts
            candidate = addr + ":" + port
            if HealthCheckServer(candidate)
                return candidate
            end if
        end for
    end for
    
    ' Then try scanning the local network
    localIP = GetLocalIP()
    if localIP <> ""
        parts = localIP.Split(".")
        if parts.Count() = 4
            baseIP = parts[0] + "." + parts[1] + "." + parts[2] + "."
            
            for ipSuffix = 1 to 254
                for each port in commonPorts
                    candidate = baseIP + ipSuffix.ToStr() + ":" + port
                    if HealthCheckServer(candidate)
                        return candidate
                    end if
                end for
            end for
        end if
    end if
    
    return ""
end function

function GetLocalIP() as string
    '
    ' Get the local IP address of the Roku device
    '
    
    try
        networkConfig = CreateObject("roNetworkConfiguration")
        if networkConfig.IsConnected()
            return networkConfig.GetIPAddress()
        end if
    catch e
        ' Network config failed
    end try
    
    return ""
end function

function HealthCheckServer(serverAddress as string) as boolean
    '
    ' Check if a server is alive and has the /api/status/limit endpoint
    ' @param serverAddress - server address with port (e.g., "192.168.1.100:8080")
    ' @return true if server responds to /api/status/limit, false otherwise
    '
    
    try
        url = "http://" + serverAddress + "/api/status/limit"
        http = CreateObject("roUrlTransfer")
        http.SetUrl(url)
        http.SetTimeout(1000)
        
        response = http.GetToString()
        if response <> "" and http.GetResponseCode() = 200
            return true
        end if
    catch e
        ' Server not responding
    end try
    
    return false
end function
