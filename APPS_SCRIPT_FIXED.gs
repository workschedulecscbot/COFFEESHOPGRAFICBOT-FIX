// ========== НАСТРОЙКИ ==========
var BOT_TOKEN = '8690029496:AAF8AS5SuabgoLbIzNkYqxrYotS6k7zvlNk';

// ========== ТРИГГЕР ОТПРАВКИ ОТЧЕТОВ ==========
// ⚠️ ВАЖНО: Установить триггер вручную!
// 1. Открыть Apps Script Editor (Ctrl+Enter в Google Sheets)
// 2. Перейти на вкладку "Триггеры" (слева)
// 3. Нажать "+ Добавить триггер"
// 4. Выбрать:
//    - Функция: sendMonthlyReports
//    - Развертывание: ведущий проект
//    - Событие: Временной триггер → День → 08:00 (утро)
//    - Частота: Каждый месяц (1-го числа)
// 5. Сохранить триггер
//
// Отчеты будут автоматически отправлены в Telegram всем сотрудникам в 1-е число месяца в 08:00

// ========== УВЕДОМЛЕНИЯ ОБ ИЗМЕНЕНИЯХ ==========
function onEdit(e) {
  if (!e || !e.range) return;

  var sheet = e.source.getActiveSheet();
  if (sheet.getName() == 'Employees') return;

  var row = e.range.getRow();
  var col = e.range.getColumn();
  if (row < 6) return;

  var employeeName = sheet.getRange(row, 1).getValue();
  if (!employeeName) return;

  var position = sheet.getRange(row, 2).getValue();
  
  // ========== ФОРМИРОВАНИЕ ДАТЫ ==========
  var dayNumber = sheet.getRange(1, col).getValue();
  var sheetName = sheet.getName();
  var parts = sheetName.split(' ');
  var month = parts[0];
  var year = parts[1];

  var dayFormatted = ('0' + dayNumber).slice(-2);
  
  function getMonthNumber(monthName) {
    var months = {
      'ЯНВАРЬ': '01', 'ФЕВРАЛЬ': '02', 'МАРТ': '03',
      'АПРЕЛЬ': '04', 'МАЙ': '05', 'ИЮНЬ': '06',
      'ИЮЛЬ': '07', 'АВГУСТ': '08', 'СЕНТЯБРЬ': '09',
      'ОКТЯБРЬ': '10', 'НОЯБРЬ': '11', 'ДЕКАБРЬ': '12'
    };
    return months[monthName.toUpperCase()] || '00';
  }
  
  var monthNumber = getMonthNumber(month);
  var yearShort = year.slice(-2);
  var fullDate = dayFormatted + '.' + monthNumber + '.' + yearShort;
  
  // ========== ЧТО БЫЛО И СТАЛО ==========
  var oldValue = e.oldValue;
  var newValue = e.value;
  if (oldValue == newValue) return;

  // ========== РАСШИФРОВКА БУКВ И ЧИСЕЛ ==========
  function formatValue(value) {
    if (!value) return '';
    
    if (value == 'д') return 'дневная смена';
    if (value == 'н') return 'ночная смена';
    if (value == 'с') return 'суточная смена';
    
    var num = Number(value);
    if (!isNaN(num)) {
      var lastDigit = num % 10;
      var lastTwoDigits = num % 100;
      
      if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
        return num + ' часов';
      }
      if (lastDigit == 1) return num + ' час';
      if (lastDigit >= 2 && lastDigit <= 4) return num + ' часа';
      return num + ' часов';
    }
    
    return value;
  }

  var oldFormatted = formatValue(oldValue);
  var newFormatted = formatValue(newValue);

  // ========== ОПРЕДЕЛЕНИЕ ДЕЙСТВИЯ ==========
  var action = !oldValue && newValue ? '➕ Добавлена смена' :
               oldValue && !newValue ? '❌ Удалена смена' :
               '✏️ Изменена смена';

  // ========== ФОРМИРОВАНИЕ СООБЩЕНИЯ ==========
  var message = action + '\n\n';
  message += '📅 Месяц: ' + sheetName + '\n';
  message += '👤 Сотрудник: ' + employeeName + '\n';
  message += '📌 Должность: ' + position + '\n';
  message += '📆 Дата: ' + fullDate + '\n';
  if (oldValue) message += '➡️ Было: ' + oldFormatted + '\n';
  if (newValue) message += '⬅️ Стало: ' + newFormatted;

  // ========== ОТПРАВКА ==========
  var chatId = getChatId(employeeName, position);
  if (chatId) sendMessage(chatId, message);
}

// ========== РАССЫЛКА ИТОГОВ В ПЕРВЫЙ ДЕНЬ МЕСЯЦА ==========
function sendMonthlyReports() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var employees = ss.getSheetByName('Employees');
  if (!employees) return;
  
  // Получаем предыдущий месяц (так как функция запускается на 1-е число текущего)
  var now = new Date();
  var prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var prevMonthSheet = getMonthSheet(ss, prevMonth);
  
  if (!prevMonthSheet) {
    Logger.log('⚠️ Лист предыдущего месяца не найден');
    return;
  }
  
  var data = employees.getDataRange().getValues();
  var monthLabel = prevMonthSheet.getName();
  
  for (var i = 1; i < data.length; i++) {
    var empName = String(data[i][0]).trim();
    var chatId = data[i][2];
    
    if (!empName || !chatId) continue;
    
    var report = generateEmployeeReport(empName, prevMonthSheet);
    if (!report) continue;
    
    var message = '📊 Итоги за ' + monthLabel + '\n\n';
    message += '👤 ' + empName + '\n';
    
    // Если одна должность
    if (report.roles.length === 1) {
      var role = report.roles[0];
      message += '(' + role.name + ')\n';
      message += '⏱ Всего часов: ' + Math.round(role.hours * 100) / 100;
    } else {
      // Если несколько должностей
      for (var j = 0; j < report.roles.length; j++) {
        message += report.roles[j].name + ' : ' + Math.round(report.roles[j].hours * 100) / 100 + ' ч\n';
      }
    }
    
    sendMessage(chatId, message);
    Logger.log('✅ Отчет отправлен для ' + empName);
  }
}

// ========== ПОИСК ЛИСТА ПО МЕСЯЦУ И ГОДУ ==========
function getMonthSheet(ss, date) {
  var month = date.getMonth() + 1;
  var year = date.getFullYear();
  var sheets = ss.getSheets();
  var monthNames = [
    '', 'ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ',
    'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'
  ];
  
  var targetName = monthNames[month] + ' ' + year;
  
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName() === targetName) {
      return sheets[i];
    }
  }
  
  return null;
}

// ========== ГЕНЕРАЦИЯ ОТЧЕТА ДЛЯ СОТРУДНИКА ==========
function generateEmployeeReport(empName, monthSheet) {
  var rows = monthSheet.getDataRange().getValues();
  var empNameLower = empName.toLowerCase();
  var report = { roles: [] };
  var roleMap = {};
  
  for (var i = 5; i < rows.length; i++) {
    var rowName = String(rows[i][0]).trim().toLowerCase();
    if (rowName !== empNameLower) continue;
    
    var role = String(rows[i][1]).trim();
    var hours = 0;
    
    // Считаем часы за месяц (начиная со столбца 3, дни 1-31)
    for (var day = 1; day <= 31; day++) {
      var col = 1 + day;
      if (col >= rows[i].length) break;
      
      var shift = String(rows[i][col]).trim();
      hours += getHoursForShift(shift);
    }
    
    if (!roleMap[role]) {
      roleMap[role] = 0;
    }
    roleMap[role] += hours;
  }
  
  for (var role in roleMap) {
    report.roles.push({ name: role, hours: roleMap[role] });
  }
  
  return report.roles.length > 0 ? report : null;
}

// ========== ПОДСЧЕТ ЧАСОВ ДЛЯ СМЕНЫ ==========
function getHoursForShift(shift) {
  if (!shift) return 0;
  
  var s = String(shift).trim();
  
  // Парсим только числовые значения часов
  var num = parseFloat(s);
  if (!isNaN(num) && num > 0) return num;
  
  // Смены с временем (например "Бармен 12-15")
  var timeMatch = s.match(/(\d{1,2})-(\d{1,2})/);
  if (timeMatch) {
    var start = parseInt(timeMatch[1]);
    var end = parseInt(timeMatch[2]);
    if (end <= start) end += 24;
    return end - start;
  }
  
  // Все остальное (буквы с/д/н, прочее) = 0 часов
  return 0;
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

// ✅ ОБНОВЛЕНО — поиск только по имени (без должности)
function getChatId(name, position) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Employees');
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  
  // Точное совпадение по имени
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === String(name).trim().toLowerCase()) {
      return data[i][2] || null;
    }
  }
  
  // Нечёткое совпадение — по частям имени
  var parts = String(name).trim().toLowerCase().split(/\s+/);
  for (var i = 1; i < data.length; i++) {
    var rowName = String(data[i][0]).trim().toLowerCase();
    var allMatch = parts.every(function(p) { return rowName.indexOf(p) !== -1; });
    if (allMatch) return data[i][2] || null;
  }
  
  return null;
}

function getCurrentMonthSheet() {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (name != 'Employees' && name != 'ShiftEdits' && name != 'EmpNotes') return sheets[i];
  }
  return null;
}

// ✅ ИСПРАВЛЕННАЯ ФУНКЦИЯ
function sendMessage(chatId, text) {
  var url = 'https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage?chat_id=' + chatId + '&text=' + encodeURIComponent(text);
  try {
    UrlFetchApp.fetch(url);
  } catch(err) {
    Logger.log('❌ Ошибка отправки сообщения: ' + err);
  }
}

// ========== ПАРСИНГ ЛИСТА ДЛЯ ПРИЛОЖЕНИЯ ==========
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = e && e.parameter && e.parameter.sheet ? e.parameter.sheet : null;
    
    var sheet;
    if (sheetName) {
      sheet = ss.getSheetByName(sheetName) || getCurrentMonthSheet();
    } else {
      sheet = getCurrentMonthSheet();
    }
    
    if (!sheet) {
      return jsonResponse({ error: 'Нет листов с данными' });
    }
    
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    
    if (lastRow === 0 || lastCol === 0) {
      return jsonResponse({ values: [], sheets: getSheetsMap(ss) });
    }
    
    var range = sheet.getRange(1, 1, lastRow, lastCol);
    var values = range.getValues();
    
    var cleanValues = values.map(function(row) {
      return row.map(function(cell) {
        if (cell instanceof Date) {
          return Utilities.formatDate(cell, 'Europe/Moscow', 'dd.MM.yyyy');
        }
        return cell === null ? '' : String(cell);
      });
    });
    
    var sheetsMap = getSheetsMap(ss);
    
    return jsonResponse({
      values: cleanValues,
      sheets: sheetsMap,
      sheetName: sheet.getName()
    });
    
  } catch(err) {
    return jsonResponse({ error: err.toString() });
  }
}

// ========== СИНХРОНИЗАЦИЯ С ПРИЛОЖЕНИЕМ ==========
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    Logger.log('📥 Получено действие: ' + data.action + ' - ' + JSON.stringify(data));
    
    if (data.action === 'link') {
      // Привязка Telegram ID к сотруднику
      saveTgLink(data.empName, data.tgId);
      return jsonResponse({ ok: true, message: '✅ Telegram привязана' });
    }
    
    if (data.action === 'editshift') {
      // Сохранение правки смены
      saveShiftEdit(data.empId, data.date, data.customStart, data.customEnd, data.note);
      return jsonResponse({ ok: true, message: '✅ Правка смены сохранена' });
    }
    
    if (data.action === 'deleteshift') {
      // Удаление правки смены
      deleteShiftEdit(data.empId, data.date);
      return jsonResponse({ ok: true, message: '✅ Правка смены удалена' });
    }
    
    if (data.action === 'empnote') {
      // Сохранение примечания к сотруднику
      saveEmpNote(data.empId, data.note);
      return jsonResponse({ ok: true, message: '✅ Примечание сохранено' });
    }
    
    if (data.action === 'loadeditdata') {
      // Загрузить все сохранённые правки и примечания
      var shiftEdits = loadAllShiftEdits();
      var empNotes = loadAllEmpNotes();
      return jsonResponse({ 
        ok: true, 
        shiftEdits: shiftEdits, 
        empNotes: empNotes 
      });
    }
    
    if (data.action === 'senddebug') {
      // Отправить отладку всем администраторам
      sendDebugToAdmins(data.empName, data.empDept, data.empRoles, data.tgUsername, data.tgId);
      return jsonResponse({ ok: true, message: '✅ Отладка отправлена администраторам' });
    }
    
    return jsonResponse({ error: 'Unknown action: ' + data.action });
    
  } catch(err) {
    Logger.log('❌ Ошибка doPost: ' + err);
    return jsonResponse({ error: err.toString() });
  }
}

// ========== СОХРАНЕНИЕ ПРАВОК СМЕН ==========
function saveShiftEdit(empId, date, customStart, customEnd, note) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ShiftEdits');
  
  if (!sheet) {
    sheet = ss.insertSheet('ShiftEdits');
    sheet.getRange(1, 1).setValue('empId');
    sheet.getRange(1, 2).setValue('date');
    sheet.getRange(1, 3).setValue('customStart');
    sheet.getRange(1, 4).setValue('customEnd');
    sheet.getRange(1, 5).setValue('note');
  }
  
  var data = sheet.getDataRange().getValues();
  var key = empId + '|' + date;
  
  // Ищем существующую правку
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] + '|' + data[i][1] === key) {
      sheet.getRange(i + 1, 3).setValue(customStart || '');
      sheet.getRange(i + 1, 4).setValue(customEnd || '');
      sheet.getRange(i + 1, 5).setValue(note || '');
      return;
    }
  }
  
  // Новая правка
  var lastRow = sheet.getLastRow() || 1;
  sheet.getRange(lastRow + 1, 1).setValue(empId);
  sheet.getRange(lastRow + 1, 2).setValue(date);
  sheet.getRange(lastRow + 1, 3).setValue(customStart || '');
  sheet.getRange(lastRow + 1, 4).setValue(customEnd || '');
  sheet.getRange(lastRow + 1, 5).setValue(note || '');
}

// ========== УДАЛЕНИЕ ПРАВОК СМЕН ==========
function deleteShiftEdit(empId, date) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ShiftEdits');
  if (!sheet) return;
  
  var data = sheet.getDataRange().getValues();
  var key = empId + '|' + date;
  var rowToDelete = -1;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] + '|' + data[i][1] === key) {
      rowToDelete = i + 1;
      break;
    }
  }
  
  if (rowToDelete > 0) {
    sheet.deleteRow(rowToDelete);
  }
}

// ========== ЗАГРУЗКА ВСЕх ПРАВОК СМЕН ==========
function loadAllShiftEdits() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ShiftEdits');
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  var edits = [];
  
  for (var i = 1; i < data.length; i++) {
    edits.push({
      empId: data[i][0],
      date: data[i][1],
      customStart: data[i][2] || undefined,
      customEnd: data[i][3] || undefined,
      note: data[i][4] || undefined
    });
  }
  
  return edits;
}

// ========== СОХРАНЕНИЕ ПРИМЕЧАНИЙ К СОТРУДНИКАМ ==========
function saveEmpNote(empId, note) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('EmpNotes');
  
  if (!sheet) {
    sheet = ss.insertSheet('EmpNotes');
    sheet.getRange(1, 1).setValue('empId');
    sheet.getRange(1, 2).setValue('note');
  }
  
  var data = sheet.getDataRange().getValues();
  
  // Если примечание пусто, удаляем запись
  if (!note || note.trim() === '') {
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === empId) {
        sheet.deleteRow(i + 1);
        return;
      }
    }
    return;
  }
  
  // Ищем существующее примечание
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === empId) {
      sheet.getRange(i + 1, 2).setValue(note);
      return;
    }
  }
  
  // Новое примечание
  var lastRow = sheet.getLastRow() || 1;
  sheet.getRange(lastRow + 1, 1).setValue(empId);
  sheet.getRange(lastRow + 1, 2).setValue(note);
}

// ========== ЗАГРУЗКА ВСЕХ ПРИМЕЧАНИЙ ==========
function loadAllEmpNotes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('EmpNotes');
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  var notes = [];
  
  for (var i = 1; i < data.length; i++) {
    notes.push({
      empId: data[i][0],
      note: data[i][1]
    });
  }
  
  return notes;
}

// ========== СОХРАНЕНИЕ TG ID В ЛИСТ EMPLOYEES ==========
function saveTgLink(empName, tgId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Employees');
  
  if (!sheet) {
    sheet = ss.insertSheet('Employees');
    sheet.getRange(1, 1).setValue('Имя');
    sheet.getRange(1, 2).setValue('Должность');
    sheet.getRange(1, 3).setValue('Telegram ID');
  }
  
  var data = sheet.getDataRange().getValues();
  var nameNorm = String(empName).trim().toLowerCase();
  var tgIdStr = String(tgId);
  
  // Точное совпадение по имени
  for (var i = 1; i < data.length; i++) {
    var rowName = String(data[i][0]).trim().toLowerCase();
    if (rowName === nameNorm) {
      sheet.getRange(i + 1, 3).setValue(tgIdStr);
      Logger.log('✅ saveTgLink успешно: ' + empName + ' -> ' + tgId);
      return;
    }
  }
  
  // Нечёткое совпадение по частям имени
  var parts = nameNorm.split(/\s+/);
  for (var i = 1; i < data.length; i++) {
    var rowName = String(data[i][0]).trim().toLowerCase();
    var allMatch = parts.every(function(p) { return rowName.indexOf(p) !== -1; });
    if (allMatch) {
      sheet.getRange(i + 1, 3).setValue(tgIdStr);
      Logger.log('✅ saveTgLink успешно (нечёткое): ' + empName + ' -> ' + tgId);
      return;
    }
  }
  
  // Новая запись
  var lastRow = sheet.getLastRow() || 1;
  sheet.getRange(lastRow + 1, 1).setValue(empName);
  sheet.getRange(lastRow + 1, 3).setValue(tgIdStr);
  Logger.log('✅ saveTgLink создана новая запись: ' + empName + ' -> ' + tgId);
}

// ========== КАРТА ЛИСТОВ ПО МЕСЯЦАМ ==========
function getSheetsMap(ss) {
  var sheets = ss.getSheets();
  var map = {};
  var monthNames = {
    'январь': 1, 'февраль': 2, 'март': 3,
    'апрель': 4, 'май': 5, 'июнь': 6,
    'июль': 7, 'август': 8, 'сентябрь': 9,
    'октябрь': 10, 'ноябрь': 11, 'декабрь': 12
  };
  
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (name === 'Employees' || name === 'ShiftEdits' || name === 'EmpNotes') continue;
    
    var nameLower = name.toLowerCase().trim();
    var monthNum = null;
    var yearNum = null;
    
    for (var monthName in monthNames) {
      if (nameLower.indexOf(monthName) !== -1) {
        monthNum = monthNames[monthName];
        var yearMatch = name.match(/\d{4}/);
        if (yearMatch) yearNum = parseInt(yearMatch[0]);
        break;
      }
    }
    
    if (monthNum && yearNum) {
      var key = monthNum + '_' + yearNum;
      map[key] = {
        name: name,
        gid: sheets[i].getSheetId(),
        month: monthNum,
        year: yearNum
      };
    }
  }
  
  return map;
}

// ========== ВСПОМОГАТЕЛЬНАЯ: JSON ОТВЕТ ==========
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========== ОТПРАВКА ОТЛАДКИ АДМИНИСТРАТОРАМ ==========
function sendDebugToAdmins(empName, empDept, empRoles, tgUsername, tgId) {
  var ADMIN_TG_IDS = [783948887, 6147055724];
  
  // Форматирование отдела
  var deptLabel = 'Не указано';
  if (empDept) {
    var deptMap = {
      'power': '⚡ Бар (менеджер)',
      'bar': '🍷 Бар',
      'hall': '🪑 Зал',
      'kitchen': '👨‍🍳 Кухня'
    };
    deptLabel = deptMap[empDept] || empDept;
  }
  
  // Форматирование должностей
  var rolesText = '';
  if (empRoles && empRoles.length > 0) {
    rolesText = empRoles.join(', ');
  }
  
  // Форматирование username
  var usernameText = tgUsername ? '@' + tgUsername : 'не указан';
  
  // Формирование сообщения
  var message = '🐛 *ОТЛАДКА ОТ ПОЛЬЗОВАТЕЛЯ*\n\n';
  message += '👤 *Сотрудник:* ' + empName + '\n';
  message += '📍 *Отдел:* ' + deptLabel + '\n';
  message += '💼 *Должности:* ' + (rolesText || 'не указаны') + '\n';
  message += '📱 *Username:* ' + usernameText + '\n';
  message += '🔑 *TG ID:* `' + tgId + '`\n';
  message += '\n_Отладка отправлена:_ ' + new Date().toLocaleString('ru-RU');
  
  // Отправляем всем администраторам
  for (var i = 0; i < ADMIN_TG_IDS.length; i++) {
    sendMessage(ADMIN_TG_IDS[i], message);
  }
  
  Logger.log('✅ sendDebugToAdmins отправлена отладка для: ' + empName);
}

// ========== ТЕСТИРОВАНИЕ БЕЗ ОТПРАВКИ В TELEGRAM ==========

// 🧪 ТЕСТ 1: Проверить отчеты без отправки
function testSendMonthlyReports() {
  Logger.log('\n🧪 НАЧАЛО ТЕСТА testSendMonthlyReports()');
  Logger.log('════════════════════════════════════════\n');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var employees = ss.getSheetByName('Employees');
  if (!employees) {
    Logger.log('❌ Лист Employees не найден');
    return;
  }
  
  // Получаем предыдущий месяц
  var now = new Date();
  var prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var prevMonthSheet = getMonthSheet(ss, prevMonth);
  
  if (!prevMonthSheet) {
    Logger.log('⚠️ Лист предыдущего месяца не найден. Использую текущий месяц для теста.');
    prevMonthSheet = getCurrentMonthSheet();
  }
  
  if (!prevMonthSheet) {
    Logger.log('❌ Нет листа с данными месяца для теста');
    return;
  }
  
  Logger.log('📅 Тестирую месяц: ' + prevMonthSheet.getName() + '\n');
  
  var data = employees.getDataRange().getValues();
  var successCount = 0;
  var failCount = 0;
  
  for (var i = 1; i < data.length; i++) {
    var empName = String(data[i][0]).trim();
    var chatId = data[i][2];
    
    if (!empName || !chatId) continue;
    
    var report = generateEmployeeReport(empName, prevMonthSheet);
    if (!report) {
      Logger.log('⚠️ Отчет для ' + empName + ' не найден (нет данных)');
      failCount++;
      continue;
    }
    
    // Формируем сообщение
    var message = '📊 Итоги за ' + prevMonthSheet.getName() + '\n\n';
    message += '👤 ' + empName + '\n';
    
    if (report.roles.length === 1) {
      var role = report.roles[0];
      message += '(' + role.name + ')\n';
      message += '⏱ Всего часов: ' + Math.round(role.hours * 100) / 100;
    } else {
      for (var j = 0; j < report.roles.length; j++) {
        message += report.roles[j].name + ' : ' + Math.round(report.roles[j].hours * 100) / 100 + ' ч\n';
      }
    }
    
    // Логируем вместо отправки
    Logger.log('✅ [Готов к отправке] ' + empName + ' (ID: ' + chatId + ')');
    Logger.log('📝 Текст сообщения:\n' + message);
    Logger.log('──────────────────────────────────────\n');
    
    successCount++;
  }
  
  Logger.log('════════════════════════════════════════');
  Logger.log('📊 РЕЗУЛЬТАТЫ ТЕСТА:');
  Logger.log('✅ Готовых к отправке: ' + successCount);
  Logger.log('⚠️ Без данных: ' + failCount);
  Logger.log('════════════════════════════════════════\n');
}

// 🧪 ТЕСТ 2: Проверить отчет конкретного сотрудника
function testEmployeeReport(empName) {
  Logger.log('\n🧪 НАЧАЛО ТЕСТА testEmployeeReport()');
  Logger.log('════════════════════════════════════════');
  Logger.log('Проверяю сотрудника: ' + empName + '\n');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var monthSheet = getCurrentMonthSheet();
  
  if (!monthSheet) {
    Logger.log('❌ Нет листа с данными месяца');
    return;
  }
  
  Logger.log('📅 Месяц: ' + monthSheet.getName());
  
  var report = generateEmployeeReport(empName, monthSheet);
  
  if (!report || report.roles.length === 0) {
    Logger.log('❌ Сотрудник не найден или нет данных\n');
    return;
  }
  
  Logger.log('✅ Найден сотрудник: ' + empName + '\n');
  Logger.log('📋 Должности и часы:');
  
  for (var i = 0; i < report.roles.length; i++) {
    var role = report.roles[i];
    Logger.log('  • ' + role.name + ': ' + Math.round(role.hours * 100) / 100 + ' часов');
  }
  
  Logger.log('\n════════════════════════════════════════\n');
}

// 🧪 ТЕСТ 3: Проверить расчет часов для разных смен
function testGetHoursForShift() {
  Logger.log('\n🧪 НАЧАЛО ТЕСТА testGetHoursForShift()');
  Logger.log('════════════════════════════════════════\n');
  
  var testCases = [
    { input: '8', expected: 8 },
    { input: '12', expected: 12 },
    { input: '24', expected: 24 },
    { input: '09-20', expected: 11 },
    { input: '20-09', expected: 13 },
    { input: '09-09', expected: 24 },
    { input: 'д', expected: 0 },
    { input: 'н', expected: 0 },
    { input: 'с', expected: 0 },
    { input: '', expected: 0 },
    { input: 'Бармен 09-15', expected: 6 }
  ];
  
  var passCount = 0;
  var failCount = 0;
  
  for (var i = 0; i < testCases.length; i++) {
    var testCase = testCases[i];
    var result = getHoursForShift(testCase.input);
    var passed = result === testCase.expected;
    
    var icon = passed ? '✅' : '❌';
    var status = passed ? 'PASS' : 'FAIL';
    
    Logger.log(icon + ' ' + status + ': getHoursForShift("' + testCase.input + '")');
    Logger.log('   Ожидалось: ' + testCase.expected + ' часов');
    Logger.log('   Получено: ' + result + ' часов\n');
    
    if (passed) {
      passCount++;
    } else {
      failCount++;
    }
  }
  
  Logger.log('════════════════════════════════════════');
  Logger.log('📊 РЕЗУЛЬТАТЫ:');
  Logger.log('✅ Пройдено: ' + passCount);
  Logger.log('❌ Не пройдено: ' + failCount);
  Logger.log('════════════════════════════════════════\n');
}

// 🧪 ТЕСТ 4: Проверить поиск сотрудника по имени
function testGetChatId(empName) {
  Logger.log('\n🧪 НАЧАЛО ТЕСТА testGetChatId()');
  Logger.log('════════════════════════════════════════');
  Logger.log('Поиск сотрудника: ' + empName + '\n');
  
  var chatId = getChatId(empName, '');
  
  if (chatId) {
    Logger.log('✅ НАЙДЕН');
    Logger.log('📱 Telegram ID: ' + chatId);
  } else {
    Logger.log('❌ НЕ НАЙДЕН');
    Logger.log('⚠️ Проверьте имя в листе Employees');
  }
  
  Logger.log('\n════════════════════════════════════════\n');
}

// 🧪 ТЕСТ 5: Вывести всех сотрудников с их данными
function testListAllEmployees() {
  Logger.log('\n🧪 НАЧАЛО ТЕСТА testListAllEmployees()');
  Logger.log('════════════════════════════════════════\n');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Employees');
  
  if (!sheet) {
    Logger.log('❌ Лист Employees не найден');
    return;
  }
  
  var data = sheet.getDataRange().getValues();
  Logger.log('📋 Всего сотрудников: ' + (data.length - 1) + '\n');
  
  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][0]).trim();
    var position = String(data[i][1]).trim();
    var chatId = data[i][2];
    
    if (!name) continue;
    
    var status = chatId ? '✅ Привязан' : '⚠️ Нет Telegram';
    Logger.log(i + '. ' + name);
    Logger.log('   📌 Должность: ' + position);
    Logger.log('   🔑 TG ID: ' + (chatId || 'не указан'));
    Logger.log('   ' + status + '\n');
  }
  
  Logger.log('════════════════════════════════════════\n');
}
