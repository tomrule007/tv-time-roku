'*************************************************************
'** TV-TIME-ROKU
'** Check TV viewing time remaining on local backend server
'** Uses SSDP to automatically discover the backend
'*************************************************************

sub Main()
    print "Starting TV-TIME-ROKU..."
    
    'Indicate this is a Roku SceneGraph application'
    screen = CreateObject("roSGScreen")
    m.port = CreateObject("roMessagePort")
    screen.setMessagePort(m.port)

    'Create a scene and load /components/TVTime.xml'
    scene = screen.CreateScene("TVTime")
    scene.discovering = true
    screen.show()

    ' Initialize the app state
    m.serverAddress = GetConfiguredBackendAddress()
    m.clock = CreateObject("roTimespan")
    m.clock.Mark()
    m.discoveryStartTime = 0
    m.discoveryTimeout = 30000  ' 30 seconds
    m.pollInterval = 5000  ' Poll every 5 seconds
    m.lastPollTime = 0
    m.discoveryAttempted = false

    if m.serverAddress <> ""
        print "Using configured backend server: " + m.serverAddress
        scene.serverAddress = m.serverAddress
        scene.discovering = false
        m.lastPollTime = NowMs()
        PollTVTimeStatus(scene, m.serverAddress)
    end if

    ' Main event loop
    while(true)
        msg = wait(500, m.port)
        msgType = type(msg)
        
        if msgType = "roSGScreenEvent"
            if msg.isScreenClosed() then return
        end if
        
        currentTime = NowMs()
        elapsedTime = currentTime - m.discoveryStartTime
        
        ' Handle discovery phase
        if m.serverAddress = ""
            if not m.discoveryAttempted
                m.discoveryAttempted = true
                print "Attempting SSDP discovery..."
                m.serverAddress = DiscoverTVTimeBackend()
                if m.serverAddress <> ""
                    print "Backend server found at: " + m.serverAddress
                    scene.serverAddress = m.serverAddress
                    scene.discovering = false
                    m.lastPollTime = currentTime
                end if
            end if
            
            ' Check for discovery timeout
            if m.serverAddress = "" and elapsedTime > m.discoveryTimeout
                print "Discovery timeout - server not found"
                scene.discovering = false
                scene.error = "Make sure your backend server is running on the local network."
            end if
        else
            ' Poll for TV time status
            if currentTime - m.lastPollTime >= m.pollInterval
                m.lastPollTime = currentTime
                PollTVTimeStatus(scene, m.serverAddress)
            end if
        end if
    end while
end sub

function NowMs() as integer
    return m.clock.TotalMilliseconds()
end function

sub PollTVTimeStatus(scene as object, serverAddress as string)
    '
    ' Poll the backend server for TV time status
    ' Updates the scene with the response
    '
    
    status = FetchTVTimeStatus(serverAddress)
    
    if status.success
        print "Status: " + status.timeRemaining.ToStr() + " minutes remaining. Limit hit: " + status.limitHit.ToStr()
        scene.timeRemaining = status.timeRemaining
        scene.isLimitHit = status.limitHit
        scene.error = ""
    else
        print "Failed to fetch status: " + status.error
        scene.error = status.error
        scene.discovering = false
    end if
end sub

