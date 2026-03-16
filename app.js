const SUPABASE_URL = 'https://swalpwpdzlomxcijacnu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YWxwd3BkemxvbXhjaWphY251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDUyMzksImV4cCI6MjA4OTE4MTIzOX0.nhF05Ttgr9WonNOzrXBtleOwjkWdg6W7rE71DDg-8Y4';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentDowntimeEvents = [];
let loadedDailyRecords = [];
let downtimeChartInstance = null;
let currentExportData = [];
let allMachines = []; 
let allLines = []; // 新增：暫存所有線別資料

document.addEventListener('DOMContentLoaded', () => {
    populateTimeSelects();
    // 依序抓取資料，確保線別先準備好
    fetchLines().then(() => fetchMachines());
    fetchReasons();
    
    const today = new Date();
    document.getElementById('recordDate').valueAsDate = today;
    document.getElementById('statStartDate').valueAsDate = today;
    document.getElementById('statEndDate').valueAsDate = today;
    
    document.getElementById('startHour').value = '08';
    document.getElementById('startMinute').value = '30';
    
    loadRecordsByDate();
});

// ================= 時間選單 =================
function populateTimeSelects() {
    const hours24 = Array.from({length: 24}, (_, i) => String(i).padStart(2, '0'));
    const minutes60 = Array.from({length: 60}, (_, i) => String(i).padStart(2, '0'));
    
    const hourOptions = hours24.map(h => `<option value="${h}">${h}</option>`).join('');
    const minuteOptions = minutes60.map(m => `<option value="${m}">${m}</option>`).join('');
    const emptyOption = `<option value="">--</option>`;

    document.getElementById('startHour').innerHTML = hourOptions;
    document.getElementById('startMinute').innerHTML = minuteOptions;
    document.getElementById('endHour').innerHTML = hourOptions;
    document.getElementById('endMinute').innerHTML = minuteOptions;
    
    document.getElementById('earlyEndHour').innerHTML = emptyOption + hourOptions;
    document.getElementById('earlyEndMinute').innerHTML = emptyOption + minuteOptions;

    let dtHours = `<option value="0">0 小時</option>`;
    for(let i=1; i<=24; i++) dtHours += `<option value="${i}">${i} 小時</option>`;
    document.getElementById('downtimeHour').innerHTML = dtHours;

    let dtMinutes = `<option value="0">0 分鐘</option>`;
    for(let i=5; i<=60; i+=5) dtMinutes += `<option value="${i}">${i} 分鐘</option>`;
    document.getElementById('downtimeMinute').innerHTML = dtMinutes;
}

function getSelectedTime(hourId, minuteId) {
    const h = document.getElementById(hourId).value;
    const m = document.getElementById(minuteId).value;
    if (h && m) return `${h}:${m}`;
    return null;
}

function setSelectedTime(hourId, minuteId, timeString) {
    if (!timeString) {
        document.getElementById(hourId).value = ''; document.getElementById(minuteId).value = ''; return;
    }
    const [h, m] = timeString.split(':');
    document.getElementById(hourId).value = h; document.getElementById(minuteId).value = m;
}

// ================= ★全新：基礎設定 線別與機台連動邏輯★ =================

async function fetchLines() {
    const { data } = await db.from('lines').select('*').order('created_at', { ascending: true });
    allLines = data || [];
    
    const recordSelect = document.getElementById('recordLine');
    const settingLineSelect = document.getElementById('settingLineSelect');
    
    // 記住當前選擇
    const currentRecordVal = recordSelect.value;
    const currentSettingVal = settingLineSelect.value;
    
    recordSelect.innerHTML = '<option value="">請選擇線別</option>';
    settingLineSelect.innerHTML = '<option value="">請選擇線別...</option>';

    allLines.forEach(line => {
        recordSelect.innerHTML += `<option value="${line.name}">${line.name}</option>`;
        settingLineSelect.innerHTML += `<option value="${line.id}">${line.name}</option>`;
    });

    // 恢復報工區選擇
    if (currentRecordVal && allLines.find(l => l.name === currentRecordVal)) {
        recordSelect.value = currentRecordVal;
    } else if (localStorage.getItem('smtSavedLine')) {
        recordSelect.value = localStorage.getItem('smtSavedLine');
    }
    
    // 恢復基礎設定區選擇 (預設選第一個)
    if (currentSettingVal && allLines.find(l => l.id === currentSettingVal)) {
        settingLineSelect.value = currentSettingVal;
    } else if (allLines.length > 0) {
        settingLineSelect.value = allLines[0].id; 
    }

    onSettingLineChange(); // 更新畫面
}

// 基礎設定區：選擇線別時觸發
function onSettingLineChange() {
    const settingSelect = document.getElementById('settingLineSelect');
    const displaySpan = document.getElementById('currentSettingLineDisplay');
    
    if (!settingSelect.value) {
        displaySpan.innerText = '未選擇';
        document.getElementById('settingMachineList').innerHTML = '<li><span style="color: #a0aec0;">請先在上方選擇線別</span></li>';
        return;
    }

    const selectedLineName = settingSelect.options[settingSelect.selectedIndex].text;
    displaySpan.innerText = selectedLineName;
    
    renderSettingMachineList();
}

// 基礎設定區：顯示所選線別底下的機台
function renderSettingMachineList() {
    const settingSelect = document.getElementById('settingLineSelect');
    const machineList = document.getElementById('settingMachineList');
    machineList.innerHTML = '';

    if (!settingSelect.value) return;

    const lineId = settingSelect.value;
    const filteredMachines = allMachines.filter(m => m.line_id === lineId);

    if (filteredMachines.length === 0) {
        machineList.innerHTML = '<li><span style="color: #a0aec0;">此線別尚無機台，請在上方新增</span></li>';
        return;
    }

    filteredMachines.forEach(m => {
        machineList.innerHTML += `
            <li>
                ${m.name}
                <div class="btn-group">
                    <button class="edit-btn" onclick="editMachine('${m.id}', '${m.name}')">編輯</button>
                    <button class="delete-btn" onclick="deleteMachine('${m.id}')">刪除</button>
                </div>
            </li>
        `;
    });
}

// 基礎設定區：新增/編輯/刪除 線別
async function addNewLine() { 
    const name = document.getElementById('newLineName').value.trim(); 
    if (!name) return alert('請輸入新線別名稱'); 
    await db.from('lines').insert([{ name }]); 
    document.getElementById('newLineName').value=''; 
    fetchLines(); 
}

async function editSelectedLine() {
    const select = document.getElementById('settingLineSelect');
    const id = select.value;
    if (!id) return alert('請先選擇要修改的線別');
    const oldName = select.options[select.selectedIndex].text;
    const newName = prompt('新線別名稱：', oldName);
    if (newName && newName.trim() !== oldName) {
        await db.from('lines').update({ name: newName.trim() }).eq('id', id);
        fetchLines();
        fetchMachines(); // 報工區的機台清單依賴線別名稱，需重抓
    }
}

async function deleteSelectedLine() {
    const select = document.getElementById('settingLineSelect');
    const id = select.value;
    if (!id) return alert('請先選擇要刪除的線別');
    if (confirm('警告：確定刪除此線別嗎？\n該線別底下綁定的「所有機台」也會一併受到影響！')) {
        await db.from('lines').delete().eq('id', id);
        fetchLines();
        fetchMachines();
    }
}

// 基礎設定區：新增該線別的機台
async function addNewMachineToLine() {
    const lineId = document.getElementById('settingLineSelect').value;
    if (!lineId) return alert('請先在上方選擇要綁定的線別！');
    
    const name = document.getElementById('newMachineName').value.trim();
    if (!name) return alert('請輸入機台名稱！');

    await db.from('machines').insert([{ name: name, line_id: lineId }]);
    document.getElementById('newMachineName').value = '';
    fetchMachines();
}

async function fetchMachines() {
    const { data } = await db.from('machines').select('*, lines(name)').order('created_at', { ascending: true });
    allMachines = data || []; 
    
    const statSelect = document.getElementById('statMachine');
    statSelect.innerHTML = '<option value="">全部機台</option>';
    
    allMachines.forEach(m => {
        statSelect.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    });
    
    renderSettingMachineList(); // 更新基礎設定畫面
    updateRecordMachineDropdown(); // 更新報工畫面
}

async function editMachine(id, oldName) { const newName = prompt('新機台名稱：', oldName); if (newName) { await db.from('machines').update({ name: newName.trim() }).eq('id', id); fetchMachines(); } }
async function deleteMachine(id) { if (confirm('確定刪除？')) { await db.from('machines').delete().eq('id', id); fetchMachines(); } }


// ================= 報工區：線別與機台連動 =================
function onLineSelectionChange() {
    updateRecordMachineDropdown();
}

function updateRecordMachineDropdown() {
    const recordSelect = document.getElementById('recordMachine');
    const selectedLineName = document.getElementById('recordLine').value;
    
    recordSelect.innerHTML = '<option value="">請先選擇機台</option>';
    if (!selectedLineName) return;

    const filteredMachines = allMachines.filter(m => m.lines && m.lines.name === selectedLineName);
    filteredMachines.forEach(m => {
        recordSelect.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    });
}

// ================= 停機項目相關 (維持不變) =================
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


// ================= 每日報工儲存與紀錄邏輯 (完全維持上一版) =================
function addDowntimeToList() {
    const select = document.getElementById('downtimeReasonSelect');
    const reasonId = select.value;
    const reasonName = select.options[select.selectedIndex].text;
    
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

function removeDowntimeFromList(index) { currentDowntimeEvents.splice(index, 1); renderDowntimeTable(); }

function renderDowntimeTable() {
    const tbody = document.getElementById('downtimeTableBody'); tbody.innerHTML = ''; let total = 0;
    currentDowntimeEvents.forEach((event, index) => {
        total += event.duration;
        tbody.innerHTML += `<tr><td>${event.reasonName}</td><td>${event.duration}</td><td><button class="delete-btn" onclick="removeDowntimeFromList(${index})">移除</button></td></tr>`;
    });
    document.getElementById('totalDowntimeDisplay').innerText = total;
}

async function submitMachineRecord() {
    const date = document.getElementById('recordDate').value;
    const line = document.getElementById('recordLine').value;
    const startTime = getSelectedTime('startHour', 'startMinute');
    const endTime = getSelectedTime('endHour', 'endMinute');
    const earlyEndTime = getSelectedTime('earlyEndHour', 'earlyEndMinute');
    const machineId = document.getElementById('recordMachine').value;

    if (!date || !line || !startTime || !endTime || !machineId) return alert('請完整填寫上方共用資料(日期/線別/開線/結束) 以及 要儲存的機台名稱！');

    localStorage.setItem('smtSavedLine', line);

    const { data: recordData, error: recordError } = await db.from('production_records').insert([{
        record_date: date, line_name: line, machine_id: machineId, start_time: startTime,
        end_time: endTime, early_end_time: earlyEndTime, is_rolling_break: false
    }]).select();

    if (recordError) return alert('主紀錄儲存失敗：' + recordError.message);

    if (currentDowntimeEvents.length > 0) {
        const eventsToInsert = currentDowntimeEvents.map(event => ({
            record_id: recordData[0].id, reason_id: event.reasonId, duration_minutes: event.duration
        }));
        await db.from('downtime_events').insert(eventsToInsert);
    }

    alert('機台紀錄儲存成功！你可以繼續輸入下一台機台。');
    
    document.getElementById('recordMachine').value = '';
    document.getElementById('earlyEndHour').value = '';
    document.getElementById('earlyEndMinute').value = '';
    currentDowntimeEvents = []; renderDowntimeTable();
    loadRecordsByDate();
}

async function loadRecordsByDate() {
    const date = document.getElementById('recordDate').value;
    if (!date) return;
    const { data, error } = await db.from('production_records').select('*, machines(name), downtime_events(duration_minutes, downtime_reasons(id, name))').eq('record_date', date).order('created_at', { ascending: false });
    loadedDailyRecords = data || [];
    const tbody = document.getElementById('dailyHistoryTable'); tbody.innerHTML = '';
    if (loadedDailyRecords.length === 0) return tbody.innerHTML = '<tr><td colspan="6">本日尚無機台紀錄。</td></tr>';
    
    loadedDailyRecords.forEach(record => {
        let totalDowntime = 0;
        if (record.downtime_events) record.downtime_events.forEach(e => totalDowntime += e.duration_minutes);
        
        tbody.innerHTML += `<tr><td>${record.line_name}</td><td>${record.machines.name}</td><td>${record.start_time} ~ ${record.end_time}</td><td>${record.early_end_time || '-'}</td><td style="color:#e53e3e; font-weight:bold;">${totalDowntime}</td>
                <td><div class="btn-group" style="justify-content:center;"><button class="edit-btn" onclick="editDailyRecord('${record.id}')">載入編輯</button><button class="delete-btn" onclick="deleteDailyRecord('${record.id}')">刪除</button></div></td></tr>`;
    });
}

async function deleteDailyRecord(id) { if (!confirm('確定刪除此機台紀錄？')) return; await db.from('production_records').delete().eq('id', id); loadRecordsByDate(); }

async function editDailyRecord(id) {
    const record = loadedDailyRecords.find(r => r.id === id); if (!record) return;
    if (!confirm('系統將載入此紀錄到上方表單，並移除舊紀錄，請務必在修改後點擊儲存！')) return;

    document.getElementById('recordLine').value = record.line_name;
    updateRecordMachineDropdown(); 
    document.getElementById('recordMachine').value = record.machine_id;
    
    setSelectedTime('startHour', 'startMinute', record.start_time);
    setSelectedTime('endHour', 'endMinute', record.end_time);
    setSelectedTime('earlyEndHour', 'earlyEndMinute', record.early_end_time);

    currentDowntimeEvents = [];
    if (record.downtime_events) {
        record.downtime_events.forEach(e => {
            currentDowntimeEvents.push({ reasonId: e.downtime_reasons.id, reasonName: e.downtime_reasons.name, duration: e.duration_minutes });
        });
    }
    renderDowntimeTable();
    await db.from('production_records').delete().eq('id', id); loadRecordsByDate(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= 統計與導出邏輯 (維持不變) =================
function getMinutesDiff(start, end) {
    if (!start || !end) return 0; const [sH, sM] = start.split(':').map(Number); const [eH, eM] = end.split(':').map(Number); return (eH * 60 + eM) - (sH * 60 + sM);
}

async function queryStatistics() {
    const startDate = document.getElementById('statStartDate').value; const endDate = document.getElementById('statEndDate').value; const machineId = document.getElementById('statMachine').value;
    if (!startDate || !endDate) return alert('請選擇開始與結束日期！');

    let query = db.from('production_records').select('*, machines(name), downtime_events(duration_minutes, downtime_reasons(name))').gte('record_date', startDate).lte('record_date', endDate);
    if (machineId) query = query.eq('machine_id', machineId);

    const { data: records, error } = await query;
    if (error || records.length === 0) { alert(error ? '查詢失敗！' : '沒有資料！'); document.getElementById('statOEE').innerText = '0.0%'; document.getElementById('statTotalDowntime').innerText = '0 分鐘'; if (downtimeChartInstance) downtimeChartInstance.destroy(); currentExportData = []; return; }

    let totalActualAvailTime = 0; let grandTotalDowntime = 0; const reasonDowntimeMap = {}; currentExportData = [];

    records.forEach(record => {
        const plannedMin = getMinutesDiff(record.start_time, record.end_time);
        let earlyEndMin = record.early_end_time ? getMinutesDiff(record.early_end_time, record.end_time) : 0; if (earlyEndMin < 0) earlyEndMin = 0;
        const actualAvailMin = plannedMin - earlyEndMin - 60; totalActualAvailTime += actualAvailMin;

        let recordDowntime = 0;
        if (record.downtime_events) {
            record.downtime_events.forEach(event => {
                const duration = event.duration_minutes; recordDowntime += duration; grandTotalDowntime += duration;
                reasonDowntimeMap[event.downtime_reasons.name] = (reasonDowntimeMap[event.downtime_reasons.name] || 0) + duration;
            });
        }
        let recordOEE = actualAvailMin > 0 ? ((actualAvailMin - recordDowntime) / actualAvailMin) * 100 : 0;
        currentExportData.push({ "日期": record.record_date, "線別": record.line_name, "機台": record.machines.name, "開線時間": record.start_time, "結束時間": record.end_time, "提早結束": record.early_end_time || '-', "實際可用時間(分)": actualAvailMin, "停機時間(分)": recordDowntime, "稼動率(%)": recordOEE.toFixed(2) + '%' });
    });

    let totalOEE = totalActualAvailTime > 0 ? ((totalActualAvailTime - grandTotalDowntime) / totalActualAvailTime) * 100 : 0;
    document.getElementById('statOEE').innerText = totalOEE.toFixed(1) + '%'; document.getElementById('statTotalDowntime').innerText = grandTotalDowntime + ' 分鐘';

    const ctx = document.getElementById('downtimeChart').getContext('2d'); if (downtimeChartInstance) downtimeChartInstance.destroy();
    downtimeChartInstance = new Chart(ctx, { type: 'pie', data: { labels: Object.keys(reasonDowntimeMap), datasets: [{ data: Object.values(reasonDowntimeMap), backgroundColor: Object.keys(reasonDowntimeMap).map(() => `hsl(${Math.random() * 360}, 70%, 60%)`) }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }, title: { display: true, text: '各停機項目時間佔比' } } } });
}

function exportToExcel() { if (currentExportData.length === 0) return alert('請先查詢資料！'); const ws = XLSX.utils.json_to_sheet(currentExportData); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "OEE紀錄"); XLSX.writeFile(wb, `SMT_OEE統計表_${new Date().toISOString().slice(0, 10)}.xlsx`); }
function switchPage(pageId, title) { document.querySelectorAll('.page-section').forEach(s => s.style.display = 'none'); document.getElementById(pageId).style.display = 'block'; document.getElementById('page-title').innerText = title; document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active')); document.getElementById('nav-' + pageId).classList.add('active'); }
function toggleSidebar() { const sidebar = document.getElementById('sidebar'); sidebar.style.display = sidebar.style.display === 'none' || sidebar.style.display === '' ? 'flex' : 'none'; }
