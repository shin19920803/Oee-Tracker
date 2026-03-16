body {
    font-family: "Microsoft JhengHei", Arial, sans-serif;
    background-color: #f4f7f6;
    color: #333;
    padding: 20px;
}

h1 {
    text-align: center;
    color: #2c3e50;
}

.container {
    display: flex;
    gap: 20px;
    max-width: 800px;
    margin: 0 auto;
}

.section {
    background: #fff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    flex: 1;
}

.input-group {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
}

input[type="text"] {
    flex: 1;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
}

button {
    padding: 8px 15px;
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

button:hover {
    background-color: #2980b9;
}

ul {
    list-style-type: none;
    padding: 0;
}

li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    border-bottom: 1px solid #eee;
}

.delete-btn {
    background-color: #e74c3c;
    font-size: 12px;
    padding: 5px 10px;
}

.delete-btn:hover {
    background-color: #c0392b;
}
