const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// THAY THẾ API CŨ BẰNG API GỐC MỚI
// ============================================
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/lite-sessions?cp=R&cl=R&pf=web&at=fa2eaf73a676b982e7471927c1e0293b";

app.use(cors());
app.use(express.json());

// ============================================
// KHỞI TẠO BIẾN TOÀN CỤC (DÙNG CHO CẢ HAI BỘ THUẬT TOÁN)
// ============================================
let gameHistory = [];          // lịch sử phiên dạng { session, result, totalScore, d1, d2, d3, timestamp }
let predictionLog = [];        // log dự đoán cho feedback
let totalPredictions = 0;
let totalCorrect = 0;

// Biến cho predictionAlgorithmsAll
let modelPredictions = {
    trend: {},
    short: {},
    mean: {},
    switch: {},
    bridge: {}
};

// ============================================
// CODE THUẬT TOÁN TỪ FILE "Thuật toán api.js" (ĐÃ LƯỢC BỎ localStorage)
// ============================================
let permanentStorage = {
    cauMemory: {},
    diceMemory: {},
    scoreMemory: {},
    patternMemory: {},
    betMemory: {},
    statsMemory: {},
    lastSave: 0,
    totalSessions: 0
};

let cauMemoryBank = {
    biet: { Tai: {}, Xiu: {}, stats: { maxTai: 0, maxXiu: 0, avgTai: 0, avgXiu: 0, totalBietTai: 0, totalBietXiu: 0 } },
    c11: { patterns: {}, stats: { total: 0, maxLength: 0, breakRate: {} } },
    c22: { patterns: {}, stats: { total: 0, maxLength: 0, phaseAccuracy: {} } },
    c33: { patterns: {}, stats: { total: 0, maxLength: 0, phaseAccuracy: {} } },
    c123: { patterns: {}, stats: { total: 0, phaseHits: {} } },
    c321: { patterns: {}, stats: { total: 0, phaseHits: {} } },
    doiXung: { patterns: {}, stats: { total: 0, accuracy: 0 } },
    bacThang: { tang: {}, giam: {}, stats: { totalTang: 0, totalGiam: 0 } },
    tamGiac: { patterns: {}, stats: { total: 0, complete: 0 } },
    bietKep: { patterns: {}, stats: { total: 0, sameLength: 0, diffLength: 0 } },
    zigzag: { patterns: {}, stats: { total: 0, avgAmplitude: 0 } },
    nem: { patterns: {}, stats: { tang: 0, giam: 0, fakeouts: 0 } },
    co: { patterns: {}, stats: { tang: 0, giam: 0, continues: 0 } },
    hcn: { patterns: {}, stats: { total: 0, breakouts: 0 } },
    vaiDauVai: { patterns: {}, stats: { total: 0, accuracy: 0 } },
    haiDinh: { patterns: {}, stats: { total: 0, accuracy: 0 } },
    haiDay: { patterns: {}, stats: { total: 0, accuracy: 0 } },
    elliot: { patterns: {}, stats: { waves: {}, accuracy: 0 } },
    diamond: { patterns: {}, stats: { total: 0, accuracy: 0 } },
    beCau: { signals: {}, stats: { total: 0, accuracy: 0, byLength: {} } },
    betDai: { signals: {}, stats: { total: 0, accuracy: 0, byLength: {} } },
    diDeu: { patterns: {}, stats: { total: 0, accuracy: 0 } }
};

let diceMemoryBank = {
    x1: {1:0,2:0,3:0,4:0,5:0,6:0, stats: {mean:0, median:0, mode:0, std:0, hot:0, cold:0}},
    x2: {1:0,2:0,3:0,4:0,5:0,6:0, stats: {mean:0, median:0, mode:0, std:0, hot:0, cold:0}},
    x3: {1:0,2:0,3:0,4:0,5:0,6:0, stats: {mean:0, median:0, mode:0, std:0, hot:0, cold:0}},
    tong: {3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0,13:0,14:0,15:0,16:0,17:0,18:0, stats: {mean:0, median:0, mode:0}},
    cap12: {matrix: {}, stats: {}},
    cap23: {matrix: {}, stats: {}},
    cap13: {matrix: {}, stats: {}},
    triple: {matrix: {}, stats: {total:0, uniqueTriples:0}},
    highLow: {HHH:0,HHL:0,HLH:0,HLL:0,LHH:0,LHL:0,LLH:0,LLL:0},
    oddEven: {CCC:0,CCL:0,CLC:0,CLL:0,LCC:0,LCL:0,LLC:0,LLL:0},
    prime: {0:0,1:0,2:0,3:0},
    chenhLech: {0:0,1:0,2:0,3:0,4:0,5:0},
    tongCap: {
        x1x2: {2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0},
        x2x3: {2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0},
        x1x3: {2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0}
    },
    transition: {
        x1: Array.from({length:7}, (_,i) => i===0?null:{1:0,2:0,3:0,4:0,5:0,6:0}),
        x2: Array.from({length:7}, (_,i) => i===0?null:{1:0,2:0,3:0,4:0,5:0,6:0}),
        x3: Array.from({length:7}, (_,i) => i===0?null:{1:0,2:0,3:0,4:0,5:0,6:0})
    },
    tripleTransition: {},
    diceStreaks: { x1: {}, x2: {}, x3: {} },
    predictionHistory: { byTriple: {correct:0, wrong:0}, byTransition: {correct:0, wrong:0}, byHighLow: {correct:0, wrong:0}, byOddEven: {correct:0, wrong:0} }
};

let patternMemoryBank = {
    p3: {}, p4: {}, p5: {}, p6: {}, p7: {}, p8: {}, p9: {}, p10: {}, p12: {}, p15: {}, p20: {},
    patternNext: {}, patternAfter: {}, topPatterns: [], patternClusters: {}, lastUpdate: 0
};

let scoreMemoryBank = {
    afterScore: {}, afterScoreResult: {}, scoreZones: { ratThap:0, thap:0, trungBinh:0, cao:0, ratCao:0 },
    zoneTransitions: {}, movingAvg: { MA5:[], MA10:[], MA20:[], MA50:[] },
    momentum: { strongUp:0, weakUp:0, flat:0, weakDown:0, strongDown:0 },
    volatility: { thap:0, trungbinh:0, cao:0 },
    specialScores: { tong3:0, tong4:0, tong17:0, tong18:0 },
    scoreCycles: {}
};

let betMemoryBank = {
    betHistory: [], successBets: [], failBets: [], optimalEntry: {}, optimalExit: {},
    betStats: { totalBets:0, totalWins:0, totalLosses:0, winRate:0, avgWin:0, avgLoss:0, bestWinStreak:0, bestLoseStreak:0, byHour:{}, byDay:{}, byMonth:{} }
};

// Hàm lưu (bỏ qua localStorage, chỉ cập nhật permanentStorage)
function saveToPermanentStorage() { /* no-op trong môi trường server */ }
function loadFromPermanentStorage() { return false; }
function cleanOldBackups() {}

function initUltimateSystemV3() { console.log('ULTIMATE SYSTEM V3 INITIALIZED (RAM mode)'); }
initUltimateSystemV3();

function addSessionV3(session, result, totalScore, d1, d2, d3) {
    gameHistory.push({ session, result, totalScore, d1, d2, d3, timestamp: Date.now() });
    updateDiceMemoryV3(d1, d2, d3, totalScore);
    updateScoreMemoryV3(totalScore, result);
    updateCauMemoryV3(result, totalScore);
    updatePatternMemoryV3(result);
    updateBetMemoryV3(result, totalScore);
    if (gameHistory.length % 100 === 0) recalculateAllStatsV3();
    if (gameHistory.length > 900000) gameHistory = gameHistory.slice(-800000);
}

function updateDiceMemoryV3(d1, d2, d3, total) {
    diceMemoryBank.x1[d1]++; diceMemoryBank.x2[d2]++; diceMemoryBank.x3[d3]++; diceMemoryBank.tong[total]++;
    let p12 = d1+''+d2; let p23 = d2+''+d3; let p13 = d1+''+d3;
    diceMemoryBank.cap12.matrix[p12] = (diceMemoryBank.cap12.matrix[p12]||0)+1;
    diceMemoryBank.cap23.matrix[p23] = (diceMemoryBank.cap23.matrix[p23]||0)+1;
    diceMemoryBank.cap13.matrix[p13] = (diceMemoryBank.cap13.matrix[p13]||0)+1;
    let triple = d1+''+d2+''+d3;
    diceMemoryBank.triple.matrix[triple] = (diceMemoryBank.triple.matrix[triple]||0)+1;
    diceMemoryBank.triple.stats.total++; diceMemoryBank.triple.stats.uniqueTriples = Object.keys(diceMemoryBank.triple.matrix).length;
    let hl = (d1>=4?'H':'L')+(d2>=4?'H':'L')+(d3>=4?'H':'L');
    diceMemoryBank.highLow[hl] = (diceMemoryBank.highLow[hl]||0)+1;
    let oe = (d1%2===0?'C':'L')+(d2%2===0?'C':'L')+(d3%2===0?'C':'L');
    diceMemoryBank.oddEven[oe] = (diceMemoryBank.oddEven[oe]||0)+1;
    let primeCount = [d1,d2,d3].filter(x=>[2,3,5].includes(x)).length;
    diceMemoryBank.prime[primeCount]++;
    let chenh = Math.max(d1,d2,d3) - Math.min(d1,d2,d3);
    diceMemoryBank.chenhLech[chenh]++;
    diceMemoryBank.tongCap.x1x2[d1+d2]++; diceMemoryBank.tongCap.x2x3[d2+d3]++; diceMemoryBank.tongCap.x1x3[d1+d3]++;
    let n = gameHistory.length;
    if (n >= 2) {
        let prev = gameHistory[n-2];
        if (diceMemoryBank.transition.x1[prev.d1]) diceMemoryBank.transition.x1[prev.d1][d1]++;
        if (diceMemoryBank.transition.x2[prev.d2]) diceMemoryBank.transition.x2[prev.d2][d2]++;
        if (diceMemoryBank.transition.x3[prev.d3]) diceMemoryBank.transition.x3[prev.d3][d3]++;
        let prevTriple = prev.d1+''+prev.d2+''+prev.d3;
        let key = prevTriple+'_to_'+triple;
        diceMemoryBank.tripleTransition[key] = (diceMemoryBank.tripleTransition[key]||0)+1;
    }
    updateDiceStreaksV3(d1, d2, d3);
    updateDiceStatsV3();
}

function updateDiceStreaksV3(d1, d2, d3) {
    if (!diceMemoryBank.diceStreaks.x1[d1]) diceMemoryBank.diceStreaks.x1[d1] = {};
    if (!diceMemoryBank.diceStreaks.x2[d2]) diceMemoryBank.diceStreaks.x2[d2] = {};
    if (!diceMemoryBank.diceStreaks.x3[d3]) diceMemoryBank.diceStreaks.x3[d3] = {};
    let streak1=1, streak2=1, streak3=1;
    for (let i=gameHistory.length-2; i>=0; i--) { if (gameHistory[i].d1===d1) streak1++; else break; }
    for (let i=gameHistory.length-2; i>=0; i--) { if (gameHistory[i].d2===d2) streak2++; else break; }
    for (let i=gameHistory.length-2; i>=0; i--) { if (gameHistory[i].d3===d3) streak3++; else break; }
    diceMemoryBank.diceStreaks.x1[d1][Math.min(streak1,20)] = (diceMemoryBank.diceStreaks.x1[d1][Math.min(streak1,20)]||0)+1;
    diceMemoryBank.diceStreaks.x2[d2][Math.min(streak2,20)] = (diceMemoryBank.diceStreaks.x2[d2][Math.min(streak2,20)]||0)+1;
    diceMemoryBank.diceStreaks.x3[d3][Math.min(streak3,20)] = (diceMemoryBank.diceStreaks.x3[d3][Math.min(streak3,20)]||0)+1;
}

function updateDiceStatsV3() {
    let calcStats = (obj) => {
        let values = [];
        for (let key in obj) if (key !== 'stats') for (let i=0; i<obj[key]; i++) values.push(parseInt(key));
        if (values.length === 0) return {mean:0, median:0, mode:0, std:0, hot:0, cold:0};
        values.sort((a,b)=>a-b);
        let mean = values.reduce((a,b)=>a+b,0)/values.length;
        let median = values[Math.floor(values.length/2)];
        let freq = {}; values.forEach(v=>freq[v]=(freq[v]||0)+1);
        let mode = parseInt(Object.entries(freq).sort((a,b)=>b[1]-a[1])[0][0]);
        let variance = values.reduce((a,b)=>a+Math.pow(b-mean,2),0)/values.length;
        let std = Math.sqrt(variance);
        let hot = parseInt(Object.entries(freq).sort((a,b)=>b[1]-a[1])[0][0]);
        let cold = parseInt(Object.entries(freq).sort((a,b)=>a[1]-b[1])[0][0]);
        return {mean, median, mode, std, hot, cold};
    };
    diceMemoryBank.x1.stats = calcStats(diceMemoryBank.x1);
    diceMemoryBank.x2.stats = calcStats(diceMemoryBank.x2);
    diceMemoryBank.x3.stats = calcStats(diceMemoryBank.x3);
    let tongValues = [];
    for (let t=3; t<=18; t++) for (let i=0; i<diceMemoryBank.tong[t]; i++) tongValues.push(t);
    if (tongValues.length > 0) {
        tongValues.sort((a,b)=>a-b);
        diceMemoryBank.tong.stats.mean = tongValues.reduce((a,b)=>a+b,0)/tongValues.length;
        diceMemoryBank.tong.stats.median = tongValues[Math.floor(tongValues.length/2)];
        let freq = {}; tongValues.forEach(v=>freq[v]=(freq[v]||0)+1);
        diceMemoryBank.tong.stats.mode = parseInt(Object.entries(freq).sort((a,b)=>b[1]-a[1])[0][0]);
    }
}

function updateScoreMemoryV3(total, result) {
    let n = gameHistory.length;
    if (n >= 2) {
        let prevScore = gameHistory[n-2].totalScore;
        if (!scoreMemoryBank.afterScore[prevScore]) { scoreMemoryBank.afterScore[prevScore] = {}; for (let i=3;i<=18;i++) scoreMemoryBank.afterScore[prevScore][i]=0; }
        scoreMemoryBank.afterScore[prevScore][total]++;
        if (!scoreMemoryBank.afterScoreResult[prevScore]) scoreMemoryBank.afterScoreResult[prevScore] = {Tai:0, Xiu:0};
        scoreMemoryBank.afterScoreResult[prevScore][result]++;
    }
    if (total >= 14) scoreMemoryBank.scoreZones.ratCao++;
    else if (total >= 11) scoreMemoryBank.scoreZones.cao++;
    else if (total >= 8) scoreMemoryBank.scoreZones.trungBinh++;
    else if (total >= 5) scoreMemoryBank.scoreZones.thap++;
    else scoreMemoryBank.scoreZones.ratThap++;
    if (n >= 2) {
        let prevScore = gameHistory[n-2].totalScore;
        let prevZone = getScoreZoneV3(prevScore);
        let currZone = getScoreZoneV3(total);
        let key = prevZone+'_'+currZone;
        scoreMemoryBank.zoneTransitions[key] = (scoreMemoryBank.zoneTransitions[key]||0)+1;
    }
    if (total === 3) scoreMemoryBank.specialScores.tong3++;
    if (total === 4) scoreMemoryBank.specialScores.tong4++;
    if (total === 17) scoreMemoryBank.specialScores.tong17++;
    if (total === 18) scoreMemoryBank.specialScores.tong18++;
    if (n >= 5) { let avg5 = gameHistory.slice(-5).map(h=>h.totalScore).reduce((a,b)=>a+b,0)/5; scoreMemoryBank.movingAvg.MA5.push(avg5); if (scoreMemoryBank.movingAvg.MA5.length > 10000) scoreMemoryBank.movingAvg.MA5.shift(); }
    if (n >= 10) { let avg10 = gameHistory.slice(-10).map(h=>h.totalScore).reduce((a,b)=>a+b,0)/10; scoreMemoryBank.movingAvg.MA10.push(avg10); if (scoreMemoryBank.movingAvg.MA10.length > 10000) scoreMemoryBank.movingAvg.MA10.shift(); }
    if (n >= 20) { let avg20 = gameHistory.slice(-20).map(h=>h.totalScore).reduce((a,b)=>a+b,0)/20; scoreMemoryBank.movingAvg.MA20.push(avg20); if (scoreMemoryBank.movingAvg.MA20.length > 5000) scoreMemoryBank.movingAvg.MA20.shift(); }
}

function getScoreZoneV3(score) {
    if (score >= 14) return 'ratCao';
    if (score >= 11) return 'cao';
    if (score >= 8) return 'trungBinh';
    if (score >= 5) return 'thap';
    return 'ratThap';
}

function updateCauMemoryV3(result, totalScore) {
    let n = gameHistory.length;
    if (n < 3) return;
    let results = gameHistory.map(h=>h.result);
    let streak = 1;
    for (let i=n-2; i>=0; i--) { if (results[i]===result) streak++; else break; }
    if (streak >= 3) {
        if (result==='Tài') { cauMemoryBank.biet.Tai[streak] = (cauMemoryBank.biet.Tai[streak]||0)+1; cauMemoryBank.biet.stats.totalBietTai++; if (streak > cauMemoryBank.biet.stats.maxTai) cauMemoryBank.biet.stats.maxTai = streak; }
        else { cauMemoryBank.biet.Xiu[streak] = (cauMemoryBank.biet.Xiu[streak]||0)+1; cauMemoryBank.biet.stats.totalBietXiu++; if (streak > cauMemoryBank.biet.stats.maxXiu) cauMemoryBank.biet.stats.maxXiu = streak; }
    }
    if (n >= 6) {
        let last6 = results.slice(-6);
        let is11 = true;
        for (let i=1; i<6; i++) { if (last6[i]===last6[i-1]) { is11=false; break; } }
        if (is11) { let pattern = last6.join(','); cauMemoryBank.c11.patterns[pattern] = (cauMemoryBank.c11.patterns[pattern]||0)+1; cauMemoryBank.c11.stats.total++; }
    }
    if (n >= 8) {
        let last8 = results.slice(-8);
        let is22 = true;
        for (let i=0; i<8; i+=2) { if (last8[i]!==last8[i+1]) { is22=false; break; } }
        if (is22 && last8[0]!==last8[2]) { let pattern = last8.join(','); cauMemoryBank.c22.patterns[pattern] = (cauMemoryBank.c22.patterns[pattern]||0)+1; cauMemoryBank.c22.stats.total++; }
    }
}

function updatePatternMemoryV3(result) {
    let n = gameHistory.length;
    if (n < 3) return;
    let r = result==='Tài'?'T':'X';
    let results = gameHistory.map(h=>h.result==='Tài'?'T':'X');
    for (let len of [3,4,5,6,7,8,9,10,12,15,20]) {
        if (n >= len) { let pattern = results.slice(-len).join(''); let key = 'p'+len; if (!patternMemoryBank[key]) patternMemoryBank[key] = {}; patternMemoryBank[key][pattern] = (patternMemoryBank[key][pattern]||0)+1; }
    }
    for (let len of [3,4,5,6,7,8,9,10]) {
        if (n > len) { let pattern = results.slice(-len-1,-1).join(''); let nextKey = pattern+'->'+r; patternMemoryBank.patternNext[nextKey] = (patternMemoryBank.patternNext[nextKey]||0)+1; }
    }
}

function updateBetMemoryV3(result, totalScore) {
    let n = gameHistory.length;
    if (n < 3) return;
    let streak = 1;
    for (let i=n-2; i>=0; i--) { if (gameHistory[i].result===result) streak++; else break; }
    if (streak >= 3) { betMemoryBank.betHistory.push({ session: gameHistory[n-1].session, result, streak, totalScore, timestamp: Date.now() }); if (betMemoryBank.betHistory.length > 1000) betMemoryBank.betHistory.shift(); }
}

function recalculateAllStatsV3() {
    updateDiceStatsV3();
    let n = gameHistory.length;
    if (n === 0) return;
    let allBietTai = Object.values(cauMemoryBank.biet.Tai).reduce((a,b)=>a+b,0);
    let allBietXiu = Object.values(cauMemoryBank.biet.Xiu).reduce((a,b)=>a+b,0);
    cauMemoryBank.biet.stats.avgTai = allBietTai > 0 ? Object.entries(cauMemoryBank.biet.Tai).reduce((a,b)=>a+parseInt(b[0])*b[1],0)/allBietTai : 0;
    cauMemoryBank.biet.stats.avgXiu = allBietXiu > 0 ? Object.entries(cauMemoryBank.biet.Xiu).reduce((a,b)=>a+parseInt(b[0])*b[1],0)/allBietXiu : 0;
}

function predictSuperV3() {
    let n = gameHistory.length;
    if (n < 5) return { prediction: Math.random()<0.5?'Tài':'Xỉu', confidence: 50, reason: 'Chưa đủ dữ liệu' };
    
    let predictions = [];
    let results = gameHistory.map(h=>h.result==='Tài'?'T':'X');
    let lastResult = gameHistory[n-1].result;
    let lastD1 = gameHistory[n-1].d1;
    let lastD2 = gameHistory[n-1].d2;
    let lastD3 = gameHistory[n-1].d3;
    let lastTriple = lastD1+''+lastD2+''+lastD3;
    let lastScore = gameHistory[n-1].totalScore;
    
    for (let len of [3,4,5,6,7,8,9,10]) {
        if (n >= len) {
            let pattern = results.slice(-len).join('');
            let nextT = patternMemoryBank.patternNext[pattern+'->T'] || 0;
            let nextX = patternMemoryBank.patternNext[pattern+'->X'] || 0;
            let total = nextT + nextX;
            if (total >= 5) {
                let probT = nextT/total;
                predictions.push({ predict: probT>0.5?'Tài':'Xỉu', confidence: Math.abs(probT-0.5)*2, source: 'p'+len, weight: 0.02*len });
            }
        }
    }
    
    let streak = 1;
    for (let i=n-2; i>=0; i--) { if (gameHistory[i].result===lastResult) streak++; else break; }
    if (streak >= 3) {
        let countLonger = 0, countThis = 0;
        for (let s=streak+1; s<=Math.min(50, cauMemoryBank.biet.stats['max'+lastResult]||50); s++) { countLonger += lastResult==='Tài' ? (cauMemoryBank.biet.Tai[s]||0) : (cauMemoryBank.biet.Xiu[s]||0); }
        countThis = lastResult==='Tài' ? (cauMemoryBank.biet.Tai[streak]||0) : (cauMemoryBank.biet.Xiu[streak]||0);
        let total = countThis + countLonger;
        if (total > 0) {
            let probContinue = countLonger/total;
            predictions.push({ predict: probContinue>0.5 ? lastResult : (lastResult==='Tài'?'Xỉu':'Tài'), confidence: Math.abs(probContinue-0.5)*2+0.3, source: 'biet', weight: 0.15 });
        }
    }
    
    if (n >= 2 && scoreMemoryBank.afterScore[lastScore]) {
        let after = scoreMemoryBank.afterScore[lastScore];
        let totalAfter = 0, taiAfter = 0;
        for (let s=3; s<=18; s++) { totalAfter += after[s]||0; if (s>=11) taiAfter += after[s]||0; }
        if (totalAfter >= 5) {
            let probT = taiAfter/totalAfter;
            predictions.push({ predict: probT>0.5?'Tài':'Xỉu', confidence: Math.abs(probT-0.5)+0.3, source: 'score', weight: 0.1 });
        }
    }
    
    let afterTriples = {};
    for (let key in diceMemoryBank.tripleTransition) { if (key.startsWith(lastTriple+'_to_')) { let nextT = key.split('_to_')[1]; afterTriples[nextT] = diceMemoryBank.tripleTransition[key]; } }
    if (Object.keys(afterTriples).length > 0) {
        let totalAfter = Object.values(afterTriples).reduce((a,b)=>a+b,0);
        let taiAfter = 0;
        for (let triple in afterTriples) { let sum = triple.split('').map(Number).reduce((a,b)=>a+b,0); if (sum>=11) taiAfter += afterTriples[triple]; }
        if (totalAfter >= 3) {
            let probT = taiAfter/totalAfter;
            predictions.push({ predict: probT>0.5?'Tài':'Xỉu', confidence: Math.abs(probT-0.5)+0.4, source: 'dice_triple', weight: 0.08 });
        }
    }
    
    let trans1 = diceMemoryBank.transition.x1[lastD1] || {};
    let trans2 = diceMemoryBank.transition.x2[lastD2] || {};
    let trans3 = diceMemoryBank.transition.x3[lastD3] || {};
    let maxD1=1, maxD2=1, maxD3=1, maxC1=0, maxC2=0, maxC3=0;
    for (let f=1; f<=6; f++) { if ((trans1[f]||0)>maxC1) { maxC1=trans1[f]||0; maxD1=f; } if ((trans2[f]||0)>maxC2) { maxC2=trans2[f]||0; maxD2=f; } if ((trans3[f]||0)>maxC3) { maxC3=trans3[f]||0; maxD3=f; } }
    let predTotal = maxD1+maxD2+maxD3;
    predictions.push({ predict: predTotal>=11?'Tài':'Xỉu', confidence: 0.55, source: 'dice_trans', weight: 0.06 });
    
    let currentHL = (lastD1>=4?'H':'L')+(lastD2>=4?'H':'L')+(lastD3>=4?'H':'L');
    let hlKeys = Object.keys(diceMemoryBank.highLow); let hlValues = Object.values(diceMemoryBank.highLow);
    let hlTotal = hlValues.reduce((a,b)=>a+b,0); let hlIdx = hlKeys.indexOf(currentHL); let nextHLIdx = (hlIdx+1) % hlKeys.length; let nextHL = hlKeys[nextHLIdx];
    let hlFreq = diceMemoryBank.highLow[nextHL] || 0;
    if (hlTotal > 0 && hlFreq/hlTotal > 0.1) { let hCount = (nextHL.match(/H/g)||[]).length; predictions.push({ predict: hCount>=2?'Tài':'Xỉu', confidence: 0.5+hlFreq/hlTotal, source: 'dice_hl', weight: 0.04 }); }
    
    let currentOE = (lastD1%2===0?'C':'L')+(lastD2%2===0?'C':'L')+(lastD3%2===0?'C':'L');
    let oeKeys = Object.keys(diceMemoryBank.oddEven); let oeValues = Object.values(diceMemoryBank.oddEven);
    let oeTotal = oeValues.reduce((a,b)=>a+b,0); let oeIdx = oeKeys.indexOf(currentOE); let nextOEIdx = (oeIdx+1) % oeKeys.length; let nextOE = oeKeys[nextOEIdx];
    let oeFreq = diceMemoryBank.oddEven[nextOE] || 0;
    if (oeTotal > 0 && oeFreq/oeTotal > 0.1) { let cCount = (nextOE.match(/C/g)||[]).length; predictions.push({ predict: cCount>=2?'Xỉu':'Tài', confidence: 0.5+oeFreq/oeTotal, source: 'dice_oe', weight: 0.04 }); }
    
    if (streak >= 7) { predictions.push({ predict: lastResult==='Tài'?'Xỉu':'Tài', confidence: 0.7 + Math.min(0.2, (streak-7)*0.03), source: 'be_cau', weight: 0.12 }); }
    
    if (scoreMemoryBank.movingAvg.MA5.length >= 2) {
        let lastMA5 = scoreMemoryBank.movingAvg.MA5[scoreMemoryBank.movingAvg.MA5.length-1];
        if (lastMA5 > 13) predictions.push({predict:'Xỉu', confidence:0.6, source:'ma5_high', weight:0.05});
        if (lastMA5 < 7) predictions.push({predict:'Tài', confidence:0.6, source:'ma5_low', weight:0.05});
    }
    
    let weightedTai = 0, weightedXiu = 0, totalWeight = 0;
    for (let pred of predictions) { let w = pred.weight * pred.confidence; if (pred.predict === 'Tài') weightedTai += w; else if (pred.predict === 'Xỉu') weightedXiu += w; totalWeight += w; }
    if (totalWeight === 0) return { prediction: Math.random()<0.5?'Tài':'Xỉu', confidence: 50, reason: 'Không đủ tín hiệu' };
    let probTai = weightedTai / totalWeight;
    if (Math.abs(probTai-0.5) < 0.04) return { prediction: 'CHO', confidence: 0, reason: 'Tín hiệu quá yếu' };
    let finalPrediction = probTai > 0.5 ? 'Tài' : 'Xỉu';
    let confidence = Math.round(Math.abs(probTai-0.5)*2*100);
    confidence = Math.max(55, Math.min(95, confidence));
    let topSources = predictions.sort((a,b)=>b.weight*b.confidence-a.weight*a.confidence).slice(0,5);
    let reason = topSources.map(s=>s.source).join(', ');
    predictionLog.push({ prediction: finalPrediction, actual: null, confidence, timestamp: Date.now(), sources: topSources });
    if (predictionLog.length > 200) predictionLog.shift();
    saveToPermanentStorage();
    return { prediction: finalPrediction, confidence, reason, totalSources: predictions.length, topSources };
}

// ============================================
// CODE THUẬT TOÁN TỪ FILE "predictionAlgorithmsAll.js"
// ============================================
function detectStreakAndBreak(history) {
    if (!history || history.length === 0) return { streak: 0, currentResult: null, breakProb: 0.0 };
    let streak = 1;
    const currentResult = history[history.length - 1].result;
    for (let i = history.length - 2; i >= 0; i--) {
        if (history[i].result === currentResult) streak++; else break;
    }
    const last20 = history.slice(-20).map(h => h.result);
    if (!last20.length) return { streak, currentResult, breakProb: 0.0 };
    const switches = last20.slice(1).reduce((count, curr, idx) => count + (curr !== last20[idx] ? 1 : 0), 0);
    const taiCount = last20.filter(r => r === 'Tài').length;
    const xiuCount = last20.filter(r => r === 'Xỉu').length;
    const imbalance = Math.abs(taiCount - xiuCount) / last20.length;
    let breakProb = 0.0;
    if (streak >= 8) breakProb = Math.min(0.6 + (switches / 20) + imbalance * 0.15, 0.9);
    else if (streak >= 5) breakProb = Math.min(0.35 + (switches / 15) + imbalance * 0.25, 0.85);
    else if (streak >= 3 && switches >= 8) breakProb = 0.3;
    return { streak, currentResult, breakProb };
}

function evaluateModelPerformance(history, modelName, lookback = 15) {
    if (!modelPredictions[modelName] || history.length < 2) return 1.0;
    lookback = Math.min(lookback, history.length - 1);
    let correctCount = 0;
    for (let i = 0; i < lookback; i++) {
        const pred = modelPredictions[modelName][history[history.length - (i + 2)].session] || 0;
        const actual = history[history.length - (i + 1)].result;
        if ((pred === 1 && actual === 'Tài') || (pred === 2 && actual === 'Xỉu')) correctCount++;
    }
    const performanceScore = lookback > 0 ? 1.0 + (correctCount - lookback / 2) / (lookback / 2) : 1.0;
    return Math.max(0.5, Math.min(1.5, performanceScore));
}

function trendAndProb(history) {
    if (!history || history.length < 5) return Math.random() < 0.5 ? 1 : 2;
    const last10 = history.slice(-10).map(h => h.result);
    const taiCount = last10.filter(r => r === 'Tài').length;
    const xiuCount = last10.filter(r => r === 'Xỉu').length;
    return taiCount > xiuCount ? 1 : 2;
}

function shortPattern(history) {
    if (!history || history.length < 5) return Math.random() < 0.5 ? 1 : 2;
    const last5 = history.slice(-5).map(h => h.result);
    let tai = 0, xiu = 0;
    for (let r of last5) if (r === 'Tài') tai++; else xiu++;
    if (tai >= 4) return 2;
    if (xiu >= 4) return 1;
    const last3 = last5.slice(-3);
    if (last3[0] === last3[1] && last3[1] === last3[2]) return last3[0] === 'Tài' ? 2 : 1;
    return tai > xiu ? 2 : 1;
}

function meanDeviation(history) {
    if (!history || history.length < 10) return Math.random() < 0.5 ? 1 : 2;
    const scores = history.slice(-20).map(h => h.totalScore);
    const avg = scores.reduce((a,b)=>a+b,0)/scores.length;
    const lastAvg = scores.slice(-5).reduce((a,b)=>a+b,0)/5;
    if (lastAvg > avg + 1.5) return 1;
    if (lastAvg < avg - 1.5) return 2;
    return Math.random() < 0.5 ? 1 : 2;
}

function recentSwitch(history) {
    if (!history || history.length < 4) return Math.random() < 0.5 ? 1 : 2;
    const last4 = history.slice(-4).map(h => h.result);
    let switches = 0;
    for (let i=1;i<4;i++) if (last4[i] !== last4[i-1]) switches++;
    if (switches === 3) return last4[last4.length-1] === 'Tài' ? 2 : 1;
    if (switches >= 2) return last4[last4.length-1] === 'Tài' ? 2 : 1;
    return last4[last4.length-1] === 'Tài' ? 1 : 2;
}

function smartBridgeBreak(history) {
    if (!history || history.length < 5) return { prediction: 0, breakProb: 0.0, reason: 'Không đủ dữ liệu để bẻ cầu' };
    const { streak, currentResult, breakProb } = detectStreakAndBreak(history);
    const last30 = history.slice(-30).map(h => h.result);
    const lastScores = history.slice(-20).map(h => h.totalScore || 0);
    let breakProbability = breakProb;
    let reason = '';
    const avgScore = lastScores.reduce((sum, score) => sum + score, 0) / (lastScores.length || 1);
    const scoreDeviation = lastScores.reduce((sum, score) => sum + Math.abs(score - avgScore), 0) / (lastScores.length || 1);
    const patternCounts = {};
    for (let i = 0; i <= last30.length - 3; i++) {
        const pattern = last30.slice(i, i + 3).join(',');
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
    }
    const mostCommonPattern = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0];
    const isStablePattern = mostCommonPattern && mostCommonPattern[1] >= 4;
    if (streak >= 7) {
        breakProbability = Math.min(breakProbability + 0.15, 0.9);
        reason = `[Bẻ Cầu] Chuỗi ${streak} ${currentResult} dài, khả năng bẻ cầu cao`;
    } else if (streak >= 4 && scoreDeviation > 3.5) {
        breakProbability = Math.min(breakProbability + 0.1, 0.85);
        reason = `[Bẻ Cầu] Biến động điểm số lớn (${scoreDeviation.toFixed(1)}), khả năng bẻ cầu tăng`;
    } else if (isStablePattern && last30.slice(-5).every(r => r === currentResult)) {
        breakProbability = Math.min(breakProbability + 0.05, 0.8);
        reason = `[Bẻ Cầu] Phát hiện mẫu lặp ${mostCommonPattern[0]}, có khả năng bẻ cầu`;
    } else {
        breakProbability = Math.max(breakProbability - 0.15, 0.15);
        reason = `[Bẻ Cầu] Không phát hiện mẫu bẻ cầu mạnh, tiếp tục theo cầu`;
    }
    let prediction = breakProbability > 0.55 ? (currentResult === 'Tài' ? 2 : 1) : (currentResult === 'Tài' ? 1 : 2);
    return { prediction, breakProb: breakProbability, reason };
}

function isBadPattern(history) {
    if (!history || history.length < 5) return false;
    const last20 = history.slice(-20).map(h => h.result);
    if (!last20.length) return false;
    const switches = last20.slice(1).reduce((count, curr, idx) => count + (curr !== last20[idx] ? 1 : 0), 0);
    const { streak } = detectStreakAndBreak(history);
    return switches >= 10 || streak >= 10;
}

function aiHtddLogic(history) {
    if (!history || history.length < 5) {
        const randomResult = Math.random() < 0.5 ? 'Tài' : 'Xỉu';
        return { prediction: randomResult, reason: '[AI] Không đủ lịch sử, dự đoán ngẫu nhiên', source: 'AI HTDD' };
    }
    const recentHistory = history.slice(-7).map(h => h.result);
    const recentScores = history.slice(-7).map(h => h.totalScore || 0);
    const taiCount = recentHistory.filter(r => r === 'Tài').length;
    const xiuCount = recentHistory.filter(r => r === 'Xỉu').length;
    if (history.length >= 5) {
        const last5 = history.slice(-5).map(h => h.result);
        if (last5.join(',') === 'Tài,Xỉu,Tài,Xỉu,Tài') return { prediction: 'Xỉu', reason: '[AI] Phát hiện mẫu 1T1X lặp → tiếp theo nên đánh Xỉu', source: 'AI HTDD' };
        if (last5.join(',') === 'Xỉu,Tài,Xỉu,Tài,Xỉu') return { prediction: 'Tài', reason: '[AI] Phát hiện mẫu 1X1T lặp → tiếp theo nên đánh Tài', source: 'AI HTDD' };
    }
    if (history.length >= 10 && history.slice(-7).every(h => h.result === 'Tài')) return { prediction: 'Xỉu', reason: '[AI] Chuỗi Tài quá dài (7 lần) → dự đoán Xỉu', source: 'AI HTDD' };
    if (history.length >= 10 && history.slice(-7).every(h => h.result === 'Xỉu')) return { prediction: 'Tài', reason: '[AI] Chuỗi Xỉu quá dài (7 lần) → dự đoán Tài', source: 'AI HTDD' };
    const avgScore = recentScores.reduce((sum, score) => sum + score, 0) / (recentScores.length || 1);
    if (avgScore > 10.5) return { prediction: 'Tài', reason: `[AI] Điểm trung bình cao (${avgScore.toFixed(1)}) → dự đoán Tài`, source: 'AI HTDD' };
    if (avgScore < 7.5) return { prediction: 'Xỉu', reason: `[AI] Điểm trung bình thấp (${avgScore.toFixed(1)}) → dự đoán Xỉu`, source: 'AI HTDD' };
    const overallTai = history.filter(h => h.result === 'Tài').length;
    const overallXiu = history.filter(h => h.result === 'Xỉu').length;
    if (Math.abs(overallTai - overallXiu) / history.length > 0.3) return { prediction: overallTai > overallXiu ? 'Xỉu' : 'Tài', reason: `[AI] Tổng thể ${overallTai > overallXiu ? 'Tài' : 'Xỉu'} chiếm đa số → dự đoán ngược lại`, source: 'AI HTDD' };
    return { prediction: taiCount > xiuCount ? 'Xỉu' : 'Tài', reason: `[AI] Gần đây ${taiCount > xiuCount ? 'Tài' : 'Xỉu'} nhiều hơn → dự đoán ngược lại`, source: 'AI HTDD' };
}

function generatePrediction(history, modelPredictionsRef) {
    modelPredictions = modelPredictionsRef;
    if (!history || history.length === 0) { return Math.random() < 0.5 ? 'Tài' : 'Xỉu'; }
    const currentIndex = history[history.length - 1].session;
    const trendPred = trendAndProb(history);
    const shortPred = shortPattern(history);
    const meanPred = meanDeviation(history);
    const switchPred = recentSwitch(history);
    const bridgePred = smartBridgeBreak(history);
    const aiPred = aiHtddLogic(history);
    modelPredictions['trend'][currentIndex] = trendPred;
    modelPredictions['short'][currentIndex] = shortPred;
    modelPredictions['mean'][currentIndex] = meanPred;
    modelPredictions['switch'][currentIndex] = switchPred;
    modelPredictions['bridge'][currentIndex] = bridgePred.prediction;
    const modelScores = {
        trend: evaluateModelPerformance(history, 'trend'),
        short: evaluateModelPerformance(history, 'short'),
        mean: evaluateModelPerformance(history, 'mean'),
        switch: evaluateModelPerformance(history, 'switch'),
        bridge: evaluateModelPerformance(history, 'bridge')
    };
    const weights = { trend: 0.2 * modelScores.trend, short: 0.2 * modelScores.short, mean: 0.25 * modelScores.mean, switch: 0.15 * modelScores.switch, bridge: 0.2 * modelScores.bridge, aihtdd: 0.2 };
    let taiScore = 0, xiuScore = 0;
    if (trendPred === 1) taiScore += weights.trend; else if (trendPred === 2) xiuScore += weights.trend;
    if (shortPred === 1) taiScore += weights.short; else if (shortPred === 2) xiuScore += weights.short;
    if (meanPred === 1) taiScore += weights.mean; else if (meanPred === 2) xiuScore += weights.mean;
    if (switchPred === 1) taiScore += weights.switch; else if (switchPred === 2) xiuScore += weights.switch;
    if (bridgePred.prediction === 1) taiScore += weights.bridge; else if (bridgePred.prediction === 2) xiuScore += weights.bridge;
    if (aiPred.prediction === 'Tài') taiScore += weights.aihtdd; else xiuScore += weights.aihtdd;
    if (isBadPattern(history)) { taiScore *= 0.85; xiuScore *= 0.85; }
    const last10Preds = history.slice(-10).map(h => h.result);
    const taiPredCount = last10Preds.filter(r => r === 'Tài').length;
    if (taiPredCount >= 7) xiuScore += 0.2;
    else if (taiPredCount <= 3) taiScore += 0.2;
    if (bridgePred.breakProb > 0.55) { if (bridgePred.prediction === 1) taiScore += 0.25; else xiuScore += 0.25; }
    return taiScore > xiuScore ? 'Xỉu' : 'Tài';
}

// ============================================
// LẤY DỮ LIỆU TỪ API GỐC & CẬP NHẬT LỊCH SỬ
// ============================================
let lastSessionId = null;
let lastFetchTime = 0;

async function fetchAndUpdateHistory() {
    try {
        const response = await axios.get(API_URL);
        let rawData = response.data;
        // Phân tích cấu trúc API trả về - giả sử dạng mảng các phiên hoặc object có data
        let sessions = [];
        if (Array.isArray(rawData)) sessions = rawData;
        else if (rawData.data && Array.isArray(rawData.data)) sessions = rawData.data;
        else if (rawData.sessions && Array.isArray(rawData.sessions)) sessions = rawData.sessions;
        else sessions = [];
        
        if (sessions.length === 0) {
            console.log("Không tìm thấy phiên nào từ API");
            return;
        }
        // Sắp xếp theo session tăng dần (giả sử session là số)
        sessions.sort((a,b) => (a.session || a.id || 0) - (b.session || b.id || 0));
        
        for (let sess of sessions) {
            const sessionId = sess.session || sess.id || sess.phien;
            if (!sessionId) continue;
            if (lastSessionId && sessionId <= lastSessionId) continue;
            
            let dice = sess.dice || sess.xuc_xac || sess.result;
            let d1, d2, d3;
            if (Array.isArray(dice) && dice.length >= 3) {
                d1 = Number(dice[0]); d2 = Number(dice[1]); d3 = Number(dice[2]);
            } else if (typeof dice === 'string' && dice.includes('-')) {
                let parts = dice.split('-');
                d1 = Number(parts[0]); d2 = Number(parts[1]); d3 = Number(parts[2]);
            } else {
                continue;
            }
            const total = d1 + d2 + d3;
            const result = total >= 11 ? "Tài" : "Xỉu";
            
            // Kiểm tra xem đã có trong gameHistory chưa
            const exists = gameHistory.some(h => h.session == sessionId);
            if (!exists) {
                addSessionV3(sessionId, result, total, d1, d2, d3);
                console.log(`Đã thêm phiên ${sessionId}: ${result} (${d1}-${d2}-${d3} = ${total})`);
                lastSessionId = sessionId;
            }
        }
        lastFetchTime = Date.now();
    } catch (err) {
        console.error("Lỗi khi fetch API:", err.message);
    }
}

// Cập nhật mỗi 5 giây
setInterval(() => { fetchAndUpdateHistory(); }, 5000);
fetchAndUpdateHistory(); // chạy lần đầu

// ============================================
// API TRẢ VỀ DỰ ĐOÁN THEO MẪU YÊU CẦU
// ============================================
app.get("/api/predict", async (req, res) => {
    try {
        if (gameHistory.length === 0) {
            return res.json({ message: "Đang tải dữ liệu lịch sử, vui lòng thử lại sau 10 giây" });
        }
        const lastSession = gameHistory[gameHistory.length - 1];
        const nextSessionId = Number(lastSession.session) + 1;
        
        // Dự đoán bằng hệ thống chính (predictSuperV3)
        const predV3 = predictSuperV3();
        let finalPrediction = predV3.prediction;
        let finalConfidence = predV3.confidence;
        let usedModel = "Ultimate V3";
        
        // Nếu dự đoán từ V3 không đủ tin cậy (<60) thì kết hợp với AI HTDD
        if (finalConfidence < 60 || finalPrediction === 'CHO') {
            const aiPred = aiHtddLogic(gameHistory);
            const combinedPred = generatePrediction(gameHistory, modelPredictions);
            // Ưu tiên AI HTDD nếu V3 yếu
            if (aiPred.prediction !== 'CHO') {
                finalPrediction = aiPred.prediction;
                finalConfidence = 65;
                usedModel = "AI HTDD + V3";
            } else {
                finalPrediction = combinedPred;
                finalConfidence = 60;
                usedModel = "Ensemble";
            }
        }
        
        // Format kết quả theo mẫu
        const responseData = {
            Id: "s2king",
            Phien: lastSession.session,
            Ket_qua: lastSession.result,
            Xuc_xac: `${lastSession.d1}-${lastSession.d2}-${lastSession.d3}`,
            Phien_hien_tai: nextSessionId,
            Du_doan: finalPrediction,
            Do_tin_cay: `${finalConfidence}%`,
            Ghi_chu: `Dựa trên ${gameHistory.length} phiên lịch sử | ${usedModel} | Độ tin cậy: ${finalConfidence}%`
        };
        res.json(responseData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: true, message: err.message });
    }
});

// Route thông tin hệ thống
app.get("/", (req, res) => {
    res.send(`
        <h2>🎲 ULTIMATE TÀI XỈU PREDICTION SYSTEM 🎲</h2>
        <p>Trạng thái: ✅ Đang chạy</p>
        <p>Số phiên đã ghi nhận: ${gameHistory.length}</p>
        <p>API endpoint: <a href="/api/predict">/api/predict</a></p>
        <p>Dữ liệu được cập nhật từ: ${API_URL}</p>
    `);
});

app.listen(PORT, () => {
    console.log(`Server đang chạy tại cổng ${PORT}`);
});