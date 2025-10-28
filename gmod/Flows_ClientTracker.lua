-- Debug print function that only outputs when developer mode is enabled
local function debugPrint(...)
    if GetConVar("developer"):GetInt() > 0 then
        print("[Flows Client]", ...)
    end
end

-- Check if timer already exists
if not timer.Exists("Flows_ClientTracker") then
    -- Create ConVar for enabling/disabling the tracker
    CreateClientConVar("flows_tracker_enabled", "1", true, false, "Enable/disable player position tracking")
    
    -- Create the tracking timer
    timer.Create("Flows_ClientTracker", 0.1, 0, function()
        -- Check if tracking is enabled
        if GetConVar("flows_tracker_enabled"):GetInt() == 0 then return end

        -- Get player and validate
        local ply = LocalPlayer()
        if not IsValid(ply) then
            debugPrint("LocalPlayer invalid")
            return
        end

        -- Get player data
        local pos = ply:GetPos()
        local vel = ply:GetVelocity()
        local ang = ply:EyeAngles()
        
        -- Create data table
        local data = {
            steamID = ply:SteamID64(),
            name = ply:Nick(),
            position = { x = pos.x, y = pos.y, z = pos.z },
            velocity = { x = vel.x, y = vel.y, z = vel.z },
            vel_len = vel:Length(),
            vel_dir = math.atan2(vel.y, vel.x),
            angles = { pitch = ang.p, yaw = ang.y, roll = ang.r }
        }
        
        -- Convert to JSON and send
        local jsonData = util.TableToJSON(data)
        debugPrint("Sending data:", jsonData)
        
        http.Post("http://127.0.0.1:3000/data",
            { data = jsonData },
            function(body) debugPrint("Data sent successfully. Response:", body) end,
            function(err) 
                debugPrint("Error sending data:", err)
                if err:match("not allowed") then
                    print("[Flows Client] IMPORTANT: Make sure http.cfg in garrysmod/cfg/ contains '127.0.0.1:3000'")
                end
            end,
            { ["Content-Type"] = "application/x-www-form-urlencoded" }
        )
    end)
end

-- Add chat command handler
hook.Add("OnPlayerChat", "Flows_ClientTracker_Commands", function(ply, text)
    if ply ~= LocalPlayer() then return end
    
    if text == "!flows_toggle" then
        local enabled = GetConVar("flows_tracker_enabled"):GetInt()
        RunConsoleCommand("flows_tracker_enabled", enabled == 1 and "0" or "1")
        print("[Flows Client] Tracking " .. (enabled == 1 and "disabled" or "enabled"))
        return true
    end
end)

print("[Flows Client] Tracker initialized. Use !flows_toggle to enable/disable tracking")