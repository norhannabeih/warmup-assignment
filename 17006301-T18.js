const fs = require("fs");

function getShiftDuration(startTime, endTime) {
    
    let [sh, sm] = startTime.split(":").map(Number);
    let [eh, em] = endTime.split(":").map(Number);

    let start = sh * 60 + sm;
    let end = eh * 60 + em;

    let diff = end - start;

    let hours = Math.floor(diff / 60);
    let minutes = diff % 60;

    return `${hours}:${minutes.toString().padStart(2,'0')}`;

}

function getIdleTime(startTime, endTime) {

    let [sh, sm] = startTime.split(":").map(Number);
    let [eh, em] = endTime.split(":").map(Number);

    let start = sh*60 + sm;
    let end = eh*60 + em;

    let idle = 0;

    let morningLimit = 8*60;
    let nightLimit = 22*60;

    if(start < morningLimit){
        idle += morningLimit - start;
    }

    if(end > nightLimit){
        idle += end - nightLimit;
    }

    let hours = Math.floor(idle/60);
    let minutes = idle%60;

    return `${hours}:${minutes.toString().padStart(2,'0')}`;

}

function getActiveTime(shiftDuration, idleTime) {

    let [sh, sm] = shiftDuration.split(":").map(Number);
    let [ih, im] = idleTime.split(":").map(Number);

    let shift = sh*60 + sm;
    let idle = ih*60 + im;

    let active = shift - idle;

    let hours = Math.floor(active/60);
    let minutes = active%60;

    return `${hours}:${minutes.toString().padStart(2,'0')}`;

}

function metQuota(date, activeTime) {

    let d = new Date(date);

    let start = new Date("2025-04-10");
    let end = new Date("2025-04-30");

    let [h,m] = activeTime.split(":").map(Number);

    let minutes = h*60 + m;

    let required;

    if(d >= start && d <= end){
        required = 6*60;
    }else{
        required = 8*60 + 24;
    }

    return minutes >= required;

}


function addShiftRecord(textFile, shiftObj) {

    let data = fs.readFileSync(textFile,"utf8");

    let lines = data.trim().split("\n");

    let duration = getShiftDuration(shiftObj.startTime,shiftObj.endTime);
    let idle = getIdleTime(shiftObj.startTime,shiftObj.endTime);
    let active = getActiveTime(duration,idle);
    let quota = metQuota(shiftObj.date,active);

    let record =
`${shiftObj.driverID},${shiftObj.date},${shiftObj.startTime},${shiftObj.endTime},${duration},${idle},${active},${quota},false`;

    lines.push(record);

    fs.writeFileSync(textFile,lines.join("\n"));

}


function setBonus(textFile, driverID, date, newValue) {

    let data = fs.readFileSync(textFile,"utf8");

    let lines = data.trim().split("\n");

    for(let i=0;i<lines.length;i++){

        let parts = lines[i].split(",");

        if(parts[0]==driverID && parts[1]==date){
            parts[8]=newValue;
            lines[i]=parts.join(",");
        }
    }

    fs.writeFileSync(textFile,lines.join("\n"));

}

function countBonusPerMonth(textFile, driverID, month) {

    let data = fs.readFileSync(textFile,"utf8");

    let lines = data.trim().split("\n");

    let count=0;
    let found=false;

    for(let line of lines){

        let parts=line.split(",");

        if(parts[0]==driverID){

            found=true;

            let m = parts[1].split("-")[1];

            if(m==month && parts[8]=="true"){
                count++;
            }
        }
    }

    if(!found) return -1;

    return count;
}

function getTotalActiveHoursPerMonth(textFile, driverID, month) {

    let data = fs.readFileSync(textFile,"utf8");

    let lines = data.trim().split("\n");

    let total=0;

    for(let line of lines){

        let parts=line.split(",");

        if(parts[0]==driverID){

            let m=parts[1].split("-")[1];

            if(m==month){

                let [h,mi]=parts[6].split(":").map(Number);

                total+=h*60+mi;
            }
        }
    }

    return total/60;

}

function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    function getRequiredHoursPerMonth(textFile,rateFile,bonusCount,driverID,month){

    let requiredPerDay=8.4;

    let days=30;

    return days*requiredPerDay - bonusCount*2;
}
}

function getNetPay(driverID, actualHours, requiredHours, rateFile) {

    let data = fs.readFileSync(rateFile,"utf8");

    let lines=data.trim().split("\n");

    let salary=0;

    for(let line of lines){

        let parts=line.split(",");

        if(parts[0]==driverID){

            salary=parseFloat(parts[3]);
        }
    }

    if(actualHours>=requiredHours){
        return salary;
    }

    let missing = requiredHours-actualHours;

    let deduction = missing*20;

    return salary-deduction;
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
