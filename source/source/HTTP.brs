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
        limitHit: false,
        error: ""
    }
    
    try
        url = "http://" + serverAddress + "/api/status/limit"
        http = CreateObject("roUrlTransfer")
        http.SetUrl(url)
        http.SetTimeout(3000)
        
        responseCode = http.GetToString()
        httpCode = http.GetResponseCode()
        
        if httpCode <> 200
            statusObj.error = "Server returned HTTP " + httpCode.ToStr()
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
                statusObj.timeRemaining = dailyLimit - todayUsage
            end if
            
            ' Map limitExceeded to limitHit
            if json.DoesExist("limitExceeded")
                statusObj.limitHit = json.limitExceeded
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

function ParseJson(jsonString as string) as object
    '
    ' Simple JSON parser for basic objects
    ' @param jsonString - JSON string to parse
    ' @return object or invalid
    '
    
    try
        ' Remove whitespace
        json = jsonString.Trim()
        
        ' Create a simple associative array
        result = {}
        
        ' Find the opening brace
        if json.Left(1) <> "{"
            return invalid
        end if
        
        ' Remove outer braces
        json = json.Mid(2, json.Len() - 2)
        
        ' Split by comma (basic approach - doesn't handle nested objects)
        pairs = json.Split(",")
        
        for each pair in pairs
            pair = pair.Trim()
            colonPos = pair.Instr(":")
            
            if colonPos > 0
                key = pair.Left(colonPos - 1).Trim()
                value = pair.Mid(colonPos + 1).Trim()
                
                ' Remove quotes from key
                key = key.Replace("""", "")
                
                ' Parse value
                if value = "true"
                    result[key] = true
                else if value = "false"
                    result[key] = false
                else if value.Left(1) = """"
                    ' String value
                    result[key] = value.Mid(2, value.Len() - 2)
                else
                    ' Try to parse as number
                    if value.Match("^\d+$")
                        result[key] = val(value)
                    else
                        result[key] = value
                    end if
                end if
            end if
        end for
        
        return result
        
    catch e
        return invalid
    end try
end function
