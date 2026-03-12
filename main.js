const fs = require("fs");

// ============ HELPER FUNCTIONS ============

// Helper function to convert time string (hh:mm:ss) to total seconds
function timeToSeconds(timeStr) {
    if (!timeStr || timeStr === '') return 0;
    const parts = timeStr.split(':');
    if (parts.length !== 3) return 0;
    const [hours, minutes, seconds] = parts.map(Number);
    return (hours || 0) * 3600 + (minutes || 0) * 60 + (seconds || 0);
}

// Helper function to format seconds to hh:mm:ss (with padding)
function secondsToTime(seconds, padHours = true) {
    if (seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (padHours) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } else {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
}

// Helper function to convert 12-hour time to total seconds
function parse12HourTime(timeStr) {
    timeStr = timeStr.toLowerCase().trim();
    const [time, period] = timeStr.split(" ");
    let [h, m, s] = time.split(":").map(Number);

    if (period == "pm" && h != 12) h += 12;
    if (period == "am" && h == 12) h = 0;

    return h * 3600 + m * 60 + s;
}

// Helper function to get day of week from date
function getDayOfWeek(dateStr) {
    const date = new Date(dateStr + 'T12:00:00Z');
    const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    return days[date.getUTCDay()];
}

// ============ MAIN FUNCTIONS ============

// Function 1: getShiftDuration
function getShiftDuration(startTime, endTime) {

    function convert(t){
        t = t.toLowerCase().trim()

        let [time,period] = t.split(" ")
        let [h,m,s] = time.split(":").map(Number)

        if(period=="pm" && h!=12) h+=12
        if(period=="am" && h==12) h=0

        return h*3600 + m*60 + s
    }

    let start = convert(startTime)
    let end = convert(endTime)

    let diff = end - start

    let h = Math.floor(diff/3600)
    diff %= 3600
    let m = Math.floor(diff/60)
    let s = diff%60

    return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`

}


// Function 2: getIdleTime
function getIdleTime(startTime, endTime) {
    function convert(t){
        t=t.toLowerCase().trim()
        let [time,p]=t.split(" ")
        let [h,m,s]=time.split(":").map(Number)

        if(p=="pm" && h!=12) h+=12
        if(p=="am" && h==12) h=0

        return h*3600+m*60+s
    }

    let start = convert(startTime)
    let end = convert(endTime)

    let workStart = 8*3600
    let workEnd = 22*3600

    let idle = 0

    if(start < workStart){
        idle += Math.min(end,workStart) - start
    }

    if(end > workEnd){
        idle += end - Math.max(start,workEnd)
    }

    let h=Math.floor(idle/3600)
    idle%=3600
    let m=Math.floor(idle/60)
    let s=idle%60

    return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
}


// Function 3: getActiveTime
function getActiveTime(shiftDuration, idleTime) {
    let shift = timeToSeconds(shiftDuration);
    let idle = timeToSeconds(idleTime);

    let active = Math.max(0, shift - idle);

    let h = Math.floor(active / 3600);
    active %= 3600;
    let m = Math.floor(active / 60);
    let s = active % 60;

    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Function 4: metQuota
function metQuota(date, activeTime) {
    let active = timeToSeconds(activeTime);
    let [y, m, d] = date.split("-").map(Number);

    let required;

    if (y == 2025 && m == 4 && d >= 10 && d <= 30) {
        required = 6 * 3600;
    } else {
        required = 8 * 3600 + 24 * 60;
    }

    return active >= required;
}

// Function 5: addShiftRecord
function addShiftRecord(textFile, shiftObj) {
    let data = fs.readFileSync(textFile, "utf8").trim();
    let lines = data.split("\n").filter(line => line.trim() !== '');

    // Check for duplicate (same driverID and date)
    for (let line of lines) {
        let p = line.split(",");
        if (p.length >= 3 && p[0] == shiftObj.driverID && p[2] == shiftObj.date) {
            return {};
        }
    }

    let duration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idle = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let active = getActiveTime(duration, idle);
    let quota = metQuota(shiftObj.date, active);

    // Find insertion point (after last record of same driverID)
    let insertIndex = lines.length;
    for (let i = lines.length - 1; i >= 0; i--) {
        let p = lines[i].split(",");
        if (p[0] === shiftObj.driverID) {
            insertIndex = i + 1;
            break;
        }
    }

    let newRecord = {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: duration,
        idleTime: idle,
        activeTime: active,
        metQuota: quota,
        hasBonus: false
    };

    let newLine = Object.values(newRecord).join(",");
    
    // Insert at appropriate position
    lines.splice(insertIndex, 0, newLine);
    fs.writeFileSync(textFile, lines.join("\n") + (lines.length > 0 ? "\n" : ""));

    return newRecord;
}

// Function 6: setBonus
function setBonus(textFile, driverID, date, newValue) {
    const data = fs.readFileSync(textFile, 'utf8');
    const lines = data.split('\n');
    
    let updated = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue;
        
        const fields = line.split(',');
        if (fields.length >= 10 && fields[0] === driverID && fields[2] === date) {
            fields[9] = newValue.toString();
            lines[i] = fields.join(',');
            updated = true;
            break;
        }
    }
    
    if (updated) {
        fs.writeFileSync(textFile, lines.join('\n'));
    }
}

// Function 7: countBonusPerMonth
function countBonusPerMonth(textFile, driverID, month) {
    const monthStr = month.toString().padStart(2, '0');
    
    try {
        const data = fs.readFileSync(textFile, 'utf8');
        const lines = data.trim().split('\n').filter(line => line.trim() !== '');
        
        let driverExists = false;
        let bonusCount = 0;
        
        for (let line of lines) {
            const fields = line.split(',');
            
            if (fields.length >= 10 && fields[0] === driverID) {
                driverExists = true;
                
                const dateParts = fields[2].split('-');
                if (dateParts.length >= 2) {
                    const recordMonth = dateParts[1];
                    
                    if (recordMonth === monthStr) {
                        const bonusValue = fields[9].toLowerCase().trim();
                        if (bonusValue === 'true') {
                            bonusCount++;
                        }
                    }
                }
            }
        }
        
        return driverExists ? bonusCount : -1;
        
    } catch (error) {
        return -1;
    }
}

// Function 8: getTotalActiveHoursPerMonth
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    const monthStr = month.toString().padStart(2, '0');
    
    try {
        const data = fs.readFileSync(textFile, 'utf8');
        const lines = data.trim().split('\n').filter(line => line.trim() !== '');
        
        let totalSeconds = 0;
        
        for (let line of lines) {
            const fields = line.split(',');
            
            if (fields.length >= 8 && fields[0] === driverID) {
                const dateParts = fields[2].split('-');
                if (dateParts.length >= 2) {
                    const recordMonth = dateParts[1];
                    
                    if (recordMonth === monthStr) {
                        // activeTime is at index 7
                        totalSeconds += timeToSeconds(fields[7]);
                    }
                }
            }
        }
        
        return secondsToTime(totalSeconds, true);
        
    } catch (error) {
        return "00:00:00";
    }
}

// Function 9: getRequiredHoursPerMonth
// Function 9: getRequiredHoursPerMonth - COMPLETE FIXED VERSION
// Function 9: getRequiredHoursPerMonth - COMPLETELY REWRITTEN
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    try {
        // Convert month to string and pad
        const monthStr = month.toString().padStart(2, '0');
        
        // ===== READ RATE FILE TO GET DAY OFF =====
        const rateContent = fs.readFileSync(rateFile, 'utf8');
        const rateLines = rateContent.split('\n').filter(line => line.trim() !== '');
        
        let dayOff = '';
        let driverFound = false;
        
        for (const line of rateLines) {
            const fields = line.split(',');
            if (fields.length >= 2 && fields[0].trim() === driverID) {
                dayOff = fields[1].trim();
                driverFound = true;
                break;
            }
        }
        
        if (!driverFound) {
            return "00:00:00";
        }
        
        // ===== READ SHIFT FILE =====
        const shiftContent = fs.readFileSync(textFile, 'utf8');
        const shiftLines = shiftContent.split('\n').filter(line => line.trim() !== '');
        
        // Store unique dates for this driver in the given month
        const workingDates = [];
        
        // Loop through all shift records
        for (const line of shiftLines) {
            const fields = line.split(',');
            
            // Check if this is the right driver (fields[0] is driverID)
            if (fields.length >= 8 && fields[0].trim() === driverID) {
                const dateStr = fields[2].trim(); // date is at index 2
                
                // Extract month from date (format: yyyy-mm-dd)
                const dateParts = dateStr.split('-');
                if (dateParts.length === 3) {
                    const recordMonth = dateParts[1]; // MM
                    
                    // Check if month matches
                    if (recordMonth === monthStr) {
                        // Add to working dates if not already added
                        if (!workingDates.includes(dateStr)) {
                            workingDates.push(dateStr);
                        }
                    }
                }
            }
        }
        
        // ===== CALCULATE REQUIRED HOURS =====
        let totalRequiredSeconds = 0;
        
        // For each unique working date
        for (const dateStr of workingDates) {
            // Get day of week from date
            const dateParts = dateStr.split('-');
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1; // JS months are 0-indexed
            const day = parseInt(dateParts[2]);
            
            const date = new Date(year, month, day);
            const dayOfWeekIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
            
            // Convert to day name
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayOfWeek = dayNames[dayOfWeekIndex];
            
            // Skip if it's day off
            if (dayOfWeek === dayOff) {
                continue;
            }
            
            // Check if date is in Eid period (April 10-30, 2025)
            const isEid = (year === 2025 && month === 3 && day >= 10 && day <= 30); // month 3 = April
            
            // Calculate daily required hours in seconds
            const dailyRequired = isEid ? 6 * 3600 : 8 * 3600 + 24 * 60;
            
            totalRequiredSeconds += dailyRequired;
        }
        
        // Subtract 2 hours per bonus
        totalRequiredSeconds -= bonusCount * 2 * 3600;
        
        // Ensure not negative
        totalRequiredSeconds = Math.max(0, totalRequiredSeconds);
        
        // Convert to hh:mm:ss format
        const hours = Math.floor(totalRequiredSeconds / 3600);
        const minutes = Math.floor((totalRequiredSeconds % 3600) / 60);
        const seconds = totalRequiredSeconds % 60;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
    } catch (error) {
        console.error('Error in getRequiredHoursPerMonth:', error);
        return "00:00:00";
    }
}

// Function 10: getNetPay
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    try {
        // Read rate file
        const rateData = fs.readFileSync(rateFile, 'utf8');
        const rateLines = rateData.trim().split('\n').filter(line => line.trim() !== '');
        
        let basePay = 0;
        let tier = 0;
        
        for (let line of rateLines) {
            const fields = line.split(',');
            if (fields.length >= 4 && fields[0] === driverID) {
                basePay = parseInt(fields[2]);
                tier = parseInt(fields[3]);
                break;
            }
        }
        
        if (basePay === 0) return 0;
        
        // Convert times to seconds
        const actualSeconds = timeToSeconds(actualHours);
        const requiredSeconds = timeToSeconds(requiredHours);
        
        // If actual hours >= required hours, no deduction
        if (actualSeconds >= requiredSeconds) {
            return basePay;
        }
        
        // Calculate missing seconds
        const missingSeconds = requiredSeconds - actualSeconds;
        
        // Allowed missing hours based on tier
        const allowedMissingMap = {
            1: 50 * 3600,  // Senior: 50 hours
            2: 20 * 3600,  // Regular: 20 hours
            3: 10 * 3600,  // Junior: 10 hours
            4: 3 * 3600    // Trainee: 3 hours
        };
        
        const allowedMissingSeconds = allowedMissingMap[tier] || 0;
        
        // Calculate billable missing seconds (after allowance)
        const billableMissingSeconds = Math.max(0, missingSeconds - allowedMissingSeconds);
        
        // Only full hours count
        const billableMissingHours = Math.floor(billableMissingSeconds / 3600);
        
        // Calculate deduction rate (basePay / 185, rounded down)
        const deductionRatePerHour = Math.floor(basePay / 185);
        
        // Calculate deduction
        const deduction = billableMissingHours * deductionRatePerHour;
        
        // Calculate net pay
        const netPay = basePay - deduction;
        
        return netPay;
        
    } catch (error) {
        return 0;
    }
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};