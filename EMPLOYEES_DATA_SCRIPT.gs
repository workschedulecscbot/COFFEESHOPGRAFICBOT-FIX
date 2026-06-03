  /**
 * Apps Script для получения данных сотрудников (Birthday, Telegram)
 * 
 * Лист "data" (gid: 1704913166):
 * Колонка A: Имя Фамилия (как в графике)
 * Колонка B: Telegram username (@username, "no" для неактивного TG, или пусто)
 * Колонка C: День рождения (дд.мм.гггг)
 */

const DATA_SHEET_GID = 1704913166;

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetById(DATA_SHEET_GID);
    
    if (!sheet) {
      return jsonResponse({ 
        error: 'Лист "data" (gid: ' + DATA_SHEET_GID + ') не найден',
        employees: []
      });
    }
    
    var lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      return jsonResponse({ 
        employees: []
      });
    }
    
    // Получаем все данные со второй строки (первая - заголовок)
    // Используем getDisplayValues(), чтобы получить ту текстовую дату, что видна в таблице,
    // и избежать таймзонных смещений при неявном преобразовании Date.
    var range = sheet.getRange(2, 1, lastRow - 1, 3);
    var values = range.getDisplayValues();
    
    var employees = [];
    
    for (var i = 0; i < values.length; i++) {
      var name = String(values[i][0]).trim();
      var tgUsername = String(values[i][1]).trim();
      var birthday = values[i][2];
      
      // Если birthday - Date объект (если ячейка отформатирована как дата), берем чистые день/месяц, чтобы избежать смещения при таймзоне
      if (birthday instanceof Date) {
        var ddNum = birthday.getDate();
        var mmNum = birthday.getMonth() + 1;
        var ddStr = (ddNum < 10 ? '0' : '') + ddNum;
        var mmStr = (mmNum < 10 ? '0' : '') + mmNum;
        birthday = ddStr + '.' + mmStr + '.' + birthday.getFullYear();
      } else {
        birthday = String(birthday).trim();
      }
      
      // Пропускаем пустые строки
      if (!name) continue;
      
      // Нормализуем день рождения: дд.мм.гггг → мм-дд
      var birthdayMmDd = '';
      if (birthday && birthday.length >= 5) {
        var parts = birthday.split('.');
        if (parts.length === 3) {
          var dd = parts[0].trim();
          var mm = parts[1].trim();
          var yy = parts[2].trim();
          if (dd && mm && yy) {
            birthdayMmDd = mm + '-' + dd;
          }
        }
      }
      
      // Обрабатываем Telegram username
      // "no" остаётся как "no" для показа неактивной кнопки TG
      // Остальное используется как есть (username или пусто)
      var finalTgUsername = tgUsername;
      if (tgUsername && tgUsername.toLowerCase() === 'no') {
        finalTgUsername = 'no';
      }
      
      employees.push({
        name: name,
        tgUsername: finalTgUsername || '',
        birthday: birthdayMmDd
      });
    }
    
    console.log('✅ Загружено сотрудников: ' + employees.length);
    return jsonResponse({ employees: employees });
    
  } catch(err) {
    console.error('❌ Ошибка: ' + err);
    return jsonResponse({ 
      error: err.toString(),
      employees: []
    });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
