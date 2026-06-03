const TELEGRAM_BOT_TOKEN = '8495856123:AAHE32o7Sj1Oxp9qtc5gmQA4LcaWeD3U8Fs';
const SHEET_ID = '1sL_h0hLfxAl8lkVwTuYt48XwXfAs5rVs5gxSzgvd_GI';
const CHAT_ID = -5123052447; // ID группы для отправки поздравлений
const TELEGRAM_API = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN;

/**
 * Функция для обработки входящих сообщений от Telegram
 * Вызывается webhook'ом
 */
function doPost(e) {
  try {
    Logger.log('=== ПОЛУЧЕНО СООБЩЕНИЕ ===');
    Logger.log('Сырые данные: ' + e.postData.contents);
    
    const contents = JSON.parse(e.postData.contents);
    Logger.log('Распарсено: ' + JSON.stringify(contents));
    
    // Проверяем, есть ли сообщение
    if (contents.message) {
      const message = contents.message;
      const chatId = message.chat ? message.chat.id : null;
      const text = message.text || message.caption; // Может быть текст или caption
      const messageId = message.message_id;
      
      Logger.log('Chat ID: ' + chatId);
      Logger.log('Текст: ' + text);
      Logger.log('Тип: ' + typeof(text));
      Logger.log('Message ID: ' + messageId);
      
      // Проверяем, является ли сообщение командой /birthday
      if (text && typeof(text) === 'string' && text.startsWith('/birthday')) {
        Logger.log('✅ Команда /birthday распознана');
        handleBirthdayCommand(text);
      } else {
        Logger.log('⚠️ Сообщение не является командой /birthday (текст: ' + text + ')');
      }
    } else {
      Logger.log('⚠️ В сообщении нет текста');
    }
    
    // Возвращаем простой ответ 200 OK
    return ContentService.createTextOutput('ok')
      .setMimeType(ContentService.MimeType.TEXT);
    
  } catch (error) {
    Logger.log('❌ Ошибка обработки сообщения: ' + error);
    Logger.log('Stack: ' + error.stack);
    return ContentService.createTextOutput('error')
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * Проверка webhook (GET запрос от Telegram)
 */
function doGet(e) {
  Logger.log('=== GET ЗАПРОС ===');
  Logger.log('Параметры: ' + JSON.stringify(e.parameter));
  return ContentService.createTextOutput('ok')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Обработка команды /birthday
 */
function handleBirthdayCommand(text) {
  try {
    Logger.log('=== ОБРАБОТКА КОМАНДЫ /birthday ===');
    Logger.log('Полный текст: ' + text);
    Logger.log('Тип text: ' + typeof(text));
    
    // Проверяем, что text не undefined и не null
    if (!text || typeof(text) !== 'string') {
      Logger.log('❌ Text недействителен: ' + text);
      sendTelegramMessage(CHAT_ID, '❌ Ошибка: текст команды не найден');
      return;
    }
    
    // Парсим номер строки из команды (например, "/birthday 1")
    const parts = text.split(/\s+/);
    Logger.log('Части команды: ' + JSON.stringify(parts));
    
    if (parts.length < 2) {
      Logger.log('❌ Номер строки не указан');
      sendTelegramMessage(CHAT_ID, '❌ Использование: /birthday [номер_строки]\n\nПример: /birthday 1');
      return;
    }
    
    const rowNumber = parseInt(parts[1]);
    Logger.log('Номер строки: ' + rowNumber);
    
    if (isNaN(rowNumber) || rowNumber < 1) {
      Logger.log('❌ Некорректный номер строки: ' + parts[1]);
      sendTelegramMessage(CHAT_ID, '❌ Пожалуйста, укажите корректный номер строки (число больше 0)');
      return;
    }
    
    // Получаем данные из таблицы
    Logger.log('Открываю таблицу с ID: ' + SHEET_ID);
    const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    const data = sheet.getDataRange().getValues();
    Logger.log('Получено строк из таблицы: ' + data.length);
    
    // Проверяем, существует ли строка
    if (rowNumber > data.length) {
      Logger.log('❌ Строка ' + rowNumber + ' не найдена (всего строк: ' + data.length + ')');
      sendTelegramMessage(CHAT_ID, '❌ Строка не найдена в таблице');
      return;
    }
    
    // Получаем данные (индексация начинается с 0, поэтому вычитаем 1)
      const row = data[rowNumber - 1];
      const name = row[0];           // Столбец A
      const username = row[1];       // Столбец B (может быть 'no')
      const birthDate = row[2];      // Столбец C

      Logger.log('Данные из таблицы - Имя: ' + name + ', Username: ' + username + ', Дата: ' + birthDate);

      if (!name) {
        Logger.log('❌ Неполные данные - Имя отсутствует в строке: ' + rowNumber);
        sendTelegramMessage(CHAT_ID, '❌ Неполные данные в таблице для этой строки (нет имени)');
        return;
      }

      // Проверяем, нужно ли упоминание
      var mentionDisabled = false;
      if (username && typeof username === 'string') {
        try {
          if (username.trim().toLowerCase() === 'no') mentionDisabled = true;
        } catch (e) {
          mentionDisabled = false;
        }
      } else {
        mentionDisabled = true; // если username пустой — не упоминаем
      }

      // Формируем поздравление
      var greeting = '';
      if (mentionDisabled) {
        greeting = '🎉 С днём рождения, ' + name + '! 🎉\n\n';
        greeting += 'Поздравляем ' + name + ' с днём рождения! 🥳\n';
        greeting += 'Желаем здоровья, счастья и всех благ! 🎂🎈';
        Logger.log('✅ Формат: без упоминания (username отсутствует или "no")');
      } else {
        greeting = '🎉 С днём рождения, ' + username + '! 🎉\n\n';
        greeting += 'Поздравляем ' + name + ' с днём рождения! 🥳\n';
        greeting += 'Желаем здоровья, счастья и всех благ! 🎂🎈';
        Logger.log('✅ Формат: с упоминанием ' + username);
      }
    
    Logger.log('✅ Готово к отправке поздравления: ' + greeting);
    
    // Отправляем сообщение
    sendTelegramMessage(CHAT_ID, greeting);
    Logger.log('✅ Сообщение отправлено!');
    
  } catch (error) {
    Logger.log('❌ Ошибка при обработке команды /birthday: ' + error);
    Logger.log('Stack: ' + error.stack);
    sendTelegramMessage(CHAT_ID, '❌ Произошла ошибка при обработке запроса');
  }
}

/**
 * Отправка сообщения в Telegram
 */
function sendTelegramMessage(chatId, text) {
  try {
    Logger.log('=== ОТПРАВКА В TELEGRAM ===');
    Logger.log('Chat ID: ' + chatId);
    Logger.log('Текст: ' + text);
    
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };
    
    Logger.log('Payload: ' + JSON.stringify(payload));
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const url = TELEGRAM_API + '/sendMessage';
    Logger.log('URL: ' + url);
    
    const response = UrlFetchApp.fetch(url, options);
    const responseText = response.getContentText();
    
    Logger.log('Статус ответа: ' + response.getResponseCode());
    Logger.log('Ответ Telegram: ' + responseText);
    
  } catch (error) {
    Logger.log('❌ Ошибка отправки: ' + error);
    Logger.log('Stack: ' + error.stack);
  }
}

/**
 * Установка webhook для получения обновлений от Telegram
 * Запустить один раз, затем удалить вызов
 */
function setWebhook() {
  try {
    Logger.log('=== УСТАНОВКА WEBHOOK ===');
    
    // Получаем URL скрипта
    let scriptUrl = ScriptApp.getService().getUrl();
    Logger.log('Исходный URL: ' + scriptUrl);
    
    // Удаляем /dev если он есть в конце
    scriptUrl = scriptUrl.replace('/dev', '');
    Logger.log('URL для webhook (без /dev): ' + scriptUrl);
    
    const payload = {
      url: scriptUrl
    };
    
    Logger.log('Payload: ' + JSON.stringify(payload));
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const url = TELEGRAM_API + '/setWebhook';
    Logger.log('URL API: ' + url);
    
    const response = UrlFetchApp.fetch(url, options);
    const responseText = response.getContentText();
    
    Logger.log('Статус: ' + response.getResponseCode());
    Logger.log('Ответ: ' + responseText);
    
  } catch (error) {
    Logger.log('❌ Ошибка установки webhook: ' + error);
  }

  /**
   * Установка webhook на указанный URL вручную
   * Использование: setWebhookTo('https://.../exec')
   */
  function setWebhookTo(url) {
    try {
      Logger.log('=== УСТАНОВКА WEBHOOK ПО URL ===');
      if (!url || typeof url !== 'string') {
        Logger.log('❌ Некорректный URL: ' + url);
        return;
      }
      // Убираем /dev если пользователь передал development URL
      var webhookUrl = url.trim().replace('/dev', '');
      Logger.log('URL для установки webhook: ' + webhookUrl);

      var payload = {
        url: webhookUrl,
        allowed_updates: ["message"]
      };

      var options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      var setUrl = TELEGRAM_API + '/setWebhook';
      Logger.log('Вызов API: ' + setUrl);
      var response = UrlFetchApp.fetch(setUrl, options);
      var responseText = response.getContentText();
      Logger.log('Ответ от Telegram: ' + responseText);

      try {
        var result = JSON.parse(responseText);
        if (result.ok) {
          Logger.log('✅ Webhook установлен вручную: ' + webhookUrl);
        } else {
          Logger.log('❌ Ошибка установки webhook: ' + (result.description || responseText));
        }
      } catch (parseErr) {
        Logger.log('❌ Не удалось распарсить ответ Telegram: ' + parseErr + ' | raw: ' + responseText);
      }
    } catch (error) {
      Logger.log('❌ Ошибка в setWebhookTo: ' + error);
    }
  }
}

/**
 * Удаление webhook
 */
function removeWebhook() {
  try {
    Logger.log('=== УДАЛЕНИЕ WEBHOOK ===');
    const url = TELEGRAM_API + '/deleteWebhook';
    Logger.log('URL: ' + url);
    
    const options = {
      method: 'post',
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseText = response.getContentText();
    
    Logger.log('Статус: ' + response.getResponseCode());
    Logger.log('Ответ: ' + responseText);
    
  } catch (error) {
    Logger.log('❌ Ошибка удаления webhook: ' + error);
  }
}

/**
 * Получение информации о webhook
 */
function getWebhookInfo() {
  try {
    Logger.log('=== ПОЛУЧЕНИЕ ИНФОРМАЦИИ О WEBHOOK ===');
    const url = TELEGRAM_API + '/getWebhookInfo';
    Logger.log('URL: ' + url);
    
    const response = UrlFetchApp.fetch(url);
    const responseText = response.getContentText();
    
    Logger.log('Ответ: ' + responseText);
  } catch (error) {
    Logger.log('❌ Ошибка: ' + error);
  }
}

/**
 * Получение правильного URL для webhook
 * Показывает текущий URL и что нужно исправить
 */
function getScriptUrl() {
  try {
    Logger.log('=== ИНФОРМАЦИЯ О SCRIPT URL ===');
    const scriptUrl = ScriptApp.getService().getUrl();
    Logger.log('Текущий URL: ' + scriptUrl);
    
    if (scriptUrl.includes('/dev')) {
      Logger.log('❌ ПРОБЛЕМА: URL заканчивается на /dev (development version)');
      Logger.log('НУЖНО: Создать production deployment');
      Logger.log('');
      Logger.log('ИНСТРУКЦИЯ:');
      Logger.log('1. Нажмите Deploy (вверху)');
      Logger.log('2. Удалите старый deployment с /dev');
      Logger.log('3. Нажмите New Deployment');
      Logger.log('4. Тип: Web app');
      Logger.log('5. Execute as: [Ваш аккаунт]');
      Logger.log('6. Who has access: Anyone');
      Logger.log('7. Deploy');
      Logger.log('8. Скопируйте новый URL (без /dev)');
      Logger.log('9. Затем запустите setWebhook()');
    } else {
      Logger.log('✅ URL выглядит правильно (production)');
      Logger.log('Можно использовать для webhook');
    }
  } catch (error) {
    Logger.log('❌ Ошибка: ' + error);
  }
}

/**
 * Тестовая функция для проверки без Telegram
 * Можно вызвать вручную для теста
 */
function testBirthday() {
  Logger.log('=== ТЕСТИРОВАНИЕ КОМАНДЫ ===');
  
  // Имитируем команду /birthday 1
  const testText = '/birthday 1';
  Logger.log('Отправляю тестовую команду: ' + testText);
  
  handleBirthdayCommand(testText);
}

/**
 * Тестирование webhook - отправляет тестовый POST запрос на сам себя
 */
function testWebhookAccess() {
  try {
    Logger.log('=== ТЕСТИРОВАНИЕ ДОСТУПА К WEBHOOK ===');
    
    const scriptUrl = ScriptApp.getService().getUrl().replace('/dev', '');
    Logger.log('URL скрипта: ' + scriptUrl);
    
    // Создаем тестовый Telegram update
    const testUpdate = {
      update_id: 123456,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: CHAT_ID,
          type: 'group'
        },
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Test'
        },
        text: '/birthday 1'
      }
    };
    
    Logger.log('Отправляю тестовый запрос...');
    Logger.log('Тестовые данные: ' + JSON.stringify(testUpdate));
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(testUpdate),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(scriptUrl, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log('Статус код: ' + statusCode);
    Logger.log('Ответ: ' + responseText);
    
    if (statusCode === 200) {
      Logger.log('✅ Webhook работает! Telegram сможет получить доступ.');
    } else {
      Logger.log('❌ Проблема! Статус код: ' + statusCode);
    }
    
  } catch (error) {
    Logger.log('❌ Ошибка тестирования: ' + error);
  }
}

/**
 * Полная переустановка webhook с очисткой
 */
function reinstallWebhook() {
  try {
    Logger.log('=== ПОЛНАЯ ПЕРЕУСТАНОВКА WEBHOOK ===');
    
    // Шаг 1: Удаляем старый webhook
    Logger.log('Шаг 1: Удаление старого webhook...');
    const deleteUrl = TELEGRAM_API + '/deleteWebhook';
    const deleteOptions = {
      method: 'post',
      muteHttpExceptions: true
    };
    const deleteResponse = UrlFetchApp.fetch(deleteUrl, deleteOptions);
    Logger.log('Результат удаления: ' + deleteResponse.getContentText());
    
    // Ждем 2 секунды
    Utilities.sleep(2000);
    
    // Шаг 2: Устанавливаем новый webhook
    Logger.log('Шаг 2: Установка нового webhook...');
    let scriptUrl = ScriptApp.getService().getUrl();
    Logger.log('Исходный URL: ' + scriptUrl);
    
    // Удаляем /dev если он есть в конце
    scriptUrl = scriptUrl.replace('/dev', '');
    Logger.log('URL для webhook (без /dev): ' + scriptUrl);
    
    const setPayload = {
      url: scriptUrl,
      allowed_updates: ["message"]
    };
    
    const setOptions = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(setPayload),
      muteHttpExceptions: true
    };
    
    const setUrl = TELEGRAM_API + '/setWebhook';
    const setResponse = UrlFetchApp.fetch(setUrl, setOptions);
    const setResult = JSON.parse(setResponse.getContentText());
    
    Logger.log('Результат установки: ' + JSON.stringify(setResult));
    
    if (setResult.ok) {
      Logger.log('✅ Webhook успешно переустановлен!');
    } else {
      Logger.log('❌ Ошибка: ' + setResult.description);
    }
    
    // Шаг 3: Проверяем информацию о webhook
    Logger.log('Шаг 3: Проверка информации...');
    Utilities.sleep(1000);
    const infoUrl = TELEGRAM_API + '/getWebhookInfo';
    const infoResponse = UrlFetchApp.fetch(infoUrl);
    Logger.log('Информация о webhook: ' + infoResponse.getContentText());
    
  } catch (error) {
    Logger.log('❌ Ошибка при переустановке: ' + error);
  }
}

/**
 * Long polling через getUpdates — можно использовать вместо webhook
 * Создайте триггер Time-driven (каждую минуту) или вызовите installPollingTrigger()
 */
function pollUpdates() {
  try {
    var props = PropertiesService.getScriptProperties();
    var offset = Number(props.getProperty('tg_offset')) || 0;
    var url = TELEGRAM_API + '/getUpdates?timeout=0&limit=100&offset=' + (offset + 1);
    Logger.log('Polling Telegram: ' + url);

    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = resp.getResponseCode();
    var body = resp.getContentText();
    Logger.log('Poll status: ' + code + ' body: ' + body);

    if (code !== 200) return;
    var data = JSON.parse(body || '{}');
    if (!data.ok || !data.result || data.result.length === 0) return;

    data.result.forEach(function(update) {
      try {
        if (update.update_id) offset = Math.max(offset, update.update_id);
        if (update.message && update.message.text) {
          var text = update.message.text;
          Logger.log('Получен update message: ' + text);
          if (typeof text === 'string' && text.startsWith('/birthday')) {
            handleBirthdayCommand(text);
          }
        }
      } catch (e) {
        Logger.log('Ошибка обработки update: ' + e);
      }
    });

    props.setProperty('tg_offset', String(offset));
  } catch (error) {
    Logger.log('❌ Ошибка в pollUpdates: ' + error);
  }
}

/**
 * Установить триггер polling (Time-driven every minute)
 */
function installPollingTrigger() {
  try {
    ScriptApp.newTrigger('pollUpdates')
      .timeBased()
      .everyMinutes(1)
      .create();
    Logger.log('✅ Trigger for pollUpdates installed (every minute)');
  } catch (error) {
    Logger.log('❌ Ошибка установки триггера: ' + error);
  }
}

/**
 * Удалить все триггеры pollUpdates
 */
function removePollingTrigger() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function(t) {
      if (t.getHandlerFunction() === 'pollUpdates') {
        ScriptApp.deleteTrigger(t);
      }
    });
    Logger.log('✅ Все триггеры pollUpdates удалены');
  } catch (error) {
    Logger.log('❌ Ошибка удаления триггера: ' + error);
  }
}

