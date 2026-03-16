// 1. 初始化 Supabase (直接帶入你的資料)
const SUPABASE_URL = 'https://swalpwpdzlomxcijacnu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YWxwd3BkemxvbXhjaWphY251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDUyMzksImV4cCI6MjA4OTE4MTIzOX0.nhF05Ttgr9WonNOzrXBtleOwjkWdg6W7rE71DDg-8Y4';

// 建立連線，變數名稱改為 db 避免與系統衝突
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 網頁載入完成後，立刻去資料庫抓資料顯示在畫面上
document.addEventListener('DOMContentLoaded', () => {
    fetchMachines();
    fetchReasons();
});

// ================= 機台相關功能 =================
async function fetchMachines() {
    const { data, error } = await db.from('machines').select('*').order('created_at', { ascending: true });
    if (error) {
        console.error('讀取機台失敗:', error);
        return;
    }
    const list = document.getElementById('machineList');
    list.innerHTML = '';
    data.forEach(machine => {
        list.innerHTML += `
            <li>
                ${machine.name} 
                <button class="delete-btn" onclick="deleteMachine('${machine.id}')">刪除</button>
            </li>
        `;
    });
}

async function addMachine() {
    const input = document.getElementById('machineName');
    const name = input.value.trim();
    if (!name) return alert('請輸入機台名稱');

    const { error } = await db.from('machines').insert([{ name: name }]);
    if (error) {
        alert('新增失敗，可能是名稱重複了！');
    } else {
        input.value = '';
        fetchMachines();
    }
}

async function deleteMachine(id) {
    if (!confirm('確定要刪除這個機台嗎？相關的生產紀錄可能會受影響喔！')) return;
    
    const { error } = await db.from('machines').delete().eq('id', id);
    if (error) alert('刪除失敗');
    else fetchMachines();
}

// ================= 停機項目相關功能 =================
async function fetchReasons() {
    const { data, error } = await db.from('downtime_reasons').select('*').order('created_at', { ascending: true });
    if (error) return console.error('讀取停機項目失敗:', error);
    
    const list = document.getElementById('reasonList');
    list.innerHTML = '';
    data.forEach(reason => {
        list.innerHTML += `
            <li>
                ${reason.name} 
                <button class="delete-btn" onclick="deleteReason('${reason.id}')">刪除</button>
            </li>
        `;
    });
}

async function addReason() {
    const input = document.getElementById('reasonName');
    const name = input.value.trim();
    if (!name) return alert('請輸入停機項目名稱');

    const { error } = await db.from('downtime_reasons').insert([{ name: name }]);
    if (error) {
        alert('新增失敗，可能是名稱重複了！');
    } else {
        input.value = '';
        fetchReasons();
    }
}

async function deleteReason(id) {
    if (!confirm('確定要刪除這個項目嗎？')) return;
    
    const { error } = await db.from('downtime_reasons').delete().eq('id', id);
    if (error) alert('刪除失敗');
    else fetchReasons();
}

// ================= 介面互動與顯示邏輯 =================
// 切換頁面顯示
function switchPage(pageId, title) {
    // 隱藏所有的區塊
    const sections = document.querySelectorAll('.page-section');
    sections.forEach(section => {
        section.style.display = 'none';
    });

    // 顯示選擇的區塊
    document.getElementById(pageId).style.display = 'block';
    
    // 更改上方的標題
    document.getElementById('page-title').innerText = title;

    // 清除選單的 active 狀態
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
    });
    
    // 將當前點擊的選單設為 active
    const activeLink = document.getElementById('nav-' + pageId);
    if(activeLink) activeLink.classList.add('active');
}

// 漢堡選單：收合/展開側邊欄
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar.style.display === 'none' || sidebar.style.display === '') {
        sidebar.style.display = 'flex';
    } else {
        sidebar.style.display = 'none';
    }
}
