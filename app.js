const SUPABASE_URL = 'https://swalpwpdzlomxcijacnu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YWxwd3BkemxvbXhjaWphY251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDUyMzksImV4cCI6MjA4OTE4MTIzOX0.nhF05Ttgr9WonNOzrXBtleOwjkWdg6W7rE71DDg-8Y4';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentDowntimeEvents = [];
let loadedDailyRecords = [];
let downtimeChartInstance = null;
let currentExportData = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化下拉選單選項
    populateTimeSelects();

    fetchLines();
    fetchMachines();
    fetchReasons();
    
    // 2. 設定預設日期
    const today = new Date();
    document.getElementById('recordDate').valueAsDate = today;
    document.getElementById('statStartDate').valueAsDate = today;
    document.getElementById('statEndDate').valueAsDate = today;
    
    // 3. 預設開線時間 08:30
    document.getElementById('startHour').value = '08';
    document.getElementById('startMinute').value = '30';
    
    loadRecordsByDate();
});

// ================= 新增：時間下拉選單產生器 =================
function populateTimeSelects() {
    // 產生 00~23 小時
    const hours24 = Array.from({length: 24}, (_, i) => String(i).padStart(2, '0'));
    // 產生 00~59 分鐘
    const minutes60 = Array.from({length: 60}, (_, i) => String(i).padStart(2, '0'));
    
    const hourOptions = hours24.map(h => `<option value="${h}">${h}</option>`).join('');
    const minuteOptions = minutes60.map(m => `<option value="${m}">${m}</option>`).join('');
    const emptyOption = `<option value="">--</option>`;

    // 報工開線與結束
    document.getElementById('startHour').innerHTML = hourOptions;
    document.getElementById('startMinute').innerHTML = minuteOptions;
    document.getElementById('endHour').innerHTML = hourOptions;
    document.getElementById('endMinute').innerHTML = minuteOptions;
    
    // 提早結束 (允許空白)
    document.getElementById('earlyEndHour').innerHTML = emptyOption + hourOptions;
    document.getElementById('earlyEndMinute').innerHTML = emptyOption + minuteOptions;

    // 停機時間 (小時: 0~24)
    let dtHours = `<option value="0">0 小時</option>`;
    for(let i=1; i<=24; i++) dtHours += `<option value="${i}">${i} 小時</option>`;
    document.getElementById('downtimeHour').innerHTML = dtHours;

    // 停機時間 (分鐘: 0, 5, 10... 60)
    let dtMinutes = `<option value="0">0 分鐘</option>`;
    for(let i=5; i<=60; i+=5) dtMinutes += `<option value="${i}">${i} 分鐘</option>`;
    document.getElementById('downtimeMinute').innerHTML = dtMinutes;
}

// 取得自製選單的時間字串 (回傳 HH:MM 或 null)
function getSelectedTime(hourId, minuteId) {
    const h = document.getElementById(hourId).value;
    const m = document.getElementById(minuteId).value;
    if (h && m) return `${h}:${m}`;
    return null;
}

// 將資料庫的 HH:MM 設定回自製選單
function setSelectedTime(hourId, minuteId, timeString) {
    if (!timeString) {
        document.getElementById(hourId).value = '';
        document.getElementById(minuteId).value = '';
        return;
    }
    const [h, m] = timeString.split(':');
    document.getElementById(hourId).value = h;
    document.getElementById(minuteId).value = m;
}

// ================= 線別相關功能 =================
async function fetchLines() {
    const { data } = await db.from('lines').select('*').order('created_at', { ascending: true });
    const list = document.getElementById('lineList');
    const recordSelect = document.getElementById('recordLine');
    list.innerHTML = ''; recordSelect.innerHTML = '<option value="">請選擇線別</option>';
    if(!data) return;
    data.forEach(line => {
        list.innerHTML += `<li>${line.name} <div class="btn-group"><button class="edit-btn" onclick="editLine('${line.id}', '${line.name}')">編輯</button><button class="delete-btn" onclick="deleteLine('${line.id}')">刪除</button></div></li>`;
        recordSelect.innerHTML += `<option value="${line.name}">${line.name}</option>`;
    });
    const savedLine = localStorage.getItem('smtSavedLine');
    if (savedLine) recordSelect.value = savedLine;
}
async function addLine() { const name = document.getElementById('lineName').value.trim(); if (name) { await db.from('lines').insert([{ name }]); document.getElementById('lineName').value=''; fetchLines(); } }
async function editLine(id, oldName) { const newName = prompt('新線別名稱：', oldName); if (newName && newName.trim() !== oldName) { await db.from('lines').update({ name: newName.trim() }).eq('id', id); fetchLines(); } }
async function deleteLine(id) { if (confirm('確定刪除？')) { await db.from('lines').delete().eq('id', id); fetchLines(); } }

// ================= 機台相關功能 =================
async function fetchMachines() {
    const { data } = await db.from('machines').select('*').order('created_at', { ascending: true });
    const list = document.getElementById('machineList');
    const recordSelect = document.getElementById('recordMachine');
    const statSelect = document.getElementById('statMachine');
    list.innerHTML = ''; recordSelect.innerHTML = '<option value="">請選擇機台</option>'; statSelect.innerHTML = '<option value="">全部機台</option>';
    if(!data) return;
    data.forEach(m => {
        list.innerHTML += `<li>${m.name} <div class="btn-group"><button class="edit-btn" onclick="editMachine('${m.id}', '${m.name}')">編輯</button><button class="delete-btn" onclick="deleteMachine('${m.id}')">刪除</button></div></li>`;
        recordSelect.innerHTML += `<option value="${m.id}">${m.name}</option>`;
        statSelect.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    });
}
async function addMachine() { const name = document.getElementById('machineName').value.trim(); if (name) { await db.from('machines').insert([{ name }]); document.getElementById('machineName').value=''; fetchMachines(); } }
async function editMachine(id, oldName) { const newName = prompt('新機台名稱：', oldName); if (newName) { await db.from('machines').update({ name: newName.trim() }).eq('id', id); fetchMachines(); } }
async function deleteMachine(id) { if (confirm('確定刪除？')) { await db.from('machines').delete().eq('id', id); fetchMachines(); } }

// ================= 停機項目相關功能 =================
async function fetchReasons() {
    const { data } = await db.from('downtime_reasons').select('*').order('created_at', { ascending: true });
    const list = document.getElementById('reasonList');
    const select = document.getElementById('downtimeReasonSelect');
    list.innerHTML = ''; select.innerHTML = '<option value="">請選擇停機項目</option>';
    if(!data) return;
    data.forEach(r => {
        list.innerHTML += `<li>${r.name} <div class="btn-group"><button class="edit-btn" onclick="editReason('${r.id}', '${r.name}')">編輯</button><button class="delete-btn" onclick="deleteReason('${r.id}')">刪除</button></div></li>`;
        select.innerHTML += `<option value="${r.id}">${r.name}</option>`;
    });
}
async function addReason() { const name = document.getElementById('reasonName').value.trim(); if (name) { await db.from('downtime_reasons').insert([{ name }]); document.getElementById('reasonName').value=''; fetchReasons(); } }
async function editReason(id, oldName) { const newName = prompt('新停機項目名稱：', oldName); if (newName) { await db.from('downtime_reasons').update({ name: newName.trim() }).eq('id', id); fetchReasons(); } }
async function deleteReason(id) { if (confirm('確定刪除？')) { await db.from('downtime_reasons').delete().eq('id', id); fetchReasons(); } }

// ================= 每日報工表單邏輯 =================
function addDowntimeToList() {
    const select = document.getElementById('downtimeReasonSelect');
    const reasonId = select.value;
    const reasonName = select.options[select.selectedIndex].text;
    
    // 計算總分鐘數
    const hours = parseInt(document.getElementById('downtimeHour').value);
    const minutes = parseInt(document.getElementById('downtimeMinute').value);
    const totalDuration = (hours * 60) + minutes;

    if (!reasonId) return alert('請選擇停機項目！');
    if (totalDuration <= 0) return alert('停機時間必須大於 0 分鐘！');

    currentDowntimeEvents.push({ reasonId, reasonName, duration: totalDuration });
    select.value = ''; 
    document.getElementById('downtimeHour').value = '0';
    document.getElementById('downtimeMinute').value = '0';
    renderDowntimeTable();
}

function removeDowntimeFromList(index) {
    currentDowntimeEvents.splice(index, 1);
    renderDowntimeTable();
}

function renderDowntimeTable() {
    const tbody = document.getElementById('downtimeTableBody');
    tbody.innerHTML = '';
    let total = 0;
    currentDowntimeEvents.forEach((event, index) => {
        total += event.duration;
        tbody.innerHTML += `<tr><td>${event.reasonName}</td><td>${event.duration}</td><td><button class="delete-btn" onclick="removeDowntimeFromList(${index})">移除</button></td></tr>`;
    });
    document.getElementById('totalDowntimeDisplay').innerText = total;
}

// 儲存單一機台紀錄
async function submitMachineRecord() {
    const date = document.getElementById('recordDate').value;
    const line = document.getElementById('recordLine').value;
    
    // 從自製下拉選單取得時間字串
    const startTime = getSelectedTime('startHour', 'startMinute');
    const endTime = getSelectedTime('endHour', 'endMinute');
    const earlyEndTime = getSelectedTime('earlyEndHour', 'earlyEndMinute');
    
    const machineId = document.getElementById('recordMachine').value;

    if (!date || !line || !startTime || !endTime || !machineId) {
        return alert('請完整填寫上方共用資料(日期/線別/開線/結束) 以及 要儲存的機台名稱！');
    }

    localStorage.setItem('smtSavedLine', line);

    const { data: recordData, error: recordError } = await db.from('production_records').insert([{
        record_date: date,
        line_name: line,
        machine_id: machineId,
        start_time: startTime,
        end_time: endTime,
        early_end_time: earlyEndTime,
        is_rolling_break: false
    }]).select();

    if (recordError) return alert('主紀錄儲存失敗：' + recordError.message);
    const recordId = recordData[0].id;

    if (currentDowntimeEvents.length > 0) {
        const eventsToInsert = currentDowntimeEvents.map(event => ({
            record_id: recordId,
            reason_id: event.reasonId,
            duration_minutes: event.duration
        }));
        await db.from('downtime_events').insert(eventsToInsert);
    }

    alert('機台紀錄儲存成功！你可以繼續輸入下一台機台。');
    
    // 清空單一機台區塊
    document.getElementById('recordMachine').value = '';
    document.getElementById('earlyEndHour').value = '';
    document.getElementById('earlyEndMinute').value = '';
    currentDowntimeEvents = [];
    renderDowntimeTable();

    loadRecordsByDate();
}

// ================= 歷史紀錄載入與編輯 =================
async function loadRecordsByDate() {
    const date = document.getElementById('recordDate').value;
    if (!date) return;

    const { data, error } = await db.from('production_records')
        .select('*, machines(name), downtime_events(duration_minutes, downtime_reasons(id, name))')
        .eq('record_date', date)
        .order('created_at', { ascending: false });

    if (error) return console.error(error);
    loadedDailyRecords = data;
    
    const tbody = document.getElementById('dailyHistoryTable');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">本日尚無機台紀錄。</td></tr>';
        return;
    }

    data.forEach(record => {
        let totalDowntime = 0;
        if (record.downtime_events) {
            record.downtime_events.forEach(e => totalDowntime += e.duration_minutes);
        }
        
        tbody.innerHTML += `
            <tr>
                <td>${record.line_name}</td>
                <td>${record.machines.name}</td>
                <td>${record.start_time} ~ ${record.end_time}</td>
                <td>${record.early_end_time || '-'}</td>
                <td style="color:#e53e3e; font-weight:bold;">${totalDowntime}</td>
                <td>
                    <div class="btn-group" style="justify-content:center;">
                        <button class="edit-btn" onclick="editDailyRecord('${record.id}')">載入編輯</button>
                        <button class="delete-btn" onclick="deleteDailyRecord('${record.id}')">刪除</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

async function deleteDailyRecord(id) {
    if (!confirm('確定要刪除這筆機台紀錄嗎？相關停機明細也會一併刪除！')) return;
    await db.from('production_records').delete().eq('id', id);
    loadRecordsByDate();
}

async function editDailyRecord(id) {
    const record = loadedDailyRecords.find(r => r.id === id);
    if (!record) return;

    if (!confirm('準備進行編輯。\n系統會將此紀錄載入到上方表單，並移除舊紀錄，請務必在修改後點擊「儲存此機台紀錄」！')) return;

    document.getElementById('recordLine').value = record.line_name;
    document.getElementById('recordMachine').value = record.machine_id;
    
    // 設定自製下拉選單的時間
    setSelectedTime('startHour', 'startMinute', record.start_time);
    setSelectedTime('endHour', 'endMinute', record.end_time);
    setSelectedTime('earlyEndHour', 'earlyEndMinute', record.early_end_time);

    currentDowntimeEvents = [];
    if (record.downtime_events) {
        record.downtime_events.forEach(e => {
            currentDowntimeEvents.push({
                reasonId: e.downtime_reasons.id,
                reasonName: e.downtime_reasons.name,
                duration: e.duration_minutes
            });
        });
    }
    renderDowntimeTable();

    await db.from('production_records').delete().eq('id', id);
    loadRecordsByDate();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= 統計與導出邏輯 =================
function getMinutesDiff(start, end) {
    if (!start || !end) return 0;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    return (eH * 60 + eM) - (sH * 60 + sM);
}

async function queryStatistics() {
    const startDate = document.getElementById('statStartDate').value;
    const endDate = document.getElementById('statEndDate').value;
    const machineId = document.getElementById('statMachine').value;

    if (!startDate || !endDate) return alert('請選擇開始與結束日期！');

    let query = db.from('production_records')
        .select('*, machines(name), downtime_events(duration_minutes, downtime_reasons(name))')
        .gte('record_date', startDate)
        .lte('record_date', endDate);

    if (machineId) query = query.eq('machine_id', machineId);

    const { data: records, error } = await query;
    if (error) return alert('查詢失敗！');
    if (records.length === 0) {
        alert('沒有資料！');
        document.getElementById('statOEE').innerText = '0.0%';
        document.getElementById('statTotalDowntime').innerText = '0 分鐘';
        if (downtimeChartInstance) downtimeChartInstance.destroy();
        currentExportData = []; return;
    }

    let totalActualAvailTime = 0; let grandTotalDowntime = 0;
    const reasonDowntimeMap = {}; currentExportData = [];

    records.forEach(record => {
        const plannedMin = getMinutesDiff(record.start_time, record.end_time);
        let earlyEndMin = record.early_end_time ? getMinutesDiff(record.early_end_time, record.end_time) : 0;
        if (earlyEndMin < 0) earlyEndMin = 0;
        
        const actualAvailMin = plannedMin - earlyEndMin - 60; // 預設扣除午休60分
        totalActualAvailTime += actualAvailMin;

        let recordDowntime = 0;
        if (record.downtime_events) {
            record.downtime_events.forEach(event => {
                const duration = event.duration_minutes;
                recordDowntime += duration; grandTotalDowntime += duration;
                reasonDowntimeMap[event.downtime_reasons.name] = (reasonDowntimeMap[event.downtime_reasons.name] || 0) + duration;
            });
        }

        let recordOEE = actualAvailMin > 0 ? ((actualAvailMin - recordDowntime) / actualAvailMin) * 100 : 0;

        currentExportData.push({
            "日期": record.record_date, "線別": record.line_name, "機台": record.machines.name,
            "開線時間": record.start_time, "結束時間": record.end_time, "提早結束": record.early_end_time || '-',
            "實際可用時間(分)": actualAvailMin, "停機時間(分)": recordDowntime, "稼動率(%)": recordOEE.toFixed(2) + '%'
        });
    });

    let totalOEE = totalActualAvailTime > 0 ? ((totalActualAvailTime - grandTotalDowntime) / totalActualAvailTime) * 100 : 0;
    document.getElementById('statOEE').innerText = totalOEE.toFixed(1) + '%';
    document.getElementById('statTotalDowntime').innerText = grandTotalDowntime + ' 分鐘';

    const ctx = document.getElementById('downtimeChart').getContext('2d');
    if (downtimeChartInstance) downtimeChartInstance.destroy();
    downtimeChartInstance = new Chart(ctx, {
        type: 'pie',
        data: { labels: Object.keys(reasonDowntimeMap), datasets: [{ data: Object.values(reasonDowntimeMap), backgroundColor: Object.keys(reasonDowntimeMap).map(() => `hsl(${Math.random() * 360}, 70%, 60%)`) }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }, title: { display: true, text: '各停機項目時間佔比' } } }
    });
}

function exportToExcel() {
    if (currentExportData.length === 0) return alert('請先查詢資料！');
    const ws = XLSX.utils.json_to_sheet(currentExportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OEE紀錄");
    XLSX.writeFile(wb, `SMT_OEE統計表_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function switchPage(pageId, title) {
    document.querySelectorAll('.page-section').forEach(s => s.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';
    document.getElementById('page-title').innerText = title;
    document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
    document.getElementById('nav-' + pageId).classList.add('active');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.style.display = sidebar.style.display === 'none' || sidebar.style.display === '' ? 'flex' : 'none';
}
