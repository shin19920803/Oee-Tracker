const SUPABASE_URL = 'https://swalpwpdzlomxcijacnu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YWxwd3BkemxvbXhjaWphY251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDUyMzksImV4cCI6MjA4OTE4MTIzOX0.nhF05Ttgr9WonNOzrXBtleOwjkWdg6W7rE71DDg-8Y4';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 存放每日報工中「暫時新增」的停機紀錄
let currentDowntimeEvents = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchMachines();
    fetchReasons();
    // 預設日期為今天
    document.getElementById('recordDate').valueAsDate = new Date();
});

// ================= 1. 機台相關功能 (含編輯) =================
async function fetchMachines() {
    const { data, error } = await db.from('machines').select('*').order('created_at', { ascending: true });
    if (error) return console.error('讀取機台失敗:', error);
    
    // 更新基礎設定的清單
    const list = document.getElementById('machineList');
    list.innerHTML = '';
    
    // 同時更新「每日報工」的下拉選單
    const select = document.getElementById('recordMachine');
    select.innerHTML = '<option value="">請選擇機台</option>';

    data.forEach(machine => {
        // 基礎設定清單 (加入編輯按鈕)
        list.innerHTML += `
            <li>
                ${machine.name} 
                <div class="btn-group">
                    <button class="edit-btn" onclick="editMachine('${machine.id}', '${machine.name}')">編輯</button>
                    <button class="delete-btn" onclick="deleteMachine('${machine.id}')">刪除</button>
                </div>
            </li>
        `;
        // 報工下拉選單
        select.innerHTML += `<option value="${machine.id}">${machine.name}</option>`;
    });
}

async function addMachine() {
    const input = document.getElementById('machineName');
    const name = input.value.trim();
    if (!name) return alert('請輸入機台名稱');
    const { error } = await db.from('machines').insert([{ name: name }]);
    if (error) alert('新增失敗，可能是名稱重複！');
    else { input.value = ''; fetchMachines(); }
}

async function editMachine(id, oldName) {
    const newName = prompt('請輸入新的機台名稱：', oldName);
    if (newName === null || newName.trim() === '' || newName.trim() === oldName) return; // 按取消或沒修改
    const { error } = await db.from('machines').update({ name: newName.trim() }).eq('id', id);
    if (error) alert('更新失敗');
    else fetchMachines();
}

async function deleteMachine(id) {
    if (!confirm('確定要刪除嗎？')) return;
    const { error } = await db.from('machines').delete().eq('id', id);
    if (error) alert('刪除失敗'); else fetchMachines();
}

// ================= 2. 停機項目相關功能 (含編輯) =================
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
    if (error) alert('新增失敗！');
    else { input.value = ''; fetchReasons(); }
}

async function editReason(id, oldName) {
    const newName = prompt('請輸入新的停機項目名稱：', oldName);
    if (newName === null || newName.trim() === '' || newName.trim() === oldName) return;
    const { error } = await db.from('downtime_reasons').update({ name: newName.trim() }).eq('id', id);
    if (error) alert('更新失敗');
    else fetchReasons();
}

async function deleteReason(id) {
    if (!confirm('確定要刪除嗎？')) return;
    const { error } = await db.from('downtime_reasons').delete().eq('id', id);
    if (error) alert('刪除失敗'); else fetchReasons();
}

// ================= 3. 每日報工表單邏輯 =================

// 暫存一筆停機紀錄到表格
function addDowntimeToList() {
    const select = document.getElementById('downtimeReasonSelect');
    const reasonId = select.value;
    const reasonName = select.options[select.selectedIndex].text;
    const duration = parseInt(document.getElementById('downtimeDuration').value);

    if (!reasonId) return alert('請選擇停機項目！');
    if (!duration || duration <= 0 || duration % 5 !== 0) return alert('停機時間必須是大於0，且為5的倍數！');

    // 加入陣列
    currentDowntimeEvents.push({ reasonId, reasonName, duration });
    
    // 清空輸入框
    select.value = '';
    document.getElementById('downtimeDuration').value = '';
    
    renderDowntimeTable();
}

// 移除暫存的停機紀錄
function removeDowntimeFromList(index) {
    currentDowntimeEvents.splice(index, 1);
    renderDowntimeTable();
}

// 更新畫面上的停機表格與總和
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

// 點擊「儲存今日報工」送出資料到 Supabase
async function submitDailyRecord() {
    const date = document.getElementById('recordDate').value;
    const line = document.getElementById('recordLine').value.trim();
    const machineId = document.getElementById('recordMachine').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const earlyEndTime = document.getElementById('earlyEndTime').value || null;
    const isRollingBreak = document.getElementById('isRollingBreak').checked;

    // 基礎防呆檢查
    if (!date || !line || !machineId || !startTime || !endTime) {
        return alert('請完整填寫：日期、線別、機台、開線與結束時間！');
    }

    // 1. 寫入主表 production_records (透過 .select() 取得新增的那筆資料 ID)
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

    const recordId = recordData[0].id; // 拿到剛建立的報工單 ID

    // 2. 如果有停機紀錄，寫入子表 downtime_events
    if (currentDowntimeEvents.length > 0) {
        const eventsToInsert = currentDowntimeEvents.map(event => ({
            record_id: recordId,
            reason_id: event.reasonId,
            duration_minutes: event.duration
        }));

        const { error: eventsError } = await db.from('downtime_events').insert(eventsToInsert);
        if (eventsError) return alert('停機紀錄儲存失敗：' + eventsError.message);
    }

    // 3. 成功後清空表單
    alert('報工儲存成功！');
    document.getElementById('recordLine').value = '';
    document.getElementById('recordMachine').value = '';
    document.getElementById('startTime').value = '';
    document.getElementById('endTime').value = '';
    document.getElementById('earlyEndTime').value = '';
    document.getElementById('isRollingBreak').checked = false;
    currentDowntimeEvents = [];
    renderDowntimeTable();
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
