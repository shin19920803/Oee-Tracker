const SUPABASE_URL = 'https://swalpwpdzlomxcijacnu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YWxwd3BkemxvbXhjaWphY251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDUyMzksImV4cCI6MjA4OTE4MTIzOX0.nhF05Ttgr9WonNOzrXBtleOwjkWdg6W7rE71DDg-8Y4';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentDowntimeEvents = [];
let downtimeChartInstance = null; // 儲存圖表實例
let currentExportData = []; // 暫存要匯出給 Excel 的資料

document.addEventListener('DOMContentLoaded', () => {
    fetchMachines();
    fetchReasons();
    
    // 預設日期為今天
    document.getElementById('recordDate').valueAsDate = new Date();
    document.getElementById('statStartDate').valueAsDate = new Date();
    document.getElementById('statEndDate').valueAsDate = new Date();

    // ======= 新增：讀取 localStorage 記憶的線別 =======
    const savedLine = localStorage.getItem('smtSavedLine');
    if (savedLine) {
        document.getElementById('recordLine').value = savedLine;
    }
});

// ================= 機台相關功能 =================
async function fetchMachines() {
    const { data, error } = await db.from('machines').select('*').order('created_at', { ascending: true });
    if (error) return console.error('讀取機台失敗:', error);
    
    const list = document.getElementById('machineList');
    list.innerHTML = '';
    
    const recordSelect = document.getElementById('recordMachine');
    recordSelect.innerHTML = '<option value="">請選擇機台</option>';

    const statSelect = document.getElementById('statMachine');
    statSelect.innerHTML = '<option value="">全部機台</option>';

    data.forEach(machine => {
        list.innerHTML += `
            <li>
                ${machine.name} 
                <div class="btn-group">
                    <button class="edit-btn" onclick="editMachine('${machine.id}', '${machine.name}')">編輯</button>
                    <button class="delete-btn" onclick="deleteMachine('${machine.id}')">刪除</button>
                </div>
            </li>
        `;
        recordSelect.innerHTML += `<option value="${machine.id}">${machine.name}</option>`;
        statSelect.innerHTML += `<option value="${machine.id}">${machine.name}</option>`;
    });
}

async function addMachine() {
    const input = document.getElementById('machineName');
    const name = input.value.trim();
    if (!name) return alert('請輸入機台名稱');
    const { error } = await db.from('machines').insert([{ name: name }]);
    if (error) alert('新增失敗！'); else { input.value = ''; fetchMachines(); }
}

async function editMachine(id, oldName) {
    const newName = prompt('請輸入新的機台名稱：', oldName);
    if (newName === null || newName.trim() === '' || newName.trim() === oldName) return;
    const { error } = await db.from('machines').update({ name: newName.trim() }).eq('id', id);
    if (error) alert('更新失敗'); else fetchMachines();
}

async function deleteMachine(id) {
    if (!confirm('確定要刪除嗎？')) return;
    const { error } = await db.from('machines').delete().eq('id', id);
    if (error) alert('刪除失敗'); else fetchMachines();
}

// ================= 停機項目相關功能 =================
async function fetchReasons() {
    const { data, error } = await db.from('downtime_reasons').select('*').order('created_at', { ascending: true });
    if (error) return console.error('讀取停機項目失敗:', error);
    
    const list = document.getElementById('reasonList');
    list.innerHTML = '';
    const select = document.getElementById('downtimeReasonSelect');
    select.innerHTML = '<option value="">請選擇停機項目</option>';

    data.forEach(reason => {
        list.innerHTML += `
            <li>
                ${reason.name} 
                <div class="btn-group">
                    <button class="edit-btn" onclick="editReason('${reason.id}', '${reason.name}')">編輯</button>
                    <button class="delete-btn" onclick="deleteReason('${reason.id}')">刪除</button>
                </div>
            </li>
        `;
        select.innerHTML += `<option value="${reason.id}">${reason.name}</option>`;
    });
}

async function addReason() {
    const input = document.getElementById('reasonName');
    const name = input.value.trim();
    if (!name) return alert('請輸入項目名稱');
    const { error } = await db.from('downtime_reasons').insert([{ name: name }]);
    if (error) alert('新增失敗！'); else { input.value = ''; fetchReasons(); }
}

async function editReason(id, oldName) {
    const newName = prompt('請輸入新的停機項目名稱：', oldName);
    if (newName === null || newName.trim() === '' || newName.trim() === oldName) return;
    const { error } = await db.from('downtime_reasons').update({ name: newName.trim() }).eq('id', id);
    if (error) alert('更新失敗'); else fetchReasons();
}

async function deleteReason(id) {
    if (!confirm('確定要刪除嗎？')) return;
    const { error } = await db.from('downtime_reasons').delete().eq('id', id);
    if (error) alert('刪除失敗'); else fetchReasons();
}

// ================= 每日報工表單邏輯 =================
function addDowntimeToList() {
    const select = document.getElementById('downtimeReasonSelect');
    const reasonId = select.value;
    const reasonName = select.options[select.selectedIndex].text;
    const duration = parseInt(document.getElementById('downtimeDuration').value);

    if (!reasonId) return alert('請選擇停機項目！');
    if (!duration || duration <= 0 || duration % 5 !== 0) return alert('停機時間必須是大於0，且為5的倍數！');

    currentDowntimeEvents.push({ reasonId, reasonName, duration });
    select.value = '';
    document.getElementById('downtimeDuration').value = '';
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
        tbody.innerHTML += `
            <tr>
                <td>${event.reasonName}</td>
                <td>${event.duration}</td>
                <td><button class="delete-btn" onclick="removeDowntimeFromList(${index})">刪除</button></td>
            </tr>
        `;
    });

    document.getElementById('totalDowntimeDisplay').innerText = total;
}

async function submitDailyRecord() {
    const date = document.getElementById('recordDate').value;
    const line = document.getElementById('recordLine').value.trim();
    const machineId = document.getElementById('recordMachine').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const earlyEndTime = document.getElementById('earlyEndTime').value || null;
    const isRollingBreak = document.getElementById('isRollingBreak').checked;

    if (!date || !line || !machineId || !startTime || !endTime) {
        return alert('請完整填寫：日期、線別、機台、開線與結束時間！');
    }

    // ======= 新增：記憶線別到 localStorage =======
    localStorage.setItem('smtSavedLine', line);

    const { data: recordData, error: recordError } = await db.from('production_records').insert([{
        record_date: date,
        line_name: line,
        machine_id: machineId,
        start_time: startTime,
        end_time: endTime,
        early_end_time: earlyEndTime,
        is_rolling_break: isRollingBreak
    }]).select();

    if (recordError) return alert('主紀錄儲存失敗：' + recordError.message);
    const recordId = recordData[0].id;

    if (currentDowntimeEvents.length > 0) {
        const eventsToInsert = currentDowntimeEvents.map(event => ({
            record_id: recordId,
            reason_id: event.reasonId,
            duration_minutes: event.duration
        }));

        const { error: eventsError } = await db.from('downtime_events').insert(eventsToInsert);
        if (eventsError) return alert('停機紀錄儲存失敗：' + eventsError.message);
    }

    alert('報工儲存成功！');
    // 清空表單，保留線別與日期
    document.getElementById('recordMachine').value = '';
    document.getElementById('startTime').value = '';
    document.getElementById('endTime').value = '';
    document.getElementById('earlyEndTime').value = '';
    document.getElementById('isRollingBreak').checked = false;
    currentDowntimeEvents = [];
    renderDowntimeTable();
}

// ================= 統計與導出邏輯 =================

// 計算兩時間差距(分鐘)
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

    // 抓取區間內的紀錄 (包含關聯的機台名稱、停機項目名稱)
    let query = db.from('production_records')
        .select('*, machines(name), downtime_events(duration_minutes, downtime_reasons(name))')
        .gte('record_date', startDate)
        .lte('record_date', endDate);

    if (machineId) query = query.eq('machine_id', machineId);

    const { data: records, error } = await query;
    
    if (error) return alert('查詢統計資料失敗！');
    if (records.length === 0) {
        alert('這段期間沒有資料喔！');
        document.getElementById('statOEE').innerText = '0.0%';
        document.getElementById('statTotalDowntime').innerText = '0 分鐘';
        if (downtimeChartInstance) downtimeChartInstance.destroy();
        currentExportData = [];
        return;
    }

    let totalActualAvailTime = 0; // 總實際可用時間
    let grandTotalDowntime = 0;   // 總停機時間
    const reasonDowntimeMap = {}; // 用來畫圓餅圖的分類統計
    
    currentExportData = []; // 清空之前的匯出資料

    records.forEach(record => {
        const plannedMin = getMinutesDiff(record.start_time, record.end_time);
        
        // 提早結束時間扣除
        let earlyEndMin = 0;
        if (record.early_end_time) {
            earlyEndMin = getMinutesDiff(record.early_end_time, record.end_time);
            if (earlyEndMin < 0) earlyEndMin = 0; 
        }
        
        // 午休時間扣除 (若輪休則不扣)
        const breakMin = record.is_rolling_break ? 0 : 60;

        const actualAvailMin = plannedMin - earlyEndMin - breakMin;
        totalActualAvailTime += actualAvailMin;

        let recordDowntime = 0;
        if (record.downtime_events && record.downtime_events.length > 0) {
            record.downtime_events.forEach(event => {
                const duration = event.duration_minutes;
                const reasonName = event.downtime_reasons.name;
                
                recordDowntime += duration;
                grandTotalDowntime += duration;
                
                // 累積各停機項目的時間
                if (reasonDowntimeMap[reasonName]) {
                    reasonDowntimeMap[reasonName] += duration;
                } else {
                    reasonDowntimeMap[reasonName] = duration;
                }
            });
        }

        let recordOEE = 0;
        if (actualAvailMin > 0) {
            recordOEE = ((actualAvailMin - recordDowntime) / actualAvailMin) * 100;
        }

        // 整理給 Excel 的資料
        currentExportData.push({
            "日期": record.record_date,
            "線別": record.line_name,
            "機台": record.machines.name,
            "開線時間": record.start_time,
            "結束時間": record.end_time,
            "提早結束": record.early_end_time || '-',
            "輪休不停機": record.is_rolling_break ? "是" : "否",
            "實際可用時間(分)": actualAvailMin,
            "停機總時間(分)": recordDowntime,
            "稼動率(%)": recordOEE.toFixed(2) + '%'
        });
    });

    // 總稼動率計算
    let totalOEE = 0;
    if (totalActualAvailTime > 0) {
        totalOEE = ((totalActualAvailTime - grandTotalDowntime) / totalActualAvailTime) * 100;
    }

    // 更新畫面上的數字
    document.getElementById('statOEE').innerText = totalOEE.toFixed(1) + '%';
    document.getElementById('statTotalDowntime').innerText = grandTotalDowntime + ' 分鐘';

    // 繪製圓餅圖
    renderChart(reasonDowntimeMap);
}

// 圓餅圖繪製函數
function renderChart(reasonDowntimeMap) {
    const ctx = document.getElementById('downtimeChart').getContext('2d');
    
    if (downtimeChartInstance) downtimeChartInstance.destroy();

    const labels = Object.keys(reasonDowntimeMap);
    const data = Object.values(reasonDowntimeMap);

    if (labels.length === 0) return; // 沒停機紀錄不畫圖

    // 生成隨機顏色
    const backgroundColors = labels.map(() => `hsl(${Math.random() * 360}, 70%, 60%)`);

    downtimeChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: backgroundColors }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' },
                title: { display: true, text: '各停機項目時間佔比' }
            }
        }
    });
}

// 匯出 Excel
function exportToExcel() {
    if (currentExportData.length === 0) {
        return alert('請先查詢資料，再點擊匯出！');
    }
    const worksheet = XLSX.utils.json_to_sheet(currentExportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OEE稼動率紀錄");
    
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `SMT_OEE統計表_${dateStr}.xlsx`);
}

// ================= 介面互動 =================
function switchPage(pageId, title) {
    document.querySelectorAll('.page-section').forEach(s => s.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';
    document.getElementById('page-title').innerText = title;
    document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
    const activeLink = document.getElementById('nav-' + pageId);
    if(activeLink) activeLink.classList.add('active');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.style.display = sidebar.style.display === 'none' || sidebar.style.display === '' ? 'flex' : 'none';
}
