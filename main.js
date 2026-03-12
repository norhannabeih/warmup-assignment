const fs = require("fs");

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

function getActiveTime(shiftDuration, idleTime) {

    function toSec(t){
        let [h,m,s]=t.split(":").map(Number)
        return h*3600+m*60+s
    }

    let shift = toSec(shiftDuration)
    let idle = toSec(idleTime)

    let active = shift-idle

    let h=Math.floor(active/3600)
    active%=3600
    let m=Math.floor(active/60)
    let s=active%60

    return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
}


function metQuota(date, activeTime) {

    function toSec(t){
        let [h,m,s]=t.split(":").map(Number)
        return h*3600+m*60+s
    }

    let active = toSec(activeTime)

    let [y,m,d] = date.split("-").map(Number)

    let required

    if(y==2025 && m==4 && d>=10 && d<=30){
        required = 6*3600
    }else{
        required = 8*3600 + 24*60
    }

    return active >= required
}

function addShiftRecord(textFile, shiftObj) {
    let duration = getShiftDuration(shiftObj.startTime,shiftObj.endTime)
    let idle = getIdleTime(shiftObj.startTime,shiftObj.endTime)
    let active = getActiveTime(duration,idle)
    let quota = metQuota(shiftObj.date,active)

    let record = {
        driverID: shiftObj.driverID,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: duration,
        idleTime: idle,
        activeTime: active,
        metQuota: quota,
        hasBonus: false,
        notes: ""
    }

    let line = Object.values(record).join(",")

    let data = fs.readFileSync(textFile,"utf8").trim()

    fs.writeFileSync(textFile,data+"\n"+line)

    return record
}


function setBonus(textFile, driverID, date, newValue) {
    
}

function countBonusPerMonth(textFile, driverID, month) {

}


function getTotalActiveHoursPerMonth(textFile, driverID, month) {

}


function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
}


function getNetPay(driverID, actualHours, requiredHours, rateFile) {

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
