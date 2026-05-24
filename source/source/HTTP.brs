'*************************************************************
'** HTTP Utilities
'** Helper functions for HTTP requests to TV-TIME backend
'*************************************************************

function FetchTVTimeStatus(serverAddress as string) as object
    '
    ' Fetch TV time status from the backend server
    ' @param serverAddress - server address with port (e.g., "192.168.1.100:8080")
    ' @return object with status info or invalid on error
    '
    
    statusObj = {
        success: false,
        timeRemaining: 0,
        dailyLimitMinutes: 0,
        limitHit: false,
        error: ""
    }
    
    try
        url = "http://" + serverAddress + "/api/status/limit"
        http = CreateObject("roUrlTransfer")
        http.SetUrl(url)
        
        responseCode = http.GetToString()
        
        if responseCode = ""
            statusObj.error = "Empty response from " + url
            return statusObj
        end if
        
        ' Parse JSON response
        ' Expected format: {"todayUsageMinutes": 40, "dailyLimitMinutes": 120, "limitExceeded": false}
        json = ParseJson(responseCode)
        
        if json <> invalid
            ' Calculate time remaining from daily limit and usage
            if json.DoesExist("dailyLimitMinutes") and json.DoesExist("todayUsageMinutes")
                dailyLimit = json.dailyLimitMinutes
                todayUsage = json.todayUsageMinutes
                statusObj.dailyLimitMinutes = dailyLimit
                statusObj.timeRemaining = dailyLimit - todayUsage
                if statusObj.timeRemaining < 0
                    statusObj.timeRemaining = 0
                end if
            end if
            
            ' Map limitExceeded to limitHit
            if json.DoesExist("limitExceeded")
                statusObj.limitHit = json.limitExceeded
            else if json.DoesExist("dailyLimitMinutes") and json.DoesExist("todayUsageMinutes")
                statusObj.limitHit = todayUsage >= dailyLimit
            end if
            
            statusObj.success = true
        else
            statusObj.error = "Invalid JSON response"
        end if
        
    catch e
        statusObj.error = "Connection failed: " + e.Message
    end try
    
    return statusObj
end function
